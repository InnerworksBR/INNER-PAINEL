// src/routes/client/metrics-routes.ts
import type { FastifyInstance } from 'fastify';
import { syncMS365Metrics } from '../../services/ms-graph-service';
import type { JWTPayload } from '../../types';
import { writeAdminAuditLog } from '../../services/audit-service';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { buildAssetDetail } from '../../services/asset-profile-service';
import { formatSseEvent } from '../../services/sse-service';
import { applyServerFreshness } from '../../services/monitoring-freshness-service';
import { loadCompanyRows } from '../../services/portal-data-service';

export default async function clientMetricsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Buscar métricas do Microsoft 365
  fastify.get('/ms365', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let query = supabaseAdmin.from('ms365_metrics').select('*');
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
      const { data, error } = await query;
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  // Buscar métricas de Servidores (agentes nativos)
  fastify.get('/servers', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);

      // Buscar servidores que foram monitorados por agente nativo
      // Inclui tanto hosts quanto VMs
      const data = await loadCompanyRows(supabaseAdmin, 'servers', targetCompanyId, { monitoring_source: 'agent_native' });
      return data.sort((a, b) => String(a.hostname).localeCompare(String(b.hostname))).map(applyServerFreshness);
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  fastify.get('/servers/events', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let query = supabaseAdmin
        .from('monitoring_events')
        .select('*')
        .eq('source', 'server')
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

  fastify.get('/servers/stream', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    let targetCompanyId: string | null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let closed = false;
    let writing = false;
    let timer: NodeJS.Timeout | null = null;
    const closeStream = () => {
      closed = true;
      if (timer) clearInterval(timer);
    };
    request.raw.once('close', closeStream);

    const sendSnapshot = async () => {
      if (closed || writing) return;
      writing = true;
      try {
        const { servers, events } = await loadServerStreamSnapshot(supabaseAdmin, targetCompanyId);
        if (!closed) {
          reply.raw.write(formatSseEvent('monitoring', {
            servers,
            events,
            sent_at: new Date().toISOString(),
          }));
        }
      } catch (error) {
        request.log.warn({ err: error }, 'Falha ao atualizar stream de monitoramento');
      } finally {
        writing = false;
      }
    };

    await sendSnapshot();
    timer = setInterval(() => void sendSnapshot(), 5000);
  });

  fastify.get<{ Params: { id: string } }>('/servers/:id/history', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    const { data: server, error: serverError } = await supabaseAdmin
      .from('servers')
      .select('id, company_id, hostname')
      .eq('id', id)
      .single();

    if (serverError || !server) return reply.code(404).send({ error: 'Servidor não encontrado' });
    if (targetCompanyId && server.company_id !== targetCompanyId) {
      return reply.code(403).send({ error: 'Sem permissão para acessar este servidor' });
    }

    const { data, error } = await supabaseAdmin
      .from('server_metric_history')
      .select('*')
      .eq('company_id', server.company_id)
      .eq('hostname', server.hostname)
      .order('collected_at', { ascending: false })
      .limit(100);

    if (error) return reply.code(500).send({ error: error.message });
    return (data || []).reverse();
  });

  fastify.get<{ Params: { id: string } }>('/servers/:id/details', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { id } = request.params;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
    if (!targetCompanyId) return reply.code(400).send({ error: 'company_id é obrigatório' });

    const detail = await buildAssetDetail(supabaseAdmin, 'server', id, targetCompanyId);
    if (!detail) return reply.code(404).send({ error: 'Servidor não encontrado' });
    if (!detail.customer_visible) return reply.code(404).send({ error: 'Servidor não encontrado' });
    return detail;
  });

  // Forçar sincronização — FIX B2: usar supabaseAdmin em vez de supabase
  fastify.post<{ Params: { type: string }; Body: { company_id?: string; host_ids?: string[] } }>('/sync/:type', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const { type } = request.params;
    const { company_id } = request.body || {};

    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Apenas administradores podem sincronizar' });
    }

    const targetCompanyId = company_id || user.company_id;
    if (!targetCompanyId) {
      return reply.code(400).send({ error: 'company_id é obrigatório' });
    }

    try {
      if (type === 'ms365') {
        const result = await syncMS365Metrics(supabaseAdmin, targetCompanyId);
        await writeAdminAuditLog(supabaseAdmin, request, {
          action: 'sync.manual',
          entityType: 'ms365',
          companyId: targetCompanyId,
          summary: 'Sync manual MS365 executado',
          metadata: result,
        });
        return result;
      } else if (type === 'glpi') {
        const { syncTickets } = await import('../../services/glpi-service');
        const result = await syncTickets(supabaseAdmin, targetCompanyId);
        await writeAdminAuditLog(supabaseAdmin, request, {
          action: 'sync.manual',
          entityType: 'glpi',
          companyId: targetCompanyId,
          summary: 'Sync manual GLPI executado',
          metadata: result,
        });
        return result;
      }
      return reply.code(400).send({ error: 'Tipo de sincronização inválido. Use: ms365 ou glpi' });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

}

async function loadServerStreamSnapshot(supabaseAdmin: any, companyId: string | null) {
  const servers = await loadCompanyRows(supabaseAdmin, 'servers', companyId, { monitoring_source: 'agent_native' });
  servers.sort((a, b) => String(a.hostname).localeCompare(String(b.hostname)));

  let eventsQuery = supabaseAdmin
    .from('monitoring_events')
    .select('*')
    .eq('source', 'server')
    .order('created_at', { ascending: false })
    .limit(50);
  if (companyId) eventsQuery = eventsQuery.eq('company_id', companyId);
  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) throw eventsError;

  return { servers: (servers || []).map(applyServerFreshness), events: events || [] };
}
