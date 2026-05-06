import type { SupabaseClient } from '@supabase/supabase-js';

type MonitoringSource = 'server' | 'network';
type MonitoringSeverity = 'info' | 'warning' | 'critical';

interface MonitoringEventInput {
  companyId: string;
  source: MonitoringSource;
  entityName: string;
  entityType?: string;
  previousStatus?: string | null;
  currentStatus: string;
  severity: MonitoringSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function insertMonitoringEvents(
  supabase: SupabaseClient,
  events: MonitoringEventInput[]
): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map((event) => ({
    company_id: event.companyId,
    source: event.source,
    entity_name: event.entityName,
    entity_type: event.entityType || null,
    previous_status: event.previousStatus || null,
    current_status: event.currentStatus,
    severity: event.severity,
    message: event.message,
    metadata: event.metadata || {},
  }));

  const { error } = await supabase.from('monitoring_events').insert(rows);
  if (error) {
    console.error('Erro ao gravar eventos de monitoramento:', error.message);
  }
}

