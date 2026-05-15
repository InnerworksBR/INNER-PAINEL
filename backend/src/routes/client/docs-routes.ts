// src/routes/client/docs-routes.ts
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { getSignedUrl } from '../../services/storage-service';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';

export default async function clientDocsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Listar documentos da empresa do usuário
  fastify.get('/', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    try {
      const { targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id);
      let query = supabaseAdmin
        .from('documents')
        .select('*')
        .not('file_url', 'is', null)
        .neq('file_url', 'storage_pendente');
      if (targetCompanyId) query = query.eq('company_id', targetCompanyId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return reply.code(500).send({ error: error.message });
      return data;
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }
  });

  // Gerar URL de download assinada para o cliente
  fastify.get<{ Params: { id: string } }>('/:id/download', async (request, reply) => {
    const { id } = request.params;
    const { user } = request.user as JWTPayload;
    let targetCompanyId: string | null = null;
    try {
      ({ targetCompanyId } = await resolveCompanyScope(supabaseAdmin, user, (request.query as any)?.company_id));
    } catch (err) {
      return sendCompanyScopeError(reply, err);
    }

    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('file_url, title, company_id')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return reply.code(404).send({ error: 'Documento não encontrado' });
    }
    
    // Verificar se o usuário tem permissão para esta empresa
    if (targetCompanyId && doc.company_id !== targetCompanyId) {
        return reply.code(403).send({ error: 'Sem permissão para baixar este documento' });
    }

    if (!doc.file_url || doc.file_url === 'storage_pendente') {
      return reply.code(404).send({ error: 'Arquivo não disponível para download (apenas registro)' });
    }

    try {
      const signedUrl = await getSignedUrl(supabaseAdmin, doc.file_url);
      return { url: signedUrl, title: doc.title };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
