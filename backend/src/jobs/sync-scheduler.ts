import type { SupabaseClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { syncTickets } from '../services/glpi-service';
import { syncMS365Metrics } from '../services/ms-graph-service';
import { isDetailedLoggingEnabled } from '../services/settings-service';

const SCHEDULED_SYNC_TYPES = ['glpi', 'ms365'] as const;
export const NETWORK_RAW_RETENTION_CRON = '0 0 * * * *';
let retentionRunActive = false;
type ScheduledSyncType = typeof SCHEDULED_SYNC_TYPES[number];

export function getScheduledSyncTypes(): readonly ScheduledSyncType[] {
  return SCHEDULED_SYNC_TYPES;
}

export async function purgeRetainedAgentData(
  supabaseAdmin: SupabaseClient,
  options: { batchSize?: number; maxBatches?: number; timeBudgetMs?: number } = {},
): Promise<{ batches: number; samplesDeleted: number; batchesDeleted: number; backlogRemaining: boolean; skipped: boolean }> {
  if (retentionRunActive) {
    console.warn('[CRON] Limpeza de retenção já está em execução; execução duplicada ignorada.');
    return { batches: 0, samplesDeleted: 0, batchesDeleted: 0, backlogRemaining: true, skipped: true };
  }
  retentionRunActive = true;
  try {
    const { error } = await supabaseAdmin.rpc('purge_agent_metrics', { retention_days: 30 });
    if (error) console.error('[CRON] Falha na retenção de métricas do agente:', error.message);

    const batchSize = Math.min(Math.max(options.batchSize ?? 5000, 1), 5000);
    const maxBatches = Math.min(Math.max(options.maxBatches ?? 64, 1), 64);
    const timeBudgetMs = Math.min(Math.max(options.timeBudgetMs ?? 45_000, 1), 45_000);
    const startedAt = Date.now();
    let batches = 0;
    let samplesDeleted = 0;
    let batchesDeleted = 0;
    let backlogRemaining = true;
    while (batches < maxBatches && Date.now() - startedAt < timeBudgetMs) {
      const remainingMs = Math.max(1, timeBudgetMs - (Date.now() - startedAt));
      let response: any;
      try {
        response = await supabaseAdmin.rpc('purge_network_agent_raw_data', { p_batch_limit: batchSize })
          .abortSignal(AbortSignal.timeout(remainingMs));
      } catch (error) {
        console.error('[CRON] Falha na retenção dos dados SNMP:', error instanceof Error ? error.message : error);
        backlogRemaining = true;
        break;
      }
      if (response.error || !response.data) {
        console.error('[CRON] Falha na retenção dos dados SNMP:', response.error?.message || 'Resposta vazia da RPC');
        backlogRemaining = true;
        break;
      }
      batches++;
      samplesDeleted += Number(response.data.samples_deleted || 0);
      batchesDeleted += Number(response.data.batches_deleted || 0);
      backlogRemaining = Boolean(response.data.has_more_batches || response.data.has_more_samples);
      if (!backlogRemaining) break;
    }
    if (backlogRemaining) console.warn(`[CRON] Retenção SNMP deixou backlog após ${batches} lotes (${samplesDeleted} amostras, ${batchesDeleted} lotes removidos); continuará na próxima execução.`);
    return { batches, samplesDeleted, batchesDeleted, backlogRemaining, skipped: false };
  } finally {
    retentionRunActive = false;
  }
}

export function startSyncScheduler(supabaseAdmin: SupabaseClient): void {
  console.log('Iniciando scheduler de sincronizacao automatica...');

  cron.schedule('*/30 * * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'glpi');
  });

  cron.schedule('0 */6 * * *', async () => {
    await syncAllCompanies(supabaseAdmin, 'ms365');
  });

  cron.schedule(NETWORK_RAW_RETENTION_CRON, async () => {
    await purgeRetainedAgentData(supabaseAdmin);
  });

  console.log('Scheduler configurado: GLPI 30min, MS365 6h, retenção de métricas 30d, limpeza SNMP 30d em lotes horários. Servidores: agente nativo.');
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
