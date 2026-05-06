// src/routes/client/network-routes.ts
import type { FastifyInstance } from 'fastify';
import { fetchZabbixNetworkDevices } from '../../services/zabbix-service';
import type { JWTPayload } from '../../types';
import { writeAdminAuditLog } from '../../services/audit-service';

export default async function clientNetworkRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Buscar equipamentos de rede
  fastify.get('/devices', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('network_devices').select('*');

    if (user.role !== 'admin') {
      if (!user.company_id) return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query.order('device_name');
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Estatísticas de rede
  fastify.get('/stats', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('network_devices').select('*');

    if (user.role !== 'admin') {
      if (!user.company_id) return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      query = query.eq('company_id', user.company_id);
    }

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

    return {
      total,
      online,
      offline: total - online,
      avgUptime: parseFloat(avgUptime),
      byType,
    };
  });

  // Forçar sincronização de dispositivos de rede
  fastify.get('/events', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin
      .from('monitoring_events')
      .select('*')
      .eq('source', 'network')
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

  fastify.get<{ Params: { id: string } }>('/devices/:id/history', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;

    const { data: device, error: deviceError } = await supabaseAdmin
      .from('network_devices')
      .select('id, company_id, device_name')
      .eq('id', id)
      .single();

    if (deviceError || !device) return reply.code(404).send({ error: 'Equipamento não encontrado' });
    if (user.role !== 'admin' && device.company_id !== user.company_id) {
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

  fastify.post<{ Body: { company_id?: string } }>('/sync', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Apenas administradores podem sincronizar' });
    }

    const company_id = request.body?.company_id || user.company_id;
    if (!company_id) {
      return reply.code(400).send({ error: 'company_id é obrigatório' });
    }

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
