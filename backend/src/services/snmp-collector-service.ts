// src/services/snmp-collector-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertMonitoringEvents } from './monitoring-events-service';

type SnmpVersion = '1' | '2c';

interface SnmpDevice {
  ip_address: string;
  device_name?: string;
  device_type?: string;
  status?: string;
  uptime?: number;
  sysdescr?: string;
  if_count?: number;
  community?: string;
  snmp_data?: Record<string, unknown>;
}

interface CollectorConfig {
  id: string;
  company_id: string;
  name: string;
  collector_host?: string;
  ip_range_start?: string;
  ip_range_end?: string;
  community_string: string;
  snmp_version: SnmpVersion;
  snmp_port: number;
  enabled: boolean;
  interval_seconds: number;
}

/**
 * Executa coleta SNMP em um range de IPs
 * Retorna lista de dispositivos descobertos
 */
export async function executeSnmpCollection(
  supabase: SupabaseClient,
  collectorId: string
): Promise<{ success: boolean; devices_found: number; error?: string; duration_ms?: number }> {
  const startTime = Date.now();

  // 1. Obter configuração do coletor
  const { data: collector, error: colErr } = await supabase
    .from('snmp_collectors')
    .select('*')
    .eq('id', collectorId)
    .single();

  if (colErr || !collector) {
    return { success: false, devices_found: 0, error: 'Coletor não encontrado' };
  }

  if (!collector.enabled) {
    return { success: false, devices_found: 0, error: 'Coletor desabilitado' };
  }

  // 2. Gerar IPs do range
  const ips = generateIpRange(collector.ip_range_start, collector.ip_range_end);
  if (ips.length === 0) {
    return { success: false, devices_found: 0, error: 'Range IP inválido' };
  }

  // Limitar a 254 IPs por execução
  const limitedIps = ips.slice(0, 254);
  let devicesFound = 0;
  const now = new Date().toISOString();

  // 3. Para cada IP, tentar SNMP
  // Implementação futura: usar biblioteca SNMP real
  // Por enquanto, simula a descoberta
  const devices: SnmpDevice[] = [];

  for (const ip of limitedIps) {
    try {
      const device = await snmpWalk(ip, collector);
      if (device) {
        devices.push(device);
        devicesFound++;
      }
    } catch (err) {
      // Device não respondeu - ignorar
      continue;
    }
  }

  // 4. Upsert dispositivos no banco
  for (const device of devices) {
    const deviceName = device.device_name || `Device-${device.ip_address}`;
    const deviceType = device.device_type || inferDeviceType(device.sysdescr || '', device.device_name || '');

    // Buscar device anterior
    const { data: existing } = await supabase
      .from('network_devices')
      .select('id, status')
      .eq('company_id', collector.company_id)
      .eq('ip_address', device.ip_address)
      .single();

    const previousStatus = existing?.status;
    const currentStatus = device.status === 'up' ? 'Online' : 'Offline';

    // Upsert device
    await supabase.from('network_devices').upsert(
      {
        company_id: collector.company_id,
        device_name: deviceName,
        device_type: deviceType,
        location: 'Rede Local',
        ip_address: device.ip_address,
        uptime_percent: device.uptime ? 100 : 0,
        status: currentStatus,
        snmp_collector_id: collectorId,
        snmp_uptime: device.uptime,
        snmp_last_poll: now,
        snmp_sysdescr: device.sysdescr,
        snmp_if_count: device.if_count,
        snmp_community: collector.community_string,
        monitoring_source: 'agent_native',
        last_updated: now,
      },
      { onConflict: 'company_id,device_name' }
    );

    // Gerar evento se mudou
    if (previousStatus && previousStatus !== currentStatus) {
      await insertMonitoringEvents(supabase, [{
        companyId: collector.company_id,
        source: 'network',
        entityName: deviceName,
        entityType: deviceType,
        previousStatus,
        currentStatus,
        severity: currentStatus === 'Offline' ? 'warning' : 'info',
        message: currentStatus === 'Offline'
          ? `Device ${deviceName} (${device.ip_address}) está offline.`
          : `Device ${deviceName} (${device.ip_address}) voltou ao normal.`,
        metadata: { ip: device.ip_address, device_type: deviceType },
      }]);
    }
  }

  const durationMs = Date.now() - startTime;

  // 5. Atualizar status do coletor
  await supabase
    .from('snmp_collectors')
    .update({
      last_run_at: now,
      last_run_duration_ms: durationMs,
      last_devices_found: devicesFound,
      last_status: devicesFound > 0 ? 'success' : 'partial',
      updated_at: now,
    })
    .eq('id', collectorId);

  return {
    success: true,
    devices_found: devicesFound,
    duration_ms: durationMs,
  };
}

/**
 * Simula SNMP GET/WALK em um IP
 * NO MVP: Esta função será substituída pela implementação real do coletor Windows
 * Por enquanto, retorna null para IPs não alcançáveis
 */
