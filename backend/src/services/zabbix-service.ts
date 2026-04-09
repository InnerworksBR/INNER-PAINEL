// src/services/zabbix-service.ts
import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';

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

    const { zabbix_api_url, zabbix_user, zabbix_password } = integrations;
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

    const serversToUpsert = serverHosts.map((h: any) => {
      const cpuItem = h.items?.find((i: any) => i.key_ === 'system.cpu.util');
      const memItem = h.items?.find((i: any) =>
        i.key_ === 'vm.memory.util' || i.key_ === 'vm.memory.size[pused]'
      );
      const diskItem = h.items?.find((i: any) =>
        i.key_ === 'vfs.fs.size[/,pused]' || i.key_.startsWith('vfs.fs.size')
      );
      const pingItem = h.items?.find((i: any) => i.key_ === 'icmpping');

      return {
        company_id,
        hostname: h.name,
        cpu_usage: cpuItem ? parseFloat(parseFloat(cpuItem.lastvalue).toFixed(2)) : 0,
        memory_usage: memItem ? parseFloat(parseFloat(memItem.lastvalue).toFixed(2)) : 0,
        disk_usage: diskItem ? parseFloat(parseFloat(diskItem.lastvalue).toFixed(2)) : 0,
        status: (pingItem && parseFloat(pingItem.lastvalue) === 1) ? 'Online' : 'Offline',
        last_updated: new Date().toISOString(),
      };
    });

    // 3. Upsert no Supabase
    if (serversToUpsert.length > 0) {
      const { error } = await supabase
        .from('servers')
        .upsert(serversToUpsert, { onConflict: 'company_id,hostname' });

      if (error) throw error;
    }

    return { message: 'Métricas Zabbix sincronizadas', count: serversToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização Zabbix (Company ${company_id}):`, error.message);
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

    const { zabbix_api_url, zabbix_user, zabbix_password } = integrations;
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

    console.log(`[Zabbix Network] Encontrados ${networkHosts.length} equipamentos de rede.`);

    const devicesToUpsert = networkHosts.map((h: any) => {
      const pingItem = h.items?.find((i: any) => i.key_ === 'icmpping');
      const uptimeItem = h.items?.find((i: any) => i.key_ === 'system.uptime');
      const ip = h.interfaces?.[0]?.ip || '';

      return {
        company_id,
        device_name: h.name,
        device_type: guessDeviceType(h),
        location: '',
        ip_address: ip,
        uptime_percent: 0, // Would need historical data to calculate
        status: (pingItem && parseFloat(pingItem.lastvalue) === 1) ? 'Online' : 'Offline',
        last_updated: new Date().toISOString(),
      };
    });

    if (devicesToUpsert.length > 0) {
      const { error } = await supabase
        .from('network_devices')
        .upsert(devicesToUpsert, { onConflict: 'company_id,device_name' });

      if (error) throw error;
    }

    return { message: 'Dispositivos de rede sincronizados', count: devicesToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização de rede Zabbix (Company ${company_id}):`, error.message);
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
