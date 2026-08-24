import type { SupabaseClient } from '@supabase/supabase-js';

export type AssetSourceType = 'server' | 'network_device';

const PROFILE_FIELDS = [
  'asset_type',
  'display_name',
  'manufacturer',
  'model',
  'serial_number',
  'operating_system',
  'operating_system_version',
  'firmware_version',
  'physical_or_virtual',
  'business_purpose',
  'technical_purpose',
  'environment',
  'criticality',
  'location',
  'notes_for_customer',
] as const;

type ProfileField = typeof PROFILE_FIELDS[number];

export function calculateCompleteness(profile: any): string {
  if (!profile?.notes_for_customer && !profile?.business_purpose && !profile?.technical_purpose) return 'sem_descricao';
  if (!profile?.model) return 'sem_modelo';
  if (!profile?.business_purpose && !profile?.technical_purpose) return 'sem_finalidade';
  return 'completo';
}

export async function upsertAssetProfileFromSource(
  supabase: SupabaseClient,
  sourceType: AssetSourceType,
  source: any,
  autoFields: Record<string, unknown> = {}
) {
  const companyId = source.company_id;
  const sourceId = source.id;
  const baseAutoData = {
    ...(sourceType === 'server'
      ? {
          hostname: source.hostname,
          cpu_usage: source.cpu_usage,
          memory_usage: source.memory_usage,
          disk_usage: source.disk_usage,
          memory_total: source.memory_total,
          disk_total: source.disk_total,
          status: source.status,
          zabbix_host_id: source.zabbix_host_id,
        }
      : {
          device_name: source.device_name,
          device_type: source.device_type,
          ip_address: source.ip_address,
          status: source.status,
        }),
    ...autoFields,
  };

  const { data: existing, error: existingError } = await supabase
    .from('asset_profiles')
    .select('*')
    .eq('company_id', companyId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();

  if (existingError) throw existingError;

  const overrides = new Set<string>(existing?.manual_override_fields || []);
  const autoProfileFields = getAutoProfileFields(sourceType, source, autoFields);
  const mergedFields = Object.fromEntries(
    Object.entries(autoProfileFields).filter(([key, value]) => !overrides.has(key) && value !== undefined)
  );

  const payload = {
    company_id: companyId,
    source_type: sourceType,
    source_id: sourceId,
    asset_type: existing?.asset_type || inferAssetType(sourceType, source),
    customer_visible: existing?.customer_visible ?? true,
    include_in_health_score: existing?.include_in_health_score ?? true,
    is_active: true,
    display_name: existing?.display_name || (sourceType === 'server' ? source.hostname : source.device_name),
    ...mergedFields,
    auto_data: { ...(existing?.auto_data || {}), ...baseAutoData },
    manual_data: existing?.manual_data || {},
    manual_override_fields: existing?.manual_override_fields || [],
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('asset_profiles')
    .upsert(payload, { onConflict: 'company_id,source_type,source_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function mergeAssetProfile(profile: any, source: any) {
  const manualData = profile?.manual_data || {};
  const overrides = new Set<string>(profile?.manual_override_fields || []);
  const merged: Record<string, any> = { ...profile };

  PROFILE_FIELDS.forEach((field) => {
    if (overrides.has(field) && manualData[field] !== undefined) {
      merged[field] = manualData[field];
    }
  });

  return {
    ...merged,
    completeness_status: calculateCompleteness(merged),
    telemetry: source,
  };
}

export async function buildAssetDetail(
  supabase: SupabaseClient,
  sourceType: AssetSourceType,
  sourceId: string,
  companyId: string
): Promise<any | null> {
  const sourceTable = sourceType === 'server' ? 'servers' : 'network_devices';
  const { data: source, error: sourceError } = await supabase
    .from(sourceTable)
    .select('*')
    .eq('id', sourceId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) return null;

  const { data: profile, error: profileError } = await supabase
    .from('asset_profiles')
    .select('*')
    .eq('company_id', companyId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  return mergeAssetProfile(profile, source);
}

export function extractManualProfileUpdates(body: Record<string, any>) {
  const updates: Record<string, any> = {};
  const manualData: Record<string, any> = {};
  const manualOverrideFields: string[] = [];

  PROFILE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = normalizeValue(body[field]);
      manualData[field] = normalizeValue(body[field]);
      manualOverrideFields.push(field);
    }
  });

  if (Object.prototype.hasOwnProperty.call(body, 'customer_visible')) {
    updates.customer_visible = Boolean(body.customer_visible);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'include_in_health_score')) {
    updates.include_in_health_score = Boolean(body.include_in_health_score);
  }

  return { updates, manualData, manualOverrideFields };
}

function getAutoProfileFields(
  sourceType: AssetSourceType,
  source: any,
  autoFields: Record<string, any>
) {
  return sourceType === 'server'
    ? {
        display_name: source.hostname,
        operating_system: autoFields.operating_system,
        operating_system_version: autoFields.operating_system_version,
        manufacturer: autoFields.manufacturer,
        model: autoFields.model,
        serial_number: autoFields.serial_number,
        physical_or_virtual: autoFields.physical_or_virtual,
      }
    : {
        display_name: source.device_name,
        asset_type: normalizeAssetType(source.device_type),
        manufacturer: autoFields.manufacturer,
        model: autoFields.model,
        firmware_version: autoFields.firmware_version,
        location: source.location,
      };
}

function inferAssetType(sourceType: AssetSourceType, source: any) {
  if (sourceType === 'server') return 'servidor';
  return normalizeAssetType(source.device_type);
}

function normalizeAssetType(value?: string) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('switch')) return 'switch';
  if (normalized.includes('router')) return 'roteador';
  if (normalized.includes('firewall')) return 'firewall';
  if (normalized.includes('access point')) return 'access_point';
  return 'outro';
}

function normalizeValue(value: any) {
  return typeof value === 'string' ? value.trim() || null : value ?? null;
}