async function snmpWalk(ip: string, collector: CollectorConfig): Promise<SnmpDevice | null> {
  // NO MVP: Implementação stub
  // Em produção, usar biblioteca como node-net-snmp ou snmp-native
  // Exemplo futuro:
  // const session = snmp.createSession(ip, collector.snmp_port, { community: collector.community_string, version: collector.snmp_version });
  // const sysDescr = await getOid(session, '1.3.6.1.2.1.1.1.0');
  // session.close();

  // Por ora, retorna null (device não encontrado)
  return null;
}

/**
 * Gera lista de IPs entre start e end
 */
function generateIpRange(start?: string, end?: string): string[] {
  if (!start || !end) return [];

  try {
    const startParts = start.split('.').map(Number);
    const endParts = end.split('.').map(Number);

    if (startParts.length !== 4 || endParts.length !== 4) return [];

    const startNum = startParts[0] * 256 ** 3 + startParts[1] * 256 ** 2 + startParts[2] * 256 + startParts[3];
    const endNum = endParts[0] * 256 ** 3 + endParts[1] * 256 ** 2 + endParts[2] * 256 + endParts[3];

    if (endNum < startNum || endNum - startNum > 254) return [];

    const ips: string[] = [];
    for (let i = startNum; i <= endNum; i++) {
      const b1 = Math.floor(i / 256 ** 3) % 256;
      const b2 = Math.floor(i / 256 ** 2) % 256;
      const b3 = Math.floor(i / 256) % 256;
      const b4 = i % 256;
      ips.push(`${b1}.${b2}.${b3}.${b4}`);
    }
    return ips;
  } catch {
    return [];
  }
}

/**
 * Infere tipo de dispositivo baseado em sysdescr e nome
 */
function inferDeviceType(sysdescr: string, deviceName: string): string {
  const combined = `${sysdescr} ${deviceName}`.toLowerCase();

  if (combined.includes('cisco') || combined.includes('catalyst') || combined.includes('ios')) {
    return 'Switch';
  }

  if (combined.includes('hp ') || combined.includes('procurve') || combined.includes('aruba')) {
    return 'Switch';
  }

  if (combined.includes('mikrotik') || combined.includes('routeros')) {
    return 'Router';
  }

  if (combined.includes('ubiquiti') || combined.includes('unifi') || combined.includes('aircube')) {
    return 'Access Point';
  }

  if (combined.includes('fortinet') || combined.includes('fortigate') || combined.includes('pfsense')) {
    return 'Firewall';
  }

  if (combined.includes('printer') || combined.includes('laserjet') || combined.includes('mfc') || combined.includes('impressora')) {
    return 'Printer';
  }

  if (combined.includes('temperature') || combined.includes('sensor') || combined.includes('ambiente') || combined.includes('temp')) {
    return 'Sensor';
  }

  if (combined.includes('tp-link') || combined.includes('d-link') || combined.includes('netgear')) {
    return 'Switch';
  }

  return 'Outro';
}

/**
 * Cria um novo coletor SNMP
 */
export async function createSnmpCollector(
  supabase: SupabaseClient,
  config: {
    company_id: string;
    name: string;
    collector_host?: string;
    ip_range_start: string;
    ip_range_end: string;
    community_string: string;
    snmp_version?: SnmpVersion;
    snmp_port?: number;
    interval_seconds?: number;
  }
): Promise<{ success: boolean; collector?: CollectorConfig; error?: string }> {
  const { data, error } = await supabase
    .from('snmp_collectors')
    .insert({
      company_id: config.company_id,
      name: config.name,
      collector_host: config.collector_host,
      ip_range_start: config.ip_range_start,
      ip_range_end: config.ip_range_end,
      community_string: config.community_string,
      snmp_version: config.snmp_version || '2c',
      snmp_port: config.snmp_port || 161,
      interval_seconds: config.interval_seconds || 300,
      enabled: true,
    })
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Erro ao criar coletor' };
  }

  return { success: true, collector: data as CollectorConfig };
}

/**
 * Atualiza coletor SNMP
 */
export async function updateSnmpCollector(
  supabase: SupabaseClient,
  collectorId: string,
  updates: Partial<{
    name: string;
    collector_host: string;
    ip_range_start: string;
    ip_range_end: string;
    community_string: string;
    snmp_version: SnmpVersion;
    snmp_port: number;
    interval_seconds: number;
    enabled: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('snmp_collectors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', collectorId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Lista coletores de uma empresa
 */
export async function listSnmpCollectors(
  supabase: SupabaseClient,
  companyId: string
): Promise<CollectorConfig[]> {
  const { data, error } = await supabase
    .from('snmp_collectors')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  if (error) {
    console.error('Erro ao listar coletores:', error);
    return [];
  }

  return (data || []) as CollectorConfig[];
}

/**
 * Remove coletor SNMP
 */
export async function deleteSnmpCollector(
  supabase: SupabaseClient,
  collectorId: string
): Promise<{ success: boolean; error?: string }> {
  // Primeiro, desvincular devices associados
  await supabase
    .from('network_devices')
    .update({ snmp_collector_id: null, snmp_last_poll: null })
    .eq('snmp_collector_id', collectorId);

  // Depois, deletar o coletor
  const { error } = await supabase
    .from('snmp_collectors')
    .delete()
    .eq('id', collectorId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
