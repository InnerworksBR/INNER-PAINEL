// src/routes/admin/document-creator-routes.ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';
import { generateDocumentContent, sendDocumentEmail } from '../../services/document-generator-service';

interface GenerateBody {
  template: string;
  formData: Record<string, string>;
  templateLabel: string;
}

interface DownloadPDFBody {
  html: string;
  template: string;
  filename: string;
}

interface SendEmailBody {
  template: string;
  formData: Record<string, string>;
  html: string;
  companyId: string;
}

export default async function documentCreatorRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Gerar conteúdo do documento
  fastify.post<{ Body: GenerateBody }>('/generate', async (request, reply) => {
    const { template, formData, templateLabel } = request.body;

    if (!template || !formData) {
      return reply.code(400).send({ error: 'Template e dados são obrigatórios' });
    }

    try {
      const content = generateDocumentContent(template, formData, templateLabel);

      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'document.generate',
        entityType: 'document',
        summary: `Documento gerado: ${templateLabel}`,
        metadata: { template, hasContent: !!content },
      });

      return { content };
    } catch (err: any) {
      console.error('Erro ao gerar documento:', err);
      return reply.code(500).send({ error: 'Falha ao gerar documento: ' + err.message });
    }
  });

  // Baixar PDF
  fastify.post<{ Body: DownloadPDFBody }>('/download-pdf', async (request, reply) => {
    const { html, template, filename } = request.body;

    if (!html) {
      return reply.code(400).send({ error: 'Conteúdo HTML é obrigatório' });
    }

    try {
      // Para gerar PDF real, você precisaria de uma biblioteca como puppeteer ou usar um serviço externo
      // Por agora, retornamos o HTML para o frontend lidar com a conversão
      reply.header('Content-Type', 'text/html');
      reply.header('Content-Disposition', `attachment; filename="${filename || 'documento'}.html"`);
      return html;
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      return reply.code(500).send({ error: 'Falha ao gerar PDF: ' + err.message });
    }
  });

  // Enviar e-mail com documento
  fastify.post<{ Body: SendEmailBody }>('/send-email', async (request, reply) => {
    const { template, formData, html, companyId } = request.body;

    if (!companyId) {
      return reply.code(400).send({ error: 'ID da empresa é obrigatório' });
    }

    try {
      // Buscar dados da empresa
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('name, company_integrations')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        return reply.code(404).send({ error: 'Empresa não encontrada' });
      }

      // Enviar e-mail
      await sendDocumentEmail(supabaseAdmin, {
        companyId,
        companyName: company.name,
        template,
        formData,
        html,
        userEmail: request.user?.email,
      });

      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'document.send_email',
        entityType: 'document',
        companyId,
        summary: `Documento enviado por e-mail: ${template}`,
        metadata: { template, recipient: company.name },
      });

      return { success: true, message: 'E-mail enviado com sucesso' };
    } catch (err: any) {
      console.error('Erro ao enviar e-mail:', err);
      return reply.code(500).send({ error: 'Falha ao enviar e-mail: ' + err.message });
    }
  });

  // Listar templates disponíveis
  fastify.get('/templates', async () => {
    return {
      templates: [
        {
          id: 'proposta_comercial',
          label: 'Proposta Comercial',
          icon: 'FileText',
          description: 'Proposta de serviços gerais',
        },
        {
          id: 'proposta_sistema',
          label: 'Proposta de Sistema',
          icon: 'Smartphone',
          description: 'Proposta para desenvolvimento de sistemas',
        },
        {
          id: 'relatorio_mensal',
          label: 'Relatório Mensal',
          icon: 'BarChart',
          description: 'Relatório de prestação de serviços',
        },
        {
          id: 'comunicacao',
          label: 'Comunicação ao Cliente',
          icon: 'Mail',
          description: 'Comunicação formal',
        },
      ],
    };
  });
}
