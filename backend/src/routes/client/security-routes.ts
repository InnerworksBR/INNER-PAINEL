// src/routes/client/security-routes.ts
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';
import { getSecuritySignedUrl } from '../../services/storage-service';

export default async function clientSecurityRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Listar relatórios de segurança da empresa
  fastify.get('/', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(
        supabaseAdmin,
        user,
        (request.query as any)?.company_id
      );

      let query = supabaseAdmin
        .from('security_reports')
        .select('id, report_type, title, file_url, updated_at')
        .not('file_url', 'is', null);

      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);

      const { data, error } = await query.order('report_type');
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  // URL assinada para visualização inline
  fastify.get<{ Params: { id: string } }>('/:id/view', async (request, reply) => {
    const { id } = request.params;
    const { user } = request.user as JWTPayload;

    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(
        supabaseAdmin,
        user,
        (request.query as any)?.company_id
      ));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    const { data: report, error } = await supabaseAdmin
      .from('security_reports')
      .select('file_url, title, company_id')
      .eq('id', id)
      .single();

    if (error || !report) return reply.code(404).send({ error: 'Relatório não encontrado' });

    if (targetCompanyId && report.company_id !== targetCompanyId) {
      return reply.code(403).send({ error: 'Sem permissão para visualizar este relatório' });
    }

    if (!report.file_url) {
      return reply.code(404).send({ error: 'Arquivo não disponível' });
    }

    try {
      const url = await getSecuritySignedUrl(supabaseAdmin, report.file_url, 7200);
      return { url, title: report.title };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
