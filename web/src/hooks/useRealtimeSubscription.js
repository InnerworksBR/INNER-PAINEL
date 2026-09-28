import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useClientRequestConfig } from '../context/ClientPreviewContext';

/**
 * Compatibility wrapper kept for existing imports.
 * The portal now uses API polling instead of Supabase Realtime because the API
 * is the source of tenant-filtered data and auth behavior.
 */
export function useRealtimeSubscription() {
  return null;
}

/**
 * Fetch inicial + polling confiável.
 *
 * @param {string} apiEndpoint - Endpoint da API para buscar dados.
 * @param {string} table - Nome lógico do conjunto de dados.
 * @param {object} options - { enabled, intervalMs }
 * @returns {{ data, loading, refresh, lastUpdated, source, table }}
 */
export function useRealtimeData(apiEndpoint, table, options = {}) {
  const {
    enabled = true,
    intervalMs = 60000,
    realtime = false,
    realtimeEndpoint = '/client/metrics/servers/stream',
    realtimeDataKey = null,
  } = options;
  const requestConfig = useClientRequestConfig();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get(apiEndpoint, requestConfig);
      setData(response.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Erro ao buscar ${apiEndpoint}:`, error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, requestConfig]);

  useEffect(() => {
    if (!enabled) return undefined;

    fetchData();
    if (!intervalMs || intervalMs <= 0) return undefined;

    const timer = window.setInterval(fetchData, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, fetchData, intervalMs]);

  useEffect(() => {
    if (!enabled || !realtime || typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return undefined;
    }

    const controller = new AbortController();
    let reconnectTimer;
    let active = true;

    const streamUrl = () => {
      const baseUrl = api.defaults.baseURL || window.location.origin;
      const url = new URL(baseUrl + realtimeEndpoint, window.location.origin);
      Object.entries(requestConfig.params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, value);
      });
      return url.toString();
    };

    const consume = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(streamUrl(), {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error('SSE stream returned ' + response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          events.forEach((event) => {
            const dataLine = event
              .split('\n')
              .find(line => line.startsWith('data:'));
            if (!dataLine) return;
            try {
              const payload = JSON.parse(dataLine.slice(5).trim());
              const nextData = realtimeDataKey ? payload[realtimeDataKey] : payload;
              if (nextData !== undefined) {
                setData(nextData || []);
                setLastUpdated(new Date());
              }
            } catch (error) {
              console.error('Evento SSE inválido:', error);
            }
          });
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        console.warn('Stream SSE indisponível para ' + table + '; polling permanece ativo.', error);
        reconnectTimer = window.setTimeout(consume, 3000);
      }
    };

    consume();
    return () => {
      active = false;
      controller.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [enabled, realtime, realtimeEndpoint, realtimeDataKey, requestConfig, table]);

  return { data, loading, refresh: fetchData, lastUpdated, source: realtime ? 'sse+polling' : 'polling', table };
}
