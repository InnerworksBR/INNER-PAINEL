// src/routes/admin/agents-routes.ts
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import type { JWTPayload } from '../../types';
import { writeAdminAuditLog } from '../../services/audit-service';

export default async function adminAgentsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Middleware: verificar perfil admin
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

  // 1. Listar Tokens de Ativação
  fastify.get('/tokens', async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('agent_activation_tokens')
      .select(`
        *,
        companies (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // 2. Criar Token de Ativação para Empresa
  fastify.post('/tokens', async (request, reply) => {
    const body = request.body as any;
    const { company_id, label = 'Token de Instalação', days_valid = 30 } = body || {};

    if (!company_id) {
      return reply.code(400).send({ error: 'company_id é obrigatório.' });
    }

    const token = `INNER-KEY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const expires_at = new Date(Date.now() + days_valid * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('agent_activation_tokens')
      .insert({
        company_id,
        token,
        label,
        expires_at,
        is_active: true,
      })
      .select(`
        *,
        companies (id, name)
      `)
      .single();

    if (error || !data) {
      return reply.code(500).send({ error: error?.message || 'Erro ao gerar token' });
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'CREATE_ACTIVATION_TOKEN',
      entityType: 'agent_activation_token',
      companyId: company_id,
      summary: `Criado token de ativação: ${label}`,
      metadata: { company_id, token_id: data.id, label },
    });

    return reply.send(data);
  });

  // 3. Revogar Token de Ativação
  fastify.post<{ Params: { id: string } }>('/tokens/:id/revoke', async (request, reply) => {
    const { id } = request.params;

    const { error } = await supabaseAdmin
      .from('agent_activation_tokens')
      .update({ is_active: false })
      .eq('id', id);

    if (error) return reply.code(500).send({ error: error.message });

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'REVOKE_ACTIVATION_TOKEN',
      entityType: 'agent_activation_token',
      entityId: id,
      summary: `Revogado token de ativação ID: ${id}`,
      metadata: { token_id: id },
    });

    return reply.send({ message: 'Token revogado com sucesso.' });
  });

  // 4. Listar Agentes e Coletores Registrados
  fastify.get('/list', async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('registered_agents')
      .select(`
        *,
        companies (id, name)
      `)
      .order('last_heartbeat', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });

    // Calcular status dinâmico em tempo real (Offline se sem heartbeat há > 3m)
    const now = Date.now();
    const result = (data || []).map((agent: any) => {
      const lastHb = new Date(agent.last_heartbeat).getTime();
      const isOffline = now - lastHb > 3 * 60 * 1000;
      return {
        ...agent,
        computed_status: isOffline ? 'Offline' : agent.status,
      };
    });

    return result;
  });

  // 5. Excluir/Revogar Agente Registrado
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const { error } = await supabaseAdmin
      .from('registered_agents')
      .delete()
      .eq('id', id);

    if (error) return reply.code(500).send({ error: error.message });

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'DELETE_REGISTERED_AGENT',
      entityType: 'registered_agent',
      entityId: id,
      summary: `Removido agente registrado ID: ${id}`,
      metadata: { agent_id: id },
    });

    return reply.send({ message: 'Agente removido com sucesso.' });
  });
}
