import type { SupabaseClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { syncTickets } from '../services/glpi-service';
import { syncMS365Metrics } from '../services/ms-graph-service';
import { fetchZabbixMetrics, fetchZabbixNetworkDevices } from '../services/zabbix-service';
import { isDetailedLoggingEnabled } from '../services/settings-service';

export function startSyncScheduler(supabaseAdmin: SupabaseClient): void {
  console.log('Iniciando scheduler de sincronizacao automatica...');

  cron.schedule('*/30 * * * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'zabbix');
  });

  cron.schedule('* * * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'zabbix-network');
  });

  cron.schedule('*/30 * * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'glpi');
  });

  cron.schedule('0 */6 * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'ms365');
  });

  console.log('Scheduler configurado: Zabbix 30s, rede 60s, GLPI 30min, MS365 6h');
}

async function syncAllCompanies(
  supabaseAdmin: SupabaseClient,
  syncType: 'zabbix' | 'zabbix-network' | 'glpi' | 'ms365'
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
          case 'zabbix':
            await fetchZabbixMetrics(supabaseAdmin, companyId);
            break;
          case 'zabbix-network':
            await fetchZabbixNetworkDevices(supabaseAdmin, companyId);
            break;
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
