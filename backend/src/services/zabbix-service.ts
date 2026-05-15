// src/services/zabbix-service.ts
import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSyncError, recordSyncSuccess } from './integration-status-service';
import { isDetailedLoggingEnabled } from './settings-service';
import { insertMonitoringEvents } from './monitoring-events-service';
import { decryptSecret } from './crypto-service';
import { insertNetworkStatusHistory, insertServerMetricHistory } from './history-service';
import { upsertAssetProfileFromSource } from './asset-profile-service';

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
      selectGroups: ['name'],
      filter: { status: '0' },
      output: ['hostid', 'name', 'status', 'available', 'snmp_available', 'ipmi_available', 'jmx_available'],
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
    const itemsByHostId = await getItemsByHostId(zabbix_api_url, token, serverHosts.map((h: any) => h.hostid));
    serverHosts.forEach((host: any) => {
      host.items = itemsByHostId.get(String(host.hostid)) || [];
    });

    // 🔍 DEBUG: Mostra chaves de itens do primeiro servidor no terminal
    const detailedLogs = await isDetailedLoggingEnabled(supabase);
    if (detailedLogs && serverHosts.length > 0) {
      const firstHost = serverHosts[0];
      const allKeys = (firstHost.items || []).map((i: any) => `  ${i.key_} = "${i.lastvalue}"`).join('\n');
      console.log(`\n[ZABBIX DEBUG] Servidor: ${firstHost.name}\n[ZABBIX DEBUG] Itens disponíveis:\n${allKeys}\n`);
    }

    const previousServerStatuses = await getPreviousStatuses(supabase, 'servers', company_id, 'hostname');
    const previousServers = await getPreviousServers(supabase, company_id);

    const serversToUpsert = serverHosts.map((h: any) => {
      const items = h.items || [];
      const previousServer = previousServers.get(h.name);
      // Items de CPU - Busca por chave exata ou padrão comum
      const cpuItem = items.find((i: any) => 
        i.key_ === 'system.cpu.util' || 
        i.key_ === 'system.cpu.utilization' ||
        i.key_.toLowerCase().includes('processor time') ||
        i.key_.toLowerCase().includes('cpu.util')
      );
      
      // Items de Memória (%)
      const memPavailItem = items.find((i: any) => 
        i.key_ === 'vm.memory.size[pavailable]' || 
        i.key_.toLowerCase().includes('memory.pavailable')
      );
      const memUtilItem = items.find((i: any) => 
        i.key_ === 'vm.memory.util' || 
        i.key_ === 'vm.memory.utilization' || 
        i.key_.toLowerCase().includes('memory.util') ||
        i.key_.toLowerCase().includes('memory.pused')
      );
      
      // Items de Memória (Absolutos em Bytes)
      const memTotalItem = items.find((i: any) => 
        i.key_ === 'vm.memory.size[total]' || 
        i.key_.toLowerCase().includes('memory.total') ||
        i.key_.toLowerCase().includes('physical.memory')
      );
      const memAvailItem = items.find((i: any) => 
        i.key_ === 'vm.memory.size[available]' || 
        i.key_.toLowerCase().includes('memory.available')
      );
      const memUsedItem = items.find((i: any) => 
        i.key_ === 'vm.memory.size[used]' || 
        i.key_.toLowerCase().includes('memory.used')
      );

      const disk = getDiskMetrics(items);

      const pingItem = items.find((i: any) => i.key_ === 'icmpping' || i.key_ === 'agent.ping');

      // Conversão para GB (Bytes -> GB)
      const toGB = (bytes: any) => bytes ? parseFloat((parseFloat(bytes) / 1024 / 1024 / 1024).toFixed(2)) : 0;

      const cpuVal = hasCollectedNumericValue(cpuItem) ? parseFloat(cpuItem.lastvalue) : 0;

      // Cálculo de memória
      let memTotal = hasCollectedNumericValue(memTotalItem, { requirePositive: true }) ? toGB(memTotalItem?.lastvalue) : 0;
      let memUsed = 0;
      if (hasCollectedNumericValue(memUsedItem, { requirePositive: true })) {
        memUsed = toGB(memUsedItem.lastvalue);
      } else if (hasCollectedNumericValue(memAvailItem) && memTotal > 0) {
        memUsed = parseFloat((memTotal - toGB(memAvailItem.lastvalue)).toFixed(2));
      }

      let memPercent = 0;
      if (hasCollectedNumericValue(memUtilItem)) {
        memPercent = parseFloat(memUtilItem.lastvalue);
      } else if (hasCollectedNumericValue(memPavailItem)) {
        memPercent = 100 - parseFloat(memPavailItem.lastvalue);
      } else if (memTotal > 0 && memUsed > 0) {
        memPercent = (memUsed / memTotal) * 100;
      }
      memPercent = parseFloat(memPercent.toFixed(2));

      const hasMemoryAbsolute = memTotal > 0 || memUsed > 0;
      const hasDiskData = disk.hasData;

      if (!hasMemoryAbsolute && previousServer) {
        memTotal = previousServer.memory_total || 0;
        memUsed = previousServer.memory_used || 0;
      }

      const diskPercent = hasDiskData ? disk.percent : previousServer?.disk_usage || 0;
      const diskTotal = hasDiskData ? disk.totalGb : previousServer?.disk_total || 0;
      const diskUsed = hasDiskData ? disk.usedGb : previousServer?.disk_used || 0;

      const pingVal = hasCollectedNumericValue(pingItem) ? parseFloat(pingItem.lastvalue) : 0;

      // Status: prioridade para os campos de availability do Zabbix
      let status = 'Offline';
      const isAvailable = h.available === '1' || h.snmp_available === '1' || h.ipmi_available === '1' || h.jmx_available === '1';
      const hasRecentMetrics = [cpuItem, memUtilItem, memPavailItem, memTotalItem, memUsedItem, memAvailItem, disk.lastItem]
        .some((item: any) => hasCollectedNumericValue(item));
      const warnings = [];
      
      if (isAvailable || pingVal === 1) {
        status = 'Online';
      } else if (hasRecentMetrics) {
        // Fallback: se o Zabbix não reporta availability mas temos dados recentes ou ping
        status = 'Atencao';
      }

      if (pingItem && pingVal !== 1) warnings.push('Agente Zabbix sem resposta');
      if (!hasCollectedNumericValue(cpuItem)) warnings.push('CPU sem coleta recente');
      if (!hasMemoryAbsolute) warnings.push('Memoria total/usada sem coleta recente');
      if (!hasDiskData) warnings.push('Disco sem coleta recente');

      return {
        company_id,
        zabbix_host_id: String(h.hostid),
        hostname: h.name,
        cpu_usage: parseFloat(cpuVal.toFixed(2)),
        memory_usage: parseFloat(memPercent.toFixed(2)),
        disk_usage: parseFloat(diskPercent.toFixed(2)),
        memory_total: memTotal,
        memory_used: memUsed,
        disk_total: diskTotal,
        disk_used: diskUsed,
        status,
        zabbix_last_data_at: getLatestItemDate(items),
        zabbix_agent_available: isAvailable || pingVal === 1,
        zabbix_sync_warning: warnings.length > 0 ? warnings.join('; ') : null,
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

      const { data: syncedServers, error: syncedServersError } = await supabase
        .from('servers')
        .select('*')
        .eq('company_id', company_id)
        .in('hostname', serversToUpsert.map((server: any) => server.hostname));
      if (syncedServersError) throw syncedServersError;
      const serverHostMap = new Map<string, any>(serverHosts.map((host: any) => [host.name, host]));
      for (const server of syncedServers || []) {
        const host = serverHostMap.get(server.hostname);
        await upsertAssetProfileFromSource(supabase, 'server', server, extractServerProfileFields(host?.items || []));
      }
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

      const { data: syncedDevices, error: syncedDevicesError } = await supabase
        .from('network_devices')
        .select('*')
        .eq('company_id', company_id)
        .in('device_name', devicesToUpsert.map((device: any) => device.device_name));
      if (syncedDevicesError) throw syncedDevicesError;
      const networkHostMap = new Map<string, any>(networkHosts.map((host: any) => [host.name, host]));
      for (const device of syncedDevices || []) {
        const host = networkHostMap.get(device.device_name);
        await upsertAssetProfileFromSource(supabase, 'network_device', device, extractNetworkProfileFields(host?.items || []));
      }
    }

    await recordSyncSuccess(supabase, company_id, 'zabbix_network', devicesToUpsert.length);
    return { message: 'Dispositivos de rede sincronizados', count: devicesToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização de rede Zabbix (Company ${company_id}):`, error.message);
    await recordSyncError(supabase, company_id, 'zabbix_network', error.message);
    throw new Error('Erro na sincronização de rede: ' + error.message);
  }
}

async function getItemsByHostId(
  zabbixApiUrl: string,
  token: string,
  hostIds: string[]
): Promise<Map<string, any[]>> {
  if (hostIds.length === 0) return new Map();

  const response = await axios.post(zabbixApiUrl, {
    jsonrpc: '2.0',
    method: 'item.get',
    params: {
      hostids: hostIds,
      output: ['itemid', 'hostid', 'key_', 'name', 'lastvalue', 'units', 'lastclock', 'state', 'status', 'error'],
    },
    id: 20,
    auth: token,
  });

  if (response.data.error) {
    throw new Error(response.data.error.data || response.data.error.message || 'Falha ao buscar itens do Zabbix');
  }

  const byHost = new Map<string, any[]>();
  (response.data.result || []).forEach((item: any) => {
    const hostId = String(item.hostid);
    const current = byHost.get(hostId) || [];
    current.push(item);
    byHost.set(hostId, current);
  });

  return byHost;
}

function hasCollectedNumericValue(
  item: any,
  options: { requirePositive?: boolean } = {}
): boolean {
  if (!item) return false;
  if (String(item.status) === '1' || String(item.state) === '1') return false;

  const value = Number.parseFloat(item.lastvalue);
  if (!Number.isFinite(value)) return false;
  if (options.requirePositive && value <= 0) return false;

  const lastClock = Number.parseInt(item.lastclock || '0', 10);
  if (value === 0 && lastClock <= 0) return false;

  return true;
}

function getLatestItemDate(items: any[]): string | null {
  const latestClock = Math.max(
    0,
    ...items
      .map((item) => Number.parseInt(item.lastclock || '0', 10))
      .filter((clock) => Number.isFinite(clock))
  );

  return latestClock > 0 ? new Date(latestClock * 1000).toISOString() : null;
}

async function getPreviousServers(
  supabase: SupabaseClient,
  companyId: string
): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('servers')
    .select('hostname, memory_total, memory_used, disk_usage, disk_total, disk_used')
    .eq('company_id', companyId);

  if (error) {
    console.error('Erro ao buscar dados anteriores dos servidores:', error.message);
    return new Map();
  }

  return new Map((data || []).map((row: any) => [row.hostname, row]));
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

function getDiskMetrics(items: any[]): { percent: number; totalGb: number; usedGb: number; hasData: boolean; mount?: string; lastItem?: any } {
  const entries = new Map<string, { total?: number; used?: number; pused?: number; lastItem?: any }>();

  items.forEach((item: any) => {
    // 1. Tentar padrão vfs.fs.size[...] ou vfs.fs.dependent.size[...]
    let match = String(item.key_ || '').match(/^vfs\.fs\.(?:dependent\.)?size\[(.+),\s*(total|used|pused)\]$/);
    
    if (match) {
      const mount = normalizeMount(match[1]);
      if (isIgnoredFilesystem(mount)) return;

      const metric = match[2] as 'total' | 'used' | 'pused';
      if (!hasCollectedNumericValue(item, { requirePositive: metric === 'total' })) return;
      const value = Number.parseFloat(item.lastvalue);

      const current = entries.get(mount) || {};
      current[metric] = value;
      current.lastItem = newerItem(current.lastItem, item);
      entries.set(mount, current);
      return;
    }

    if (String(item.key_ || '').startsWith('vfs.fs.') && String(item.key_ || '').includes(',data]')) {
      const data = parseFilesystemData(item);
      if (!data || isIgnoredFilesystem(data.mount)) return;

      const current = entries.get(data.mount) || {};
      if (data.total !== undefined) current.total = data.total;
      if (data.used !== undefined) current.used = data.used;
      if (data.pused !== undefined) current.pused = data.pused;
      current.lastItem = newerItem(current.lastItem, item);
      entries.set(data.mount, current);
      return;
    }

    // 2. Tentar padrão vfs.fs.total[...] ou vfs.fs.used[...] (alguns templates customizados)
    match = String(item.key_ || '').match(/^vfs\.fs\.(?:total|used)\[(.+)\]$/);
    if (match) {
      const mount = normalizeMount(match[1]);
      if (isIgnoredFilesystem(mount)) return;

      const metric = item.key_.includes('total') ? 'total' : 'used';
      if (!hasCollectedNumericValue(item, { requirePositive: metric === 'total' })) return;
      const value = Number.parseFloat(item.lastvalue);

      const current = entries.get(mount) || {};
      current[metric] = value;
      current.lastItem = newerItem(current.lastItem, item);
      entries.set(mount, current);
    }
  });

  // 3. Fallback fuzzy: buscar qualquer item que contenha disco/fs e total/used
  if (entries.size === 0) {
    items.forEach((item: any) => {
      const k = String(item.key_ || '').toLowerCase();
      if (!k.includes('vfs.fs') && !k.includes('disk')) return;

      let metric: 'total' | 'used' | 'pused' | null = null;
      if (k.includes('total')) metric = 'total';
      else if (k.includes('pused') || k.includes('utilization')) metric = 'pused';
      else if (k.includes('used')) metric = 'used';
      
      if (!metric) return;

      if (!hasCollectedNumericValue(item, { requirePositive: true })) return;
      const value = Number.parseFloat(item.lastvalue);

      // Tentar extrair o nome do disco (ex: C:, /, etc)
      const mountMatch = k.match(/\[(.+?)\]/);
      const mount = mountMatch ? normalizeMount(mountMatch[1]) : 'default';
      
      const current = entries.get(mount) || {};
      if (current[metric] === undefined || current[metric] === 0) {
        current[metric] = value;
        current.lastItem = newerItem(current.lastItem, item);
        entries.set(mount, current);
      }
    });
  }

  const candidates = Array.from(entries.entries())
    .filter(([, value]) => (value.total || 0) > 0 || (value.used || 0) > 0 || (value.pused || 0) > 0)
    .sort(([mountA, a], [mountB, b]) => {
      const scoreA = mountScore(mountA, a.total || 0);
      const scoreB = mountScore(mountB, b.total || 0);
      return scoreB - scoreA;
    });

  const [mount, selected] = candidates[0] || [];
  if (!selected) return { percent: 0, totalGb: 0, usedGb: 0, hasData: false };

  const totalGb = bytesToGb(selected.total);
  const usedGb = bytesToGb(selected.used);
  const percent = selected.pused !== undefined
    ? Number(selected.pused.toFixed(2))
    : selected.total && selected.used
      ? Number(((selected.used / selected.total) * 100).toFixed(2))
      : 0;

  return { percent, totalGb, usedGb, hasData: true, mount, lastItem: selected.lastItem };
}

function parseFilesystemData(item: any): { mount: string; total?: number; used?: number; pused?: number } | null {
  if (!item?.lastvalue || Number.parseInt(item.lastclock || '0', 10) <= 0) return null;

  try {
    const parsed = JSON.parse(item.lastvalue);
    const bytes = parsed?.bytes;
    const mount = normalizeMount(parsed?.fsname || String(item.key_ || '').match(/\[(.+?),/)?.[1] || '');
    if (!mount || !bytes) return null;

    return {
      mount,
      total: Number.isFinite(Number(bytes.total)) ? Number(bytes.total) : undefined,
      used: Number.isFinite(Number(bytes.used)) ? Number(bytes.used) : undefined,
      pused: Number.isFinite(Number(bytes.pused)) ? Number(bytes.pused) : undefined,
    };
  } catch {
    return null;
  }
}

function newerItem(current: any, next: any): any {
  const currentClock = Number.parseInt(current?.lastclock || '0', 10);
  const nextClock = Number.parseInt(next?.lastclock || '0', 10);
  return nextClock >= currentClock ? next : current;
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

      const wentOffline = row.status === 'Offline';
      const hasWarning = row.status === 'Atencao';
      const sourceLabel = source === 'server' ? 'Servidor' : 'Equipamento de rede';
      return {
        companyId,
        source,
        entityName: row.name,
        entityType: row.type,
        previousStatus,
        currentStatus: row.status,
        severity: wentOffline ? 'critical' as const : hasWarning ? 'warning' as const : 'info' as const,
        message: wentOffline
          ? `${sourceLabel} ${row.name} caiu ou ficou indisponivel.`
          : hasWarning
            ? `${sourceLabel} ${row.name} esta com coleta parcial no Zabbix.`
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
      severity: 'info' | 'warning' | 'critical';
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

function extractServerProfileFields(items: any[]) {
  const valueByKeys = (...patterns: string[]) => findItemValue(items, patterns);
  const systemDescription = valueByKeys('system.uname', 'system.sw.os', 'system.sw.os.get');
  const osMatch = systemDescription?.match(/^(Windows|Linux|Ubuntu|Debian|CentOS|Red Hat|Rocky|AlmaLinux|macOS)[^0-9]*/i);
  return compact({
    operating_system: valueByKeys('system.sw.os', 'system.sw.os.get') || osMatch?.[1],
    operating_system_version: valueByKeys('system.sw.os.version', 'system.sw.os.release'),
    manufacturer: valueByKeys('system.hw.chassis[manufacturer]', 'system.hw.vendor'),
    model: valueByKeys('system.hw.chassis[model]', 'system.hw.model'),
    serial_number: valueByKeys('system.hw.chassis[serial]', 'system.hw.serialnumber'),
    physical_or_virtual: inferVirtualization(valueByKeys('system.hw.chassis[type]', 'system.sw.arch', 'system.uname')),
  });
}

function extractNetworkProfileFields(items: any[]) {
  return compact({
    manufacturer: findItemValue(items, ['system.vendor', 'device.vendor', 'snmp.sysdescr']),
    model: findItemValue(items, ['system.hw.model', 'device.model', 'snmp.sysdescr']),
    firmware_version: findItemValue(items, ['system.sw.version', 'device.firmware', 'snmp.sysdescr']),
  });
}

function findItemValue(items: any[], patterns: string[]) {
  const item = items.find((entry: any) => patterns.some((pattern) => String(entry.key_ || '').toLowerCase().includes(pattern.toLowerCase())));
  return item?.lastvalue || undefined;
}

function inferVirtualization(value?: string) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return undefined;
  if (['vmware', 'virtual', 'hyper-v', 'kvm', 'xen'].some((token) => normalized.includes(token))) return 'virtual';
  return 'fisico';
}

function compact<T extends Record<string, any>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')) as Partial<T>;
}
