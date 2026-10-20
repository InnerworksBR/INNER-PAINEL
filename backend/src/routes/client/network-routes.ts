import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { buildAssetDetail } from '../../services/asset-profile-service';
import { applyNetworkFreshness } from '../../services/network-freshness-service';
import { loadCompanyRows } from '../../services/portal-data-service';

function safeNetworkDevice(row: any) {
  const { snmp_community: _community, community_string: _legacyCommunity, ...safe } = row;
  if (safe.telemetry && typeof safe.telemetry === 'object') {
    const telemetry = applyNetworkFreshness(safe.telemetry);
    return { ...applyNetworkFreshness({ ...safe, ...telemetry }), telemetry };
  }
  return applyNetworkFreshness(safe);
}

async function visibleNetworkRows(db: any, companyId: string | null) {
  const profiles = await loadCompanyRows(db, 'asset_profiles', companyId, { source_type: 'network_device', customer_visible: 'true' });
  const visible = new Set(profiles.map((p: any) => `${p.company_id}:${p.source_id}`));
  const devices = await loadCompanyRows(db, 'network_devices', companyId);
  return devices.filter((d: any) => visible.has(`${d.company_id}:${d.id}`)).map(safeNetworkDevice);
}

export default async function clientNetworkRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/devices', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      return (await visibleNetworkRows(supabaseAdmin, targetCompanyId)).sort((a: any, b: any) => String(a.device_name).localeCompare(String(b.device_name)));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  fastify.get('/stats', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    let allDevices: any[];
    try { allDevices = await visibleNetworkRows(supabaseAdmin, targetCompanyId); }
    catch (error: any) { return reply.code(500).send({ error: error.message }); }
    const total = allDevices.length;
    const withFreshness = allDevices.map(safeNetworkDevice);
    const online = withFreshness.filter((d: any) => d.telemetry_status === 'fresh' && d.status === 'Online').length;
    const uptimeValues = allDevices.map((d: any) => d.uptime_percent).filter((value: any) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);
    const avgUptime = uptimeValues.length > 0 ? Number((uptimeValues.reduce((a: number, b: number) => a + b, 0) / uptimeValues.length).toFixed(2)) : null;
    const byType: Record<string, number> = {};
    allDevices.forEach((d: any) => {
      byType[d.device_type] = (byType[d.device_type] || 0) + 1;
    });
    return { total, online, offline: withFreshness.filter((d: any) => d.telemetry_status === 'fresh' && d.status === 'Offline').length, no_response: withFreshness.filter((d: any) => d.telemetry_status === 'fresh' && d.status === 'Sem resposta SNMP').length, no_data: withFreshness.filter((d: any) => d.telemetry_status === 'no_data').length, stale: withFreshness.filter((d: any) => d.telemetry_status === 'stale').length, avgUptime, uptime_measured_count: uptimeValues.length, uptime_coverage_percent: total ? Number((uptimeValues.length * 100 / total).toFixed(2)) : 0, byType };
  });

  fastify.get('/events', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      const { data, error } = await supabaseAdmin.rpc('get_visible_network_events', { p_company_id: targetCompanyId, p_limit: 50 });
      if (error) return reply.code(500).send({ error: error.message });
      return data || [];
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
    const { data: profile } = await supabaseAdmin.from('asset_profiles').select('source_id').eq('company_id', device.company_id).eq('source_type', 'network_device').eq('source_id', id).eq('customer_visible', true).maybeSingle();
    if (!profile) return reply.code(404).send({ error: 'Equipamento não encontrado' });

    if (device.monitoring_source !== 'agent_snmp') {
      const { data: sameNameDevices, error: sameNameError } = await supabaseAdmin.from('network_devices')
        .select('id').eq('company_id', device.company_id).eq('device_name', device.device_name);
      if (sameNameError) return reply.code(500).send({ error: sameNameError.message });
      if (!Array.isArray(sameNameDevices) || sameNameDevices.length !== 1 || sameNameDevices[0]?.id !== id) return [];
    }

    let historyQuery = supabaseAdmin
      .from('network_status_history')
      .select('*')
      .eq('company_id', device.company_id)
      .order('collected_at', { ascending: false })
      .limit(100);
    historyQuery = device.monitoring_source === 'agent_snmp'
      ? historyQuery.eq('network_device_id', id)
      : historyQuery.eq('device_name', device.device_name).is('network_device_id', null);
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
