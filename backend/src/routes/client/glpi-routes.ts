// src/routes/client/glpi-routes.ts
import type { FastifyInstance } from 'fastify';
import { syncTickets } from '../../services/glpi-service';
import type { JWTPayload } from '../../types';

export default async function clientGlpiRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Buscar tickets do GLPI (do banco de dados)
  fastify.get('/tickets', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('glpi_tickets').select('*').order('created_at', { ascending: false });

    if (user.role !== 'admin') {
      if (!user.company_id) {
        return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      }
      query = query.eq('company_id', user.company_id);
    }

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Estatísticas de chamados
  fastify.get('/stats', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('glpi_tickets').select('*');

    if (user.role !== 'admin') {
      if (!user.company_id) {
        return reply.code(403).send({ error: 'Usuário sem empresa associada' });
      }
      query = query.eq('company_id', user.company_id);
    }

    const { data: tickets, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    const allTickets = tickets || [];
    const total = allTickets.length;

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byRequester: Record<string, number> = {};

    allTickets.forEach((t: any) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.priority) byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.category) byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      if (t.requester) byRequester[t.requester] = (byRequester[t.requester] || 0) + 1;
    });

    const openCount = allTickets.filter((t: any) =>
      !['Resolvido', 'Fechado', '5', '6'].includes(t.status)
    ).length;

    const resolvedCount = allTickets.filter((t: any) =>
      ['Resolvido', 'Fechado', '5', '6'].includes(t.status)
    ).length;

    const slaOk = allTickets.filter((t: any) => t.sla_status === 'Dentro do SLA').length;
    const slaPercentage = total > 0 ? ((slaOk / total) * 100).toFixed(1) : '0';

    // Top requerentes
    const topRequesters = Object.entries(byRequester)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      open: openCount,
      resolved: resolvedCount,
      slaPercentage: parseFloat(slaPercentage),
      byStatus,
      byPriority,
      byCategory,
      topRequesters,
    };
  });

  // Forçar sincronização com GLPI — FIX B1: usar supabaseAdmin em vez de supabase
  fastify.post<{ Body: { company_id?: string } }>('/sync', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Apenas administradores podem forçar sincronização' });
    }

    const company_id = request.body?.company_id || user.company_id;
    if (!company_id) {
      return reply.code(400).send({ error: 'company_id é obrigatório' });
    }

    try {
      const result = await syncTickets(supabaseAdmin, company_id);
      return result;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
