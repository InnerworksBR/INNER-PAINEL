import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { loadCompanyRows } from '../../services/portal-data-service';

export default async function monthlyGlpiReportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/reports', async (request, reply) => {
    try {
      const { user } = request.user as JWTPayload;
      const { targetCompanyId } = await resolveCompanyScope(fastify.supabaseAdmin, user, (request.query as any)?.company_id);
      if (!targetCompanyId) return reply.code(400).send({ error: 'Selecione uma empresa' });
      const reports = (await loadCompanyRows(fastify.supabaseAdmin, 'monthly_glpi_reports', targetCompanyId)).filter(report => report.metrics && report.analysis && report.generated_at);
      return reports.sort((a, b) => String(b.period_start).localeCompare(String(a.period_start))).map(({ id, period_start, metrics, analysis, generated_at }) => ({ id, period_start, metrics, analysis, generated_at }));
    } catch (error) { return sendCompanyScopeError(reply, error); }
  });
}
