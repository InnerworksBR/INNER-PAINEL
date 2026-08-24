// src/routes/admin/snmp-routes.ts
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { writeAdminAuditLog } from '../../services/audit-service';
import {
  createSnmpCollector,
  updateSnmpCollector,
  deleteSnmpCollector,
  listSnmpCollectors,
  executeSnmpCollection,
} from '../../services/snmp-collector-service';

export default async function adminSnmpRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  // Middleware de autenticação e admin
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return reply.code(403).send({ error: 'Acesso restrito a administradores.' });
    }
  });

  // 1. Listar coletores SNMP de uma empresa
  fastify.get<{ Params: { companyId: string } }>(
    '/collectors/company/:companyId',
    async (request, reply) => {
      const { companyId } = request.params;

      const collectors = await listSnmpCollectors(supabaseAdmin, companyId);

      return collectors.map((collector) => ({
        ...collector,
        community_string: collector.community_string ? '******' : null, // Mascarar
      }));
    }
  );

  // 2. Listar todos os coletores (admin)
  fastify.get('/collectors', async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('snmp_collectors')
      .select('*, companies(id, name)')
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });

    return (data || []).map((collector: any) => ({
      ...collector,
      community_string: collector.community_string ? '******' : null,
    }));
  });

  // 3. Criar coletor SNMP
  fastify.post('/collectors', async (request, reply) => {
    const body = request.body as any;
    const {
      company_id,
      name,
      collector_host,
      ip_range_start,
      ip_range_end,
      community_string,
      snmp_version = '2c',
      snmp_port = 161,
      interval_seconds = 300,
    } = body || {};

    if (!company_id || !name || !ip_range_start || !ip_range_end || !community_string) {
      return reply.code(400).send({
        error: 'company_id, name, ip_range_start, ip_range_end e community_string são obrigatórios.',
      });
    }

    // Validar range IP
    if (!isValidIp(ip_range_start) || !isValidIp(ip_range_end)) {
      return reply.code(400).send({ error: 'IP range inválido.' });
    }

    const result = await createSnmpCollector(supabaseAdmin, {
      company_id,
      name,
      collector_host,
      ip_range_start,
      ip_range_end,
      community_string,
      snmp_version: snmp_version as '1' | '2c',
      snmp_port,
      interval_seconds,
    });

    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'CREATE_SNMP_COLLECTOR',
      entityType: 'snmp_collector',
      entityId: result.collector?.id,
      companyId: company_id,
      summary: `Criado coletor SNMP: ${name} (${ip_range_start} - ${ip_range_end})`,
      metadata: { collector_id: result.collector?.id, company_id, name },
    });

    return reply.send({
      ...result.collector,
      community_string: '******',
    });
  });

  // 4. Atualizar coletor SNMP
  fastify.patch<{ Params: { id: string } }>('/collectors/:id', async (request, reply) => {
    const { id } = request.params;
    const body = request.body as any;

    const {
      name,
      collector_host,
      ip_range_start,
      ip_range_end,
      community_string,
      snmp_version,
      snmp_port,
      interval_seconds,
      enabled,
    } = body || {};

    // Validar IP range se fornecido
    if (ip_range_start && !isValidIp(ip_range_start)) {
      return reply.code(400).send({ error: 'ip_range_start inválido.' });
    }
    if (ip_range_end && !isValidIp(ip_range_end)) {
      return reply.code(400).send({ error: 'ip_range_end inválido.' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (collector_host !== undefined) updates.collector_host = collector_host;
    if (ip_range_start !== undefined) updates.ip_range_start = ip_range_start;
    if (ip_range_end !== undefined) updates.ip_range_end = ip_range_end;
    if (community_string !== undefined) updates.community_string = community_string;
    if (snmp_version !== undefined) updates.snmp_version = snmp_version;
    if (snmp_port !== undefined) updates.snmp_port = snmp_port;
    if (interval_seconds !== undefined) updates.interval_seconds = interval_seconds;
    if (enabled !== undefined) updates.enabled = enabled;

    const result = await updateSnmpCollector(supabaseAdmin, id, updates);

    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }

    // Buscar collector atualizado
    const { data: collector } = await supabaseAdmin
      .from('snmp_collectors')
      .select('*, companies(id, name)')
      .eq('id', id)
      .single();

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'UPDATE_SNMP_COLLECTOR',
      entityType: 'snmp_collector',
      entityId: id,
      summary: `Atualizado coletor SNMP ID: ${id}`,
      metadata: { collector_id: id, updates: Object.keys(updates) },
    });

    return reply.send({
      ...collector,
      community_string: collector?.community_string ? '******' : null,
    });
  });

  // 5. Deletar coletor SNMP
  fastify.delete<{ Params: { id: string } }>('/collectors/:id', async (request, reply) => {
    const { id } = request.params;

    // Buscar antes de deletar para auditoria
    const { data: collector } = await supabaseAdmin
      .from('snmp_collectors')
      .select('id, name, company_id')
      .eq('id', id)
      .single();

    const result = await deleteSnmpCollector(supabaseAdmin, id);

    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'DELETE_SNMP_COLLECTOR',
      entityType: 'snmp_collector',
      entityId: id,
      companyId: collector?.company_id,
      summary: `Removido coletor SNMP: ${collector?.name || id}`,
      metadata: { collector_id: id },
    });

    return reply.send({ message: 'Coletor SNMP removido com sucesso.' });
  });

  // 6. Disparar coleta manual
  fastify.post<{ Params: { id: string } }>('/collectors/:id/collect', async (request, reply) => {
    const { id } = request.params;

    const result = await executeSnmpCollection(supabaseAdmin, id);

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'TRIGGER_SNMP_COLLECTION',
      entityType: 'snmp_collector',
      entityId: id,
      summary: result.success
        ? `Coleta SNMP disparada: ${result.devices_found} devices encontrados`
        : `Coleta SNMP falhou: ${result.error}`,
      metadata: {
        collector_id: id,
        devices_found: result.devices_found,
        duration_ms: result.duration_ms,
        success: result.success,
      },
    });

    if (!result.success) {
      return reply.code(500).send({
        error: result.error,
        status: 'failed',
      });
    }

    return reply.send({
      status: 'success',
      devices_found: result.devices_found,
      duration_ms: result.duration_ms,
      message: `Coleta concluída: ${result.devices_found} dispositivos encontrados`,
    });
  });

  // 7. Ver detalhes de um coletor (com community original se permitido)
  fastify.get<{ Params: { id: string } }>('/collectors/:id', async (request, reply) => {
    const { id } = request.params;
    const showSecret = (request.query as any)?.show_secret === 'true';

    const { data: collector, error } = await supabaseAdmin
      .from('snmp_collectors')
      .select('*, companies(id, name)')
      .eq('id', id)
      .single();

    if (error || !collector) {
      return reply.code(404).send({ error: 'Coletor não encontrado.' });
    }

    return {
      ...collector,
      community_string: showSecret ? collector.community_string : '******',
    };
  });
}

// Helper para validar IP
function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}
