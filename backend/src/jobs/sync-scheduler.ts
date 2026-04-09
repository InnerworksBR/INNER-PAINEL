// src/jobs/sync-scheduler.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { syncTickets } from '../services/glpi-service';
import { syncMS365Metrics } from '../services/ms-graph-service';
import { fetchZabbixMetrics, fetchZabbixNetworkDevices } from '../services/zabbix-service';

export function startSyncScheduler(supabaseAdmin: SupabaseClient): void {
  console.log('🕐 Iniciando scheduler de sincronização automática...');

  // Sync Zabbix (servidores) — a cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Iniciando sync Zabbix (servidores)...');
    await syncAllCompanies(supabaseAdmin, 'zabbix');
  });

  // Sync Zabbix (rede) — a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] Iniciando sync Zabbix (rede)...');
    await syncAllCompanies(supabaseAdmin, 'zabbix-network');
  });

  // Sync GLPI — a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Iniciando sync GLPI...');
    await syncAllCompanies(supabaseAdmin, 'glpi');
  });

  // Sync MS365 — a cada 6 horas
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Iniciando sync MS365...');
    await syncAllCompanies(supabaseAdmin, 'ms365');
  });

  console.log('✅ Scheduler configurado:');
  console.log('   - Zabbix (servidores): a cada 5 min');
  console.log('   - Zabbix (rede): a cada 15 min');
  console.log('   - GLPI: a cada 30 min');
  console.log('   - MS365: a cada 6 horas');
}

async function syncAllCompanies(
  supabaseAdmin: SupabaseClient,
  syncType: 'zabbix' | 'zabbix-network' | 'glpi' | 'ms365'
): Promise<void> {
  try {
    // Buscar todas as empresas com integrações configuradas
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
        console.log(`[CRON] ${syncType} sync OK para empresa ${companyId}`);
      } catch (err: any) {
        // Log the error but continue with other companies
        console.error(`[CRON] ${syncType} sync FALHOU para empresa ${companyId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`[CRON] Erro geral na sincronização ${syncType}:`, err.message);
  }
}
