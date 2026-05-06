// src/services/zabbix-service.ts
import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSyncError, recordSyncSuccess } from './integration-status-service';
import { isDetailedLoggingEnabled } from './settings-service';
import { insertMonitoringEvents } from './monitoring-events-service';
import { decryptSecret } from './crypto-service';
import { insertNetworkStatusHistory, insertServerMetricHistory } from './history-service';

async function getZabbixAuthToken(url: string, user: string, password: string): Promise<string> {
  const payload = {
    jsonrpc: '2.0',
    method: 'user.login',
    params: { username: user, password },
    id: 1,
    auth: null,
  };

  try {
    const response = await axios.post(url, payload);
    if (response.data.error) throw new Error(response.data.error.data);
    return response.data.result;
  } catch (error: any) {
    console.error('Erro no login Zabbix:', error.message);
    throw new Error('Falha na autenticação com Zabbix: ' + error.message);
  }
}

export async function fetchZabbixMetrics(
  supabase: SupabaseClient,
  company_id: string,
  host_ids?: string[]
): Promise<{ message: string; count: number }> {
  try {
    // 1. Buscar credenciais
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('zabbix_api_url, zabbix_user, zabbix_password')
      .eq('company_id', company_id)
      .single();

    if (intError || !integrations || !integrations.zabbix_api_url) {
      throw new Error('Credenciais do Zabbix não configuradas para esta empresa.');
    }

    const { zabbix_api_url, zabbix_user } = integrations;
    const zabbix_password = decryptSecret(integrations.zabbix_password);
    if (!zabbix_user || !zabbix_password) {
      throw new Error('Usuário ou senha do Zabbix não configurados para esta empresa.');
    }
    const token = await getZabbixAuthToken(zabbix_api_url, zabbix_user, zabbix_password);

    // 2. Buscar hosts e seus dados
    const hostParams: any = {
      selectInterfaces: ['ip'],
      selectItems: ['key_', 'lastvalue', 'units'],
      selectGroups: ['name'],
      filter: { status: '0' },
    };

    if (host_ids && host_ids.length > 0) {
      hostParams.hostids = host_ids;
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'host.get',
      params: hostParams,
      id: 2,
      auth: token,
    };

    const response = await axios.post(zabbix_api_url, payload);
    const hosts = response.data.result;

    if (!hosts) throw new Error('Falha ao buscar hosts no Zabbix');

    const serverHosts = hosts.filter((h: any) => !isNetworkHost(h));

    // 🔍 DEBUG: Mostra chaves de itens do primeiro servidor no terminal
    const detailedLogs = await isDetailedLoggingEnabled(supabase);
    if (detailedLogs && serverHosts.length > 0) {
      const firstHost = serverHosts[0];
      const allKeys = (firstHost.items || []).map((i: any) => `  ${i.key_} = "${i.lastvalue}"`).join('\n');
      console.log(`\n[ZABBIX DEBUG] Servidor: ${firstHost.name}\n[ZABBIX DEBUG] Itens disponíveis:\n${allKeys}\n`);
    }

    const previousServerStatuses = await getPreviousStatuses(supabase, 'servers', company_id, 'hostname');

    const serversToUpsert = serverHosts.map((h: any) => {
      // Items de CPU
      const cpuItem = h.items?.find((i: any) => i.key_ === 'system.cpu.util');
      
      // Items de Memória (%)
      const memPavailItem = h.items?.find((i: any) =>
        i.key_ === 'vm.memory.size[pavailable]' || i.key_ === 'vm.memory.util'
      );
      
      // Items de Memória (Absolutos em Bytes)
      const memTotalItem = h.items?.find((i: any) => i.key_ === 'vm.memory.size[total]');
      const memAvailItem = h.items?.find((i: any) => i.key_ === 'vm.memory.size[available]');

      const disk = getDiskMetrics(h.items || []);

      const pingItem = h.items?.find((i: any) => i.key_ === 'icmpping' || i.key_ === 'agent.ping');

      // Conversão para GB (Bytes -> GB)
      const toGB = (bytes: any) => bytes ? parseFloat((parseFloat(bytes) / 1024 / 1024 / 1024).toFixed(2)) : 0;

      const cpuVal = cpuItem ? parseFloat(cpuItem.lastvalue) : 0;

      // Percentual de memória: se tiver pavailable, calcula pused = 100 - pavailable
      const memPavailVal = memPavailItem ? parseFloat(memPavailItem.lastvalue) : null;
      const memPercent = memPavailVal !== null ? parseFloat((100 - memPavailVal).toFixed(2)) : 0;

      const memTotal = toGB(memTotalItem?.lastvalue);
      const memAvailable = toGB(memAvailItem?.lastvalue);
      const memUsed = memTotal > 0 ? parseFloat((memTotal - memAvailable).toFixed(2)) : 0;

      const diskPercent = disk.percent;
      const diskTotal = disk.totalGb;
      const diskUsed = disk.usedGb;

      const pingVal = pingItem ? parseFloat(pingItem.lastvalue) : 0;

      // Se o ping for 1, ou se estivermos recebendo qualquer métrica de CPU/RAM, consideramos Online
      let status = 'Offline';
      if (pingVal === 1 || cpuVal > 0 || memPercent > 0) {
        status = 'Online';
      }

      return {
        company_id,
        hostname: h.name,
        cpu_usage: parseFloat(cpuVal.toFixed(2)),
        memory_usage: parseFloat(memPercent.toFixed(2)),
        disk_usage: parseFloat(diskPercent.toFixed(2)),
        memory_total: memTotal,
        memory_used: memUsed,
        disk_total: diskTotal,
        disk_used: diskUsed,
        status,
        last_updated: new Date().toISOString(),
      };
    });

    await insertMonitoringEvents(supabase, buildStatusChangeEvents({
      companyId: company_id,
      source: 'server',
      rows: serversToUpsert.map((server: any) => ({
        name: server.hostname,
        type: 'Servidor',
        status: server.status,
        metadata: {
          cpu_usage: server.cpu_usage,
          memory_usage: server.memory_usage,
          disk_usage: server.disk_usage,
          disk_total: server.disk_total,
          disk_used: server.disk_used,
        },
      })),
      previousStatuses: previousServerStatuses,
    }));

    // 3. Upsert no Supabase
    if (serversToUpsert.length > 0) {
      const { error } = await supabase
        .from('servers')
        .upsert(serversToUpsert, { onConflict: 'company_id,hostname' });

      if (error) throw error;
      await insertServerMetricHistory(supabase, serversToUpsert);
    }

    await recordSyncSuccess(supabase, company_id, 'zabbix', serversToUpsert.length);
    return { message: 'Métricas Zabbix sincronizadas', count: serversToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização Zabbix (Company ${company_id}):`, error.message);
    await recordSyncError(supabase, company_id, 'zabbix', error.message);
    throw new Error('Erro na sincronização Zabbix: ' + error.message);
  }
}

export async function fetchZabbixNetworkDevices(
  supabase: SupabaseClient,
  company_id: string
): Promise<{ message: string; count: number }> {
  try {
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('zabbix_api_url, zabbix_user, zabbix_password')
      .eq('company_id', company_id)
      .single();

    if (intError || !integrations || !integrations.zabbix_api_url) {
      throw new Error('Credenciais do Zabbix não configuradas para esta empresa.');
    }

    const { zabbix_api_url, zabbix_user } = integrations;
    const zabbix_password = decryptSecret(integrations.zabbix_password);
    if (!zabbix_user || !zabbix_password) {
      throw new Error('Usuário ou senha do Zabbix não configurados para esta empresa.');
    }
    const token = await getZabbixAuthToken(zabbix_api_url, zabbix_user, zabbix_password);

    // Buscar templates de rede (switches, routers, firewalls)
    const payload = {
      jsonrpc: '2.0',
      method: 'host.get',
      params: {
        selectInterfaces: ['ip'],
        selectItems: ['key_', 'lastvalue'],
        selectGroups: ['name'],
        filter: { status: '0' },
        // Filtrar por grupos típicos de rede — ajustável por empresa
        groupids: undefined,
      },
      id: 3,
      auth: token,
    };

    const response = await axios.post(zabbix_api_url, payload);
    const hosts = response.data.result || [];

    // Filtrar apenas hosts que parecem ser equipamentos de rede
    const networkHosts = hosts.filter((h: any) => isNetworkHost(h));

    if (await isDetailedLoggingEnabled(supabase)) {
      console.log(`[Zabbix Network] Encontrados ${networkHosts.length} equipamentos de rede.`);
    }

    const previousNetworkStatuses = await getPreviousStatuses(supabase, 'network_devices', company_id, 'device_name');

    const devicesToUpsert = networkHosts.map((h: any) => {
      const pingItem = h.items?.find((i: any) => i.key_ === 'icmpping' || i.key_ === 'agent.ping' || i.key_.includes('status'));
      const ip = h.interfaces?.[0]?.ip || '';
      
      const pingVal = pingItem ? parseFloat(pingItem.lastvalue) : 0;

      return {
        company_id,
        device_name: h.name,
        device_type: guessDeviceType(h),
        location: '',
        ip_address: ip,
        uptime_percent: 0, 
        status: (pingVal === 1 || pingVal >= 1) ? 'Online' : 'Offline',
        last_updated: new Date().toISOString(),
      };
    });

    await insertMonitoringEvents(supabase, buildStatusChangeEvents({
      companyId: company_id,
      source: 'network',
      rows: devicesToUpsert.map((device: any) => ({
        name: device.device_name,
        type: device.device_type,
        status: device.status,
        metadata: { ip_address: device.ip_address },
      })),
      previousStatuses: previousNetworkStatuses,
    }));

    if (devicesToUpsert.length > 0) {
      const { error } = await supabase
        .from('network_devices')
        .upsert(devicesToUpsert, { onConflict: 'company_id,device_name' });

      if (error) throw error;
      await insertNetworkStatusHistory(supabase, devicesToUpsert);
    }

    await recordSyncSuccess(supabase, company_id, 'zabbix_network', devicesToUpsert.length);
    return { message: 'Dispositivos de rede sincronizados', count: devicesToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização de rede Zabbix (Company ${company_id}):`, error.message);
    await recordSyncError(supabase, company_id, 'zabbix_network', error.message);
    throw new Error('Erro na sincronização de rede: ' + error.message);
  }
}

