import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

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
  const { enabled = true, intervalMs = 60000 } = options;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get(apiEndpoint);
      setData(response.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(`Erro ao buscar ${apiEndpoint}:`, error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    if (!enabled) return undefined;

    fetchData();
    if (!intervalMs || intervalMs <= 0) return undefined;

    const timer = window.setInterval(fetchData, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, fetchData, intervalMs]);

  return { data, loading, refresh: fetchData, lastUpdated, source: 'polling', table };
}
