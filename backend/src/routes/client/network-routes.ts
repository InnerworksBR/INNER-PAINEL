import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { buildAssetDetail } from '../../services/asset-profile-service';
import { applyNetworkFreshness } from '../../services/network-freshness-service';

function safeNetworkDevice(row: any) {
  const { snmp_community: _community, community_string: _legacyCommunity, ...safe } = row;
  return applyNetworkFreshness(safe);
}

export default async function clientNetworkRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/devices', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let visibleProfiles = supabaseAdmin
        .from('asset_profiles')
        .select('source_id')
        .eq('source_type', 'network_device')
        .eq('customer_visible', true);
      if (targetCompanyId) visibleProfiles = visibleProfiles.eq('company_id', targetCompanyId);
      const { data: profiles, error: profilesError } = await visibleProfiles;
      if (profilesError) return reply.code(500).send({ error: profilesError.message });
      const visibleIds = (profiles || []).map((profile: any) => profile.source_id);
      if (visibleIds.length === 0) return [];

      let query = supabaseAdmin.from('network_devices').select('*').in('id', visibleIds);
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
      const { data, error } = await query.order('device_name');
      if (error) return reply.code(500).send({ error: error.message });
      return (data || []).map(safeNetworkDevice);
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  fastify.get('/stats', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    let targetCompanyId: string | null = null;
    let visibleProfiles = supabaseAdmin
      .from('asset_profiles')
      .select('source_id')
      .eq('source_type', 'network_device')
      .eq('customer_visible', true);
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
      if (targetCompanyId) visibleProfiles = visibleProfiles.eq('company_id', targetCompanyId);
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    const { data: profiles, error: profilesError } = await visibleProfiles;
    if (profilesError) return reply.code(500).send({ error: profilesError.message });
    const visibleIds = (profiles || []).map((profile: any) => profile.source_id);
    if (visibleIds.length === 0) return { total: 0, online: 0, offline: 0, avgUptime: 0, byType: {} };
    let query = supabaseAdmin.from('network_devices').select('*').in('id', visibleIds);
    if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
    const { data: devices, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    const allDevices = devices || [];
    const total = allDevices.length;
    const withFreshness = allDevices.map(safeNetworkDevice);
    const online = withFreshness.filter((d: any) => d.telemetry_status === 'fresh' && d.status === 'Online').length;
    const avgUptime = total > 0
      ? (allDevices.reduce((acc: number, d: any) => acc + (d.uptime_percent || 0), 0) / total).toFixed(2)
      : '0';
    const byType: Record<string, number> = {};
    allDevices.forEach((d: any) => {
      byType[d.device_type] = (byType[d.device_type] || 0) + 1;
    });
    return { total, online, offline: withFreshness.filter((d: any) => d.telemetry_status === 'fresh' && d.status === 'Offline').length, no_data: withFreshness.filter((d: any) => d.telemetry_status === 'no_data').length, stale: withFreshness.filter((d: any) => d.telemetry_status === 'stale').length, avgUptime: parseFloat(avgUptime), byType };
  });

  fastify.get('/events', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let query = supabaseAdmin
        .from('monitoring_events')
        .select('*')
        .eq('source', 'network')
        .order('created_at', { ascending: false })
        .limit(50);
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
      const { data, error } = await query;
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  fastify.get<{ Params: { id: string } }>('/devices/:id/history', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    const { data: device, error: deviceError } = await supabaseAdmin
      .from('network_devices')
      .select('id, company_id, device_name, monitoring_source')
      .eq('id', id)
      .single();
    if (deviceError || !device) return reply.code(404).send({ error: 'Equipamento não encontrado' });
    if (targetCompanyId && device.company_id !== targetCompanyId) {
      return reply.code(403).send({ error: 'Sem permissão para acessar este equipamento' });
    }

    let historyQuery = supabaseAdmin
      .from('network_status_history')
      .select('*')
      .eq('company_id', device.company_id)
      .order('collected_at', { ascending: false })
      .limit(100);
    historyQuery = device.monitoring_source === 'agent_snmp'
      ? historyQuery.eq('network_device_id', id)
      : historyQuery.eq('device_name', device.device_name);
    const { data, error } = await historyQuery;
    if (error) return reply.code(500).send({ error: error.message });
    return (data || []).reverse();
  });

  fastify.get<{ Params: { id: string } }>('/devices/:id/details', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
    if (!targetCompanyId) return reply.code(400).send({ error: 'company_id é obrigatório' });

    const detail = await buildAssetDetail(supabaseAdmin, 'network_device', id, targetCompanyId);
    if (!detail) return reply.code(404).send({ error: 'Equipamento não encontrado' });
    if (!detail.customer_visible) return reply.code(404).send({ error: 'Equipamento não encontrado' });
    return safeNetworkDevice(detail);
  });

  fastify.post<{ Body: { company_id?: string } }>('/sync', async (request, reply) => {
    return reply.code(410).send({ error: 'Sincronização de rede via Zabbix foi descontinuada.' });
  });
}
