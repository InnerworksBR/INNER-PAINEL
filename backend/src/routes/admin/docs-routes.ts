// src/routes/admin/docs-routes.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { verifyAdmin } from '../../hooks/auth-hook';
import { uploadFile, getSignedUrl, deleteFile } from '../../services/storage-service';
import { writeAdminAuditLog } from '../../services/audit-service';

interface DocBody {
  company_id: string;
  title: string;
  category: string;
  file_url: string;
}

export default async function adminDocsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Listar documentos
  fastify.get<{ Querystring: { company_id?: string } }>('/', async (request, reply) => {
    const { company_id } = request.query;
    let query = supabaseAdmin.from('documents').select('*, companies(name)');

    if (company_id) query = query.eq('company_id', company_id);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Upload de arquivo real
  fastify.post('/upload', async (request: FastifyRequest, reply) => {
    let companyId = '';
    let category = 'Outros';
    const uploadedFiles: Array<{ title: string; storagePath: string }> = [];
    const pendingFiles: Array<{ filename: string; mimetype: string; fileBuffer: Buffer }> = [];

    for await (const part of request.parts()) {
      if (part.type === 'field') {
        const value = (part as any).value as string;
        if (part.fieldname === 'company_id') companyId = value;
        if (part.fieldname === 'category') category = value;
      } else if (part.type === 'file') {
        const file = part as MultipartFile;
        // Usa o método toBuffer() nativo do fastify-multipart
        const fileBuffer = await file.toBuffer();
        
        if (fileBuffer.length > 0) {
           pendingFiles.push({
             filename: file.filename,
             mimetype: file.mimetype,
             fileBuffer
           });
        }
      }
    }

    if (!companyId) {
      return reply.code(400).send({ error: 'company_id é obrigatório' });
    }

    // Agora fazemos os uploads garantindo que companyId já foi lido
    for (const f of pendingFiles) {
      try {
        const storagePath = await uploadFile(
          supabaseAdmin,
          companyId,
          f.filename,
          f.fileBuffer,
          f.mimetype
        );

        uploadedFiles.push({
           title: f.filename,
           storagePath,
        });
      } catch (err: any) {
        console.error('Erro no upload ao storage:', err.message);
        return reply.code(500).send({ error: `Erro no Supabase ao fazer upload de ${f.filename}: ${err.message}` });
      }
    }

    // Salvar referências no banco de dados
    const dbInserts = uploadedFiles.map((f) => ({
      company_id: companyId,
      title: f.title,
      category,
      file_url: f.storagePath,
    }));

    if (dbInserts.length > 0) {
      const { error } = await supabaseAdmin.from('documents').insert(dbInserts);
      if (error) {
        return reply.code(500).send({ error: error.message });
      }
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'document.upload',
      entityType: 'document',
      companyId,
      summary: `${uploadedFiles.length} documento(s) enviado(s)`,
      metadata: { files: uploadedFiles.map((f) => f.title), category },
    });

    return {
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
      count: uploadedFiles.length,
      files: uploadedFiles.map((f) => f.title),
    };
  });

  // Gerar URL de download assinada
  fastify.get<{ Params: { id: string } }>('/:id/download', async (request, reply) => {
    const { id } = request.params;

    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('file_url, title, company_id')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return reply.code(404).send({ error: 'Documento não encontrado' });
    }

    if (!doc.file_url || doc.file_url === 'storage_pendente') {
      return reply.code(404).send({ error: 'Arquivo não disponível para download (registro lógico apenas)' });
    }

    try {
      const signedUrl = await getSignedUrl(supabaseAdmin, doc.file_url);
      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'document.download',
        entityType: 'document',
        entityId: id,
        companyId: doc.company_id,
        summary: `Download administrativo: ${doc.title}`,
      });
      return { url: signedUrl, title: doc.title };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Criar documento (apenas registro no banco, sem upload de arquivo)
  fastify.post<{ Body: DocBody }>('/register', async (request, reply) => {
    const { company_id, title, category, file_url } = request.body;
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert([{ company_id, title, category, file_url: file_url || 'storage_pendente' }])
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'document.register',
      entityType: 'document',
      entityId: data![0].id,
      companyId: company_id,
      summary: `Documento pendente registrado: ${title}`,
      metadata: { category },
    });
    return data![0];
  });

  // Atualizar documento
  fastify.put<{ Params: { id: string }; Body: Partial<DocBody> }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'document.update',
      entityType: 'document',
      entityId: id,
      companyId: data![0]?.company_id,
      summary: `Documento atualizado: ${data![0]?.title || id}`,
      metadata: updates,
    });
    return data![0];
  });

  // Excluir documento (remove do Storage também)
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    // Buscar file_url para deletar do Storage
    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('file_url, title, company_id')
      .eq('id', id)
      .single();

    if (doc?.file_url && doc.file_url !== 'storage_pendente') {
      await deleteFile(supabaseAdmin, doc.file_url);
    }

    const { error } = await supabaseAdmin.from('documents').delete().eq('id', id);
    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'document.delete',
      entityType: 'document',
      entityId: id,
      companyId: doc?.company_id,
      summary: `Documento excluído: ${doc?.title || id}`,
    });
    return { success: true };
  });
}
