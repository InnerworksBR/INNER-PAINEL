import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SETTINGS: Record<string, string> = {
  systemName: 'Portal Inner',
  baseUrl: '',
  sessionTimeout: '30',
  maintenanceMode: 'false',
  detailedLogs: 'false',
};

let cache: { values: Record<string, string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getSystemSettings(supabase: SupabaseClient): Promise<Record<string, string>> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.values;
  }

  const { data, error } = await supabase.from('system_settings').select('*');
  if (error) {
    return DEFAULT_SETTINGS;
  }

  const values = { ...DEFAULT_SETTINGS };
  (data || []).forEach((row: any) => {
    values[row.key] = row.value;
  });

  cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
  return values;
}

export function clearSettingsCache(): void {
  cache = null;
}

export async function getSessionTimeoutSeconds(supabase: SupabaseClient): Promise<number> {
  const settings = await getSystemSettings(supabase);
  const minutes = Number.parseInt(settings.sessionTimeout || DEFAULT_SETTINGS.sessionTimeout, 10);
  const safeMinutes = Number.isFinite(minutes) && minutes >= 5 ? minutes : 30;
  return safeMinutes * 60;
}

export async function isMaintenanceModeEnabled(supabase: SupabaseClient): Promise<boolean> {
  const settings = await getSystemSettings(supabase);
  return settings.maintenanceMode === 'true';
}

export async function isDetailedLoggingEnabled(supabase: SupabaseClient): Promise<boolean> {
  const settings = await getSystemSettings(supabase);
  return settings.detailedLogs === 'true';
}
