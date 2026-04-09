import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase para o frontend (com anon key, não service role)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseClient;
}

/**
 * Hook para escutar mudanças em tempo real em uma tabela do Supabase.
 *
 * @param {string} table - Nome da tabela para escutar (ex: 'servers', 'glpi_tickets')
 * @param {string} event - Tipo de evento: 'INSERT', 'UPDATE', 'DELETE', ou '*' para todos
 * @param {function} onDataChange - Callback chamado quando dados mudam. Recebe { eventType, new, old }
 * @param {object} filter - Filtro opcional ex: { column: 'company_id', value: '...' }
 * @param {boolean} enabled - Se false, não inicia a subscrição
 */
export function useRealtimeSubscription(table, event = '*', onDataChange, filter = null, enabled = true) {
  const channelRef = useRef(null);
  const callbackRef = useRef(onDataChange);

  // Manter referência atualizada do callback
  useEffect(() => {
    callbackRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    if (!enabled) return;

    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase Realtime: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados');
      return;
    }

    const channelName = `realtime-${table}-${event}-${filter?.value || 'all'}-${Date.now()}`;

    let channelConfig = {
      event,
      schema: 'public',
      table,
    };

    // Adicionar filtro se fornecido
    if (filter?.column && filter?.value) {
      channelConfig.filter = `${filter.column}=eq.${filter.value}`;
    }

    const channel = client
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        if (callbackRef.current) {
          callbackRef.current({
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔴 Realtime: escutando ${table} (${event})`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, filter?.column, filter?.value, enabled]);
}

/**
 * Hook simplificado que combina fetch inicial + realtime auto-refresh.
 *
 * @param {string} apiEndpoint - Endpoint da API para buscar dados (ex: '/client/metrics/servers')
 * @param {string} table - Tabela do Supabase para escutar em realtime
 * @param {object} options - { filter, enabled }
 * @returns {{ data, loading, refresh }}
 */
export function useRealtimeData(apiEndpoint, table, options = {}) {
  const { filter = null, enabled = true } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { default: api } = await import('../services/api');
      const response = await api.get(apiEndpoint);
      setData(response.data || []);
    } catch (error) {
      console.error(`Erro ao buscar ${apiEndpoint}:`, error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  // Fetch inicial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch quando dados mudam em Realtime
  const handleRealtimeChange = useCallback(() => {
    console.log(`🔄 Realtime: dados de ${table} mudaram, refetchando...`);
    fetchData();
  }, [fetchData, table]);

  useRealtimeSubscription(table, '*', handleRealtimeChange, filter, enabled);

  return { data, loading, refresh: fetchData };
}