function guessDeviceType(host: any): string {
  const name = (host.name || '').toLowerCase();
  const groups = (host.groups || []).map((g: any) => g.name.toLowerCase()).join(' ');
  const combined = `${name} ${groups}`;

  if (combined.includes('switch')) return 'Switch';
  if (combined.includes('router') || combined.includes('mikrotik')) return 'Router';
  if (combined.includes('firewall') || combined.includes('fortigate')) return 'Firewall';
  if (combined.includes('ap') || combined.includes('access point') || combined.includes('wifi') || combined.includes('antena')) return 'Access Point';
  return 'Outro';
}

function getDiskMetrics(items: any[]): { percent: number; totalGb: number; usedGb: number; mount?: string } {
  const entries = new Map<string, { total?: number; used?: number; pused?: number }>();

  items.forEach((item: any) => {
    const match = String(item.key_ || '').match(/^vfs\.fs\.size\[(.+),\s*(total|used|pused)\]$/);
    if (!match) return;

    const mount = normalizeMount(match[1]);
    if (isIgnoredFilesystem(mount)) return;

    const metric = match[2] as 'total' | 'used' | 'pused';
    const value = Number.parseFloat(item.lastvalue);
    if (!Number.isFinite(value)) return;

    const current = entries.get(mount) || {};
    current[metric] = value;
    entries.set(mount, current);
  });

  const candidates = Array.from(entries.entries())
    .filter(([, value]) => (value.total || 0) > 0 || (value.used || 0) > 0 || (value.pused || 0) > 0)
    .sort(([mountA, a], [mountB, b]) => {
      const scoreA = mountScore(mountA, a.total || 0);
      const scoreB = mountScore(mountB, b.total || 0);
      return scoreB - scoreA;
    });

  const [mount, selected] = candidates[0] || [];
  if (!selected) return { percent: 0, totalGb: 0, usedGb: 0 };

  const totalGb = bytesToGb(selected.total);
  const usedGb = bytesToGb(selected.used);
  const percent = selected.pused !== undefined
    ? Number(selected.pused.toFixed(2))
    : selected.total && selected.used
      ? Number(((selected.used / selected.total) * 100).toFixed(2))
      : 0;

  return { percent, totalGb, usedGb, mount };
}

