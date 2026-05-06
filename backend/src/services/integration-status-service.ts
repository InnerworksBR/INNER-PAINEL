import type { SupabaseClient } from '@supabase/supabase-js';

type SyncType = 'ms365' | 'zabbix' | 'zabbix_network' | 'glpi';

export async function recordSyncSuccess(
  supabase: SupabaseClient,
  companyId: string,
  syncType: SyncType,
  count: number
): Promise<void> {
  await updateSyncStatus(supabase, companyId, syncType, {
    [`${syncType}_last_sync_at`]: new Date().toISOString(),
    [`${syncType}_last_sync_error`]: null,
    [`${syncType}_last_sync_count`]: count,
  });
}

export async function recordSyncError(
  supabase: SupabaseClient,
  companyId: string,
  syncType: SyncType,
  errorMessage: string
): Promise<void> {
  await updateSyncStatus(supabase, companyId, syncType, {
    [`${syncType}_last_sync_at`]: new Date().toISOString(),
    [`${syncType}_last_sync_error`]: errorMessage,
  });
}

async function updateSyncStatus(
  supabase: SupabaseClient,
  companyId: string,
  _syncType: SyncType,
  updates: Record<string, string | number | null>
): Promise<void> {
  const { error } = await supabase
    .from('company_integrations')
    .upsert(
      { company_id: companyId, updated_at: new Date().toISOString(), ...updates },
      { onConflict: 'company_id' }
    );

  if (error) {
    console.error('Erro ao atualizar status de sincronização:', error.message);
  }
}
