// src/routes/client/glpi-routes.ts
import type { FastifyInstance } from 'fastify';
import { syncTickets, getTicketDetails } from '../../services/glpi-service';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';

export default async function clientGlpiRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Buscar tickets do GLPI (do banco de dados)
  fastify.get('/tickets', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let query = supabaseAdmin.from('glpi_tickets').select('*').order('created_at', { ascending: false });
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
      const { data, error } = await query;
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  // Buscar detalhes e histórico de um chamado específico
  fastify.get<{ Params: { id: string } }>('/tickets/:id', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      
      // Validação de escopo: o chamado deve pertencer à empresa do usuário
      const { data: ticketCache, error: cacheError } = await supabaseAdmin
        .from('glpi_tickets')
        .select('id')
        .eq('company_id', targetCompanyId)
        .eq('glpi_id', parseInt(id, 10))
        .single();
        
      if (cacheError || !ticketCache) {
        return reply.code(404).send({ error: 'Chamado não encontrado ou permissão negada' });
      }

      const result = await getTicketDetails(supabaseAdmin, targetCompanyId || '', parseInt(id, 10));
      return result;
    } catch (err: any) {
      if (err.name === 'CompanyScopeError') return sendCompanyScopeError(reply, err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // Estatísticas de chamados
  fastify.get('/stats', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    let query = supabaseAdmin.from('glpi_tickets').select('*');
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
    } catch (err) {
      return sendCompanyScopeError(reply, err);
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
    // Conta tickets com SLA conhecido (Dentro ou Fora do SLA), excluindo N/A e "Em Análise"
    const slaConhecido = allTickets.filter((t: any) =>
      t.sla_status === 'Dentro do SLA' || t.sla_status === 'Fora do SLA'
    ).length;
    // SLA percentual: só conta os tickets que têm SLA conhecido
    // (tickets sem dados suficientes não devem derrubar a métrica)
    const slaPercentage = slaConhecido > 0 ? ((slaOk / slaConhecido) * 100).toFixed(1) : '0';

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
      slaOk,
      slaOut: slaConhecido - slaOk,
      slaUnknown: total - slaConhecido,
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
