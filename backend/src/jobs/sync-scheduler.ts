import type { SupabaseClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { syncTickets } from '../services/glpi-service';
import { syncMS365Metrics } from '../services/ms-graph-service';
import { isDetailedLoggingEnabled } from '../services/settings-service';

const SCHEDULED_SYNC_TYPES = ['glpi', 'ms365'] as const;
type ScheduledSyncType = typeof SCHEDULED_SYNC_TYPES[number];

export function getScheduledSyncTypes(): readonly ScheduledSyncType[] {
  return SCHEDULED_SYNC_TYPES;
}

export function startSyncScheduler(supabaseAdmin: SupabaseClient): void {
  console.log('Iniciando scheduler de sincronizacao automatica...');

  cron.schedule('*/30 * * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'glpi');
  });

  cron.schedule('0 */6 * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'ms365');
  });

  cron.schedule('0 0 3 * * *', async () => {
    const { error } = await supabaseAdmin.rpc('purge_agent_metrics', { retention_days: 30 });
    if (error) console.error('[CRON] Falha na retenção de métricas do agente:', error.message);
  });

  console.log('Scheduler configurado: GLPI 30min, MS365 6h, retenção do agente 30d. Servidores: agente nativo.');
}

async function syncAllCompanies(
  supabaseAdmin: SupabaseClient,
  syncType: ScheduledSyncType
): Promise<void> {
  try {
    const detailedLogs = await isDetailedLoggingEnabled(supabaseAdmin);
    const { data: integrations, error } = await supabaseAdmin
      .from('company_integrations')
      .select('company_id');

    if (error || !integrations) {
      console.error(`[CRON] Erro ao buscar empresas para sync ${syncType}:`, error?.message);
      return;
    }

    const companyIds = [...new Set(integrations.map((i: any) => i.company_id))];

    for (const companyId of companyIds) {
      try {
        switch (syncType) {
          case 'glpi':
            await syncTickets(supabaseAdmin, companyId);
            break;
          case 'ms365':
            await syncMS365Metrics(supabaseAdmin, companyId);
            break;
        }

        if (detailedLogs) {
          console.log(`[CRON] ${syncType} sync OK para empresa ${companyId}`);
        }
      } catch (err: any) {
        console.error(`[CRON] ${syncType} sync FALHOU para empresa ${companyId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`[CRON] Erro geral na sincronizacao ${syncType}:`, err.message);
  }
}
