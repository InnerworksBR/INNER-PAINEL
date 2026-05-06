// src/routes/client/metrics-routes.ts
import type { FastifyInstance } from 'fastify';
import { syncMS365Metrics } from '../../services/ms-graph-service';
import { fetchZabbixMetrics } from '../../services/zabbix-service';
import type { JWTPayload } from '../../types';

export default async function clientMetricsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Buscar métricas do Microsoft 365
  fastify.get('/ms365', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('ms365_metrics').select('*');

    if (user.role !== 'admin') {
      if (!user.company_id) return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Buscar métricas de Servidores
  fastify.get('/servers', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('servers').select('*');

    if (user.role !== 'admin') {
      if (!user.company_id) return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  fastify.get('/servers/events', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin
      .from('monitoring_events')
      .select('*')
      .eq('source', 'server')
      .order('created_at', { ascending: false })
      .limit(50);

    if (user.role !== 'admin') {
      if (!user.company_id) return reply.code(403).send({ error: 'UsuÃ¡rio sem empresa associada' });
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Forçar sincronização — FIX B2: usar supabaseAdmin em vez de supabase
  fastify.post<{ Params: { type: string }; Body: { company_id?: string; host_ids?: string[] } }>('/sync/:type', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { type } = request.params;
    const { company_id, host_ids } = request.body || {};

    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Apenas administradores podem sincronizar' });
    }

    const targetCompanyId = company_id || user.company_id;
    if (!targetCompanyId) {
      return reply.code(400).send({ error: 'company_id é obrigatório' });
    }

    try {
      if (type === 'ms365') {
        return await syncMS365Metrics(supabaseAdmin, targetCompanyId);
      } else if (type === 'zabbix') {
        const { fetchZabbixMetrics, fetchZabbixNetworkDevices } = await import('../../services/zabbix-service');
        const srvResult = await fetchZabbixMetrics(supabaseAdmin, targetCompanyId, host_ids);
        const netResult = await fetchZabbixNetworkDevices(supabaseAdmin, targetCompanyId);
        return { 
          message: 'Sincronização Zabbix concluída (Servidores e Rede)', 
          servers: srvResult.count,
          network: netResult.count
        };
      } else if (type === 'glpi') {
        const { syncTickets } = await import('../../services/glpi-service');
        return await syncTickets(supabaseAdmin, targetCompanyId);
      }
      return reply.code(400).send({ error: 'Tipo de sincronização inválido. Use: ms365, zabbix ou glpi' });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Diagnóstico Zabbix — lista chaves de itens brutas (apenas admins)
  fastify.get('/zabbix-debug', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    if (user.role !== 'admin') return reply.code(403).send({ error: 'Apenas admins' });

    const companyId = (request.query as any).company_id || user.company_id;
    if (!companyId) return reply.code(400).send({ error: 'company_id obrigatório' });

    const { data: integrations } = await supabaseAdmin
      .from('company_integrations')
      .select('zabbix_api_url, zabbix_user, zabbix_password')
      .eq('company_id', companyId)
      .single();

    if (!integrations?.zabbix_api_url) {
      return reply.code(400).send({ error: 'Credenciais Zabbix não configuradas' });
    }

    const axiosModule = await import('axios');
    const { zabbix_api_url, zabbix_user, zabbix_password } = integrations;

    const loginRes = await axiosModule.default.post(zabbix_api_url, {
      jsonrpc: '2.0', method: 'user.login',
      params: { username: zabbix_user, password: zabbix_password },
      id: 1, auth: null,
    });
    const token = loginRes.data.result;

    const hostsRes = await axiosModule.default.post(zabbix_api_url, {
      jsonrpc: '2.0', method: 'host.get',
      params: {
        limit: 3,
        filter: { status: '0' },
        selectGroups: ['name'],
        selectItems: ['key_', 'lastvalue', 'name', 'units'],
      },
      id: 2, auth: token,
    });

    await axiosModule.default.post(zabbix_api_url, { jsonrpc: '2.0', method: 'user.logout', params: [], id: 3, auth: token }).catch(() => {});

    const hosts = hostsRes.data.result || [];
    return hosts.map((h: any) => ({
      hostname: h.name,
      groups: h.groups?.map((g: any) => g.name),
      items: (h.items || [])
        .filter((i: any) => {
          const k = i.key_;
          return k.includes('cpu') || k.includes('memory') || k.includes('vfs') || k.includes('icmp') || k.includes('agent');
        })
        .map((i: any) => ({ key: i.key_, name: i.name, value: i.lastvalue, unit: i.units })),
    }));
  });
}