function normalizeMount(mount: string): string {
  return mount.replace(/\\+$/, '').trim();
}

function isIgnoredFilesystem(mount: string): boolean {
  const normalized = mount.toLowerCase();
  return ['tmpfs', 'devtmpfs', 'overlay', 'udev', 'shm'].some((ignored) => normalized.includes(ignored))
    || normalized.startsWith('/run')
    || normalized.startsWith('/boot')
    || normalized.startsWith('/snap');
}

function mountScore(mount: string, total: number): number {
  const normalized = mount.toLowerCase();
  if (normalized === 'c:' || normalized === '/') return Number.MAX_SAFE_INTEGER;
  if (/^[a-z]:$/i.test(mount)) return Number.MAX_SAFE_INTEGER - 1;
  return total;
}

function bytesToGb(bytes?: number): number {
  return bytes ? Number((bytes / 1024 / 1024 / 1024).toFixed(2)) : 0;
}

async function getPreviousStatuses(
  supabase: SupabaseClient,
  table: 'servers' | 'network_devices',
  companyId: string,
  nameField: 'hostname' | 'device_name'
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from(table)
    .select(`${nameField}, status`)
    .eq('company_id', companyId);

  if (error) {
    console.error('Erro ao buscar status anterior:', error.message);
    return new Map();
  }

  return new Map((data || []).map((row: any) => [row[nameField], row.status]));
}

