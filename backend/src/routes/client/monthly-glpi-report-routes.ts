import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { CompanyScopeError, resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { loadCompanyRows } from '../../services/portal-data-service';
import { generateManualGlpiPreview } from '../../services/manual-glpi-preview';

export default async function monthlyGlpiReportRoutes(fastify: FastifyInstance, options: { generatePreview?: typeof generateManualGlpiPreview } = {}) {
  const inProgress = new Set<string>();
  const lastGenerated = new Map<string, number>();
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
  fastify.post('/reports/preview', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    let companyId: string | null;
    try {
      ({ targetCompanyId: companyId } = await resolveCompanyScope(fastify.supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (error) {
      if (error instanceof CompanyScopeError) return sendCompanyScopeError(reply, error);
      request.log.error('Falha ao identificar empresa da prévia GLPI');
      return reply.code(500).send({ error: 'Não foi possível identificar a empresa.' });
    }
    if (!companyId) return reply.code(400).send({ error: 'Selecione uma empresa.' });
    if (inProgress.has(companyId) || Date.now() - (lastGenerated.get(companyId) || 0) < 60_000) {
      return reply.code(429).send({ error: 'Aguarde um minuto antes de gerar outra prévia.' });
    }
    inProgress.add(companyId);
    try {
      const result = await (options.generatePreview || generateManualGlpiPreview)(fastify.supabaseAdmin, companyId);
      const completedAt = Date.now();
      lastGenerated.set(companyId, completedAt);
      const timer = setTimeout(() => { if (lastGenerated.get(companyId!) === completedAt) lastGenerated.delete(companyId!); }, 60_000);
      timer.unref();
      return result;
    } catch (error) {
      request.log.error({ companyId }, 'Falha ao gerar prévia GLPI');
      return reply.code(502).send({ error: 'Não foi possível gerar a prévia. Verifique as integrações GLPI e OpenAI e tente novamente.' });
    } finally {
      inProgress.delete(companyId);
    }
  });
}
