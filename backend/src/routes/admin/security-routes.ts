// src/routes/admin/security-routes.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';
// Reutiliza o bucket 'documents' (já provisionado e funcional em produção)
// para evitar problemas de RLS em buckets recém-criados. O conteúdo é
// reembalado no frontend via Blob com o MIME correto, então o tipo
// armazenado aqui não afeta a renderização.
import { uploadFile, getSignedUrl, deleteFile } from '../../services/storage-service';

export default async function adminSecurityRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Listar relatórios de segurança
  fastify.get<{ Querystring: { company_id?: string } }>('/', async (request, reply) => {
    const { company_id } = request.query;
    let query = supabaseAdmin
      .from('security_reports')
      .select('*, companies(name)')
      .order('company_id');

    if (company_id) query = query.eq('company_id', company_id);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Upload de relatório (upsert por empresa + tipo)
  fastify.post('/upload', async (request: FastifyRequest, reply) => {
    let companyId = '';
    let reportType = '';
    let title = '';
    const pendingFiles: Array<{ filename: string; mimetype: string; fileBuffer: Buffer }> = [];

    for await (const part of request.parts()) {
      if (part.type === 'field') {
        const value = (part as any).value as string;
        if (part.fieldname === 'company_id') companyId = value;
        if (part.fieldname === 'report_type') reportType = value;
        if (part.fieldname === 'title') title = value;
      } else if (part.type === 'file') {
        const file = part as MultipartFile;
        const fileBuffer = await file.toBuffer();
        if (fileBuffer.length > 0) {
          pendingFiles.push({ filename: file.filename, mimetype: file.mimetype, fileBuffer });
        }
      }
    }

    if (!companyId || !reportType) {
      return reply.code(400).send({ error: 'company_id e report_type são obrigatórios' });
    }
    if (pendingFiles.length === 0) {
      return reply.code(400).send({ error: 'Nenhum arquivo enviado' });
    }

    const f = pendingFiles[0];

    // Tipo armazenado: HTML guardado como text/plain (MIME permitido no bucket
    // documents); PDF como application/pdf. O frontend reembala via Blob.
    const storageMime = reportType === 'zero_trust' ? 'text/plain' : 'application/pdf';
    const storageName = `security_${reportType}_${f.filename}`;

    // 1) Faz o upload do novo arquivo ANTES de remover o antigo,
    //    para nunca perder o relatório atual num upload que falhe.
    let newStoragePath: string;
    try {
      newStoragePath = await uploadFile(supabaseAdmin, companyId, storageName, f.fileBuffer, storageMime);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }

    // 2) Guarda o caminho antigo (se houver) para limpeza posterior.
    const { data: existing } = await supabaseAdmin
      .from('security_reports')
      .select('file_url')
      .eq('company_id', companyId)
      .eq('report_type', reportType)
      .maybeSingle();

    // 3) Aponta o registro para o novo arquivo.
    const { data, error } = await supabaseAdmin
      .from('security_reports')
      .upsert(
        {
          company_id: companyId,
          report_type: reportType,
          title: title || f.filename,
          file_url: newStoragePath,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,report_type' }
      )
      .select()
      .single();

    if (error) {
      // Reverte o upload órfão se o banco falhar.
      await deleteFile(supabaseAdmin, newStoragePath);
      return reply.code(500).send({ error: error.message });
    }

    // 4) Remove o arquivo antigo (best-effort) só agora que o novo está ativo.
    if (existing?.file_url && existing.file_url !== newStoragePath) {
      await deleteFile(supabaseAdmin, existing.file_url);
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'security_report.upload',
      entityType: 'security_report',
      companyId,
      summary: `Relatório de segurança enviado: ${reportType} — ${f.filename}`,
      metadata: { report_type: reportType, filename: f.filename },
    });

    return data;
  });

  // Gerar URL assinada para visualização
  fastify.get<{ Params: { id: string } }>('/:id/view', async (request, reply) => {
    const { id } = request.params;

    const { data: report, error } = await supabaseAdmin
      .from('security_reports')
      .select('file_url, title')
      .eq('id', id)
      .single();

    if (error || !report) return reply.code(404).send({ error: 'Relatório não encontrado' });
    if (!report.file_url) return reply.code(404).send({ error: 'Arquivo não disponível' });

    try {
      const url = await getSignedUrl(supabaseAdmin, report.file_url);
      return { url, title: report.title };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Excluir relatório
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const { data: report } = await supabaseAdmin
      .from('security_reports')
      .select('file_url, company_id, title, report_type')
      .eq('id', id)
      .single();

    if (report?.file_url) {
      await deleteFile(supabaseAdmin, report.file_url);
    }

    const { error } = await supabaseAdmin.from('security_reports').delete().eq('id', id);
    if (error) return reply.code(500).send({ error: error.message });

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'security_report.delete',
      entityType: 'security_report',
      companyId: report?.company_id,
      summary: `Relatório de segurança excluído: ${report?.title || id}`,
    });

    return { success: true };
  });
}
