// src/routes/client/docs-routes.ts
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { getSignedUrl } from '../../services/storage-service';

export default async function clientDocsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Listar documentos da empresa do usuário
  fastify.get('/', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    if (user.role !== 'admin' && !user.company_id) {
      return reply.code(403).send({ error: 'Usuário sem empresa associada' });
    }

    let query = supabaseAdmin.from('documents').select('*');

    if (user.role !== 'admin') {
      query = query.eq('company_id', user.company_id!);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Gerar URL de download assinada para o cliente
  fastify.get<{ Params: { id: string } }>('/:id/download', async (request, reply) => {
    const { id } = request.params;
    const { user } = request.user as JWTPayload;

    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('file_url, title, company_id')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return reply.code(404).send({ error: 'Documento não encontrado' });
    }
    
    // Verificar se o usuário tem permissão para esta empresa
    if (user.role !== 'admin' && doc.company_id !== user.company_id) {
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