function buildStatusChangeEvents({
  companyId,
  source,
  rows,
  previousStatuses,
}: {
  companyId: string;
  source: 'server' | 'network';
  rows: Array<{ name: string; type: string; status: string; metadata?: Record<string, unknown> }>;
  previousStatuses: Map<string, string>;
}) {
  return rows
    .map((row) => {
      const previousStatus = previousStatuses.get(row.name);
      if (!previousStatus || previousStatus === row.status) return null;

      const wentOffline = row.status !== 'Online';
      const sourceLabel = source === 'server' ? 'Servidor' : 'Equipamento de rede';
      return {
        companyId,
        source,
        entityName: row.name,
        entityType: row.type,
        previousStatus,
        currentStatus: row.status,
        severity: wentOffline ? 'critical' as const : 'info' as const,
        message: wentOffline
          ? `${sourceLabel} ${row.name} caiu ou ficou indisponível.`
          : `${sourceLabel} ${row.name} voltou a ficar online.`,
        metadata: row.metadata,
      };
    })
    .filter(Boolean) as Array<{
      companyId: string;
      source: 'server' | 'network';
      entityName: string;
      entityType: string;
      previousStatus: string;
      currentStatus: string;
      severity: 'info' | 'critical';
      message: string;
      metadata?: Record<string, unknown>;
    }>;
}

function isNetworkHost(host: any): boolean {
  const name = (host.name || '').toLowerCase();
  const groups = (host.groups || []).map((g: any) => g.name.toLowerCase()).join(' ');
  const combined = `${name} ${groups}`;

  const networkKeywords = [
    'network', 'switch', 'router', 'firewall', 'rede', 'mikrotik', 
    'antena', 'sensor', 'imp-', 'imp_', 'print', 'wifi', 'access point', 'ap-'
  ];

  if (name.startsWith('sw') && !name.includes('srv')) return true;
  if (name.includes('imp-') || name.includes('imp_') || combined.includes('imp_centro') || combined.includes('impressora')) return true;
  if (name.includes('sensor')) return true;

  return networkKeywords.some((g: string) => combined.includes(g));
}
