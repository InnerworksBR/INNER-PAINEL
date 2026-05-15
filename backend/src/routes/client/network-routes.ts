import type { FastifyInstance } from 'fastify';
import { fetchZabbixNetworkDevices } from '../../services/zabbix-service';
import type { JWTPayload } from '../../types';
import { writeAdminAuditLog } from '../../services/audit-service';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { buildAssetDetail } from '../../services/asset-profile-service';

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
      return data;
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
    const online = allDevices.filter((d: any) => d.status === 'Online').length;
    const avgUptime = total > 0
      ? (allDevices.reduce((acc: number, d: any) => acc + (d.uptime_percent || 0), 0) / total).toFixed(2)
      : '0';
    const byType: Record<string, number> = {};
    allDevices.forEach((d: any) => {
      byType[d.device_type] = (byType[d.device_type] || 0) + 1;
    });
    return { total, online, offline: total - online, avgUptime: parseFloat(avgUptime), byType };
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
      .select('id, company_id, device_name')
      .eq('id', id)
      .single();
    if (deviceError || !device) return reply.code(404).send({ error: 'Equipamento não encontrado' });
    if (targetCompanyId && device.company_id !== targetCompanyId) {
      return reply.code(403).send({ error: 'Sem permissão para acessar este equipamento' });
    }

    const { data, error } = await supabaseAdmin
      .from('network_status_history')
      .select('*')
      .eq('company_id', device.company_id)
      .eq('device_name', device.device_name)
      .order('collected_at', { ascending: false })
      .limit(100);
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
    return detail;
  });

  fastify.post<{ Body: { company_id?: string } }>('/sync', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    if (user.role !== 'admin') return reply.code(403).send({ error: 'Apenas administradores podem sincronizar' });
    const company_id = request.body?.company_id || user.company_id;
    if (!company_id) return reply.code(400).send({ error: 'company_id é obrigatório' });
    try {
      const result = await fetchZabbixNetworkDevices(supabaseAdmin, company_id);
      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'sync.manual',
        entityType: 'network',
        companyId: company_id,
        summary: 'Sync manual de rede executado',
        metadata: result,
      });
      return result;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
