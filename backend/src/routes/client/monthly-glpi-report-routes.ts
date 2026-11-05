import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { CompanyScopeError, resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { loadCompanyRows } from '../../services/portal-data-service';
import { getOrCreateManualGlpiPreview, PreviewBusyError } from '../../services/manual-glpi-storage';

export default async function monthlyGlpiReportRoutes(fastify: FastifyInstance, options: { generatePreview?: typeof getOrCreateManualGlpiPreview } = {}) {
  const inProgress = new Set<string>();
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/reports', async (request, reply) => {
    try {
      const { user } = request.user as JWTPayload;
      const { targetCompanyId } = await resolveCompanyScope(fastify.supabaseAdmin, user, (request.query as any)?.company_id);
      if (!targetCompanyId) return reply.code(400).send({ error: 'Selecione uma empresa' });
      const [monthly, previews] = await Promise.all([
        loadCompanyRows(fastify.supabaseAdmin, 'monthly_glpi_reports', targetCompanyId),
        loadCompanyRows(fastify.supabaseAdmin, 'glpi_report_previews', targetCompanyId, { state: 'ready' }),
      ]);
      const reports = [
        ...monthly.map(report => ({ ...report, is_preview: false })),
        ...previews.map(report => ({ ...report, is_preview: true })),
      ].filter(report => report.metrics && report.analysis && report.generated_at);
      return reports.sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)) || Number(a.is_preview) - Number(b.is_preview)).map(({ id, period_start, metrics, analysis, generated_at, is_preview }) => ({ id, period_start, metrics, analysis, generated_at, is_preview }));
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
    if (inProgress.has(companyId)) {
      return reply.code(429).send({ error: 'Uma prévia já está sendo gerada. Aguarde e tente novamente.' });
    }
    inProgress.add(companyId);
    try {
      return await (options.generatePreview || getOrCreateManualGlpiPreview)(fastify.supabaseAdmin, companyId);
    } catch (error) {
      if (error instanceof PreviewBusyError) return reply.code(429).send({ error: error.message });
      request.log.error({ companyId }, 'Falha ao gerar prévia GLPI');
      return reply.code(502).send({ error: 'Não foi possível gerar ou salvar a prévia. Verifique as integrações GLPI e OpenAI e tente novamente.' });
    } finally {
      inProgress.delete(companyId);
    }
  });
}
