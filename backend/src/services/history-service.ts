import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertServerMetricHistory(
  supabase: SupabaseClient,
  rows: Array<Record<string, any>>
): Promise<void> {
  if (rows.length === 0) return;

  const collectedAt = new Date().toISOString();
  const { error } = await supabase
    .from('server_metric_history')
    .insert(rows.map((row) => ({
      company_id: row.company_id,
      hostname: row.hostname,
      cpu_usage: row.cpu_usage,
      memory_usage: row.memory_usage,
      disk_usage: row.disk_usage,
      memory_total: row.memory_total,
      memory_used: row.memory_used,
      disk_total: row.disk_total,
      disk_used: row.disk_used,
      status: row.status,
      collected_at: collectedAt,
    })));

  if (error) {
    console.error('Erro ao salvar histórico de servidores:', error.message);
  }
}

export async function insertNetworkStatusHistory(
  supabase: SupabaseClient,
  rows: Array<Record<string, any>>
): Promise<void> {
  if (rows.length === 0) return;

  const collectedAt = new Date().toISOString();
  const { error } = await supabase
    .from('network_status_history')
    .insert(rows.map((row) => ({
      company_id: row.company_id,
      device_name: row.device_name,
      device_type: row.device_type,
      ip_address: row.ip_address,
      status: row.status,
      collected_at: collectedAt,
    })));

  if (error) {
    console.error('Erro ao salvar histórico de rede:', error.message);
  }
}
