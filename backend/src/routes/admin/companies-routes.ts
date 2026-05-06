// src/routes/admin/companies-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { encryptSecret, hasConfiguredSecret } from '../../services/crypto-service';
import { writeAdminAuditLog } from '../../services/audit-service';

interface CompanyBody {
  name: string;
  cnpj: string;
  sector?: string;
  status?: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

export default async function adminCompaniesRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get<{ Querystring: PaginationQuery }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 50 } = request.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('companies')
      .select('*, company_integrations(*)', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    if (error) return reply.code(500).send({ error: error.message });
    return { data: (data || []).map(sanitizeCompanyIntegrations), total: count };
  });

  fastify.post<{ Body: CompanyBody }>('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'cnpj'],
        properties: {
          name: { type: 'string' },
          cnpj: { type: 'string' },
          sector: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, cnpj, sector, status } = request.body;
    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert([{ name, cnpj, sector, status: status || 'Ativo' }])
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    const company = data![0];
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'company.create',
      entityType: 'company',
      entityId: company.id,
      companyId: company.id,
      summary: `Empresa criada: ${name}`,
      metadata: { cnpj, sector, status: status || 'Ativo' },
    });
    return company;
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CompanyBody> }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'company.update',
      entityType: 'company',
      entityId: id,
      companyId: id,
      summary: `Empresa atualizada: ${data![0]?.name || id}`,
      metadata: updates,
    });
    return data![0];
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*, company_integrations(*)')
      .eq('id', id)
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return sanitizeCompanyIntegrations(data);
  });

  fastify.post<{ Params: { id: string }; Body: Record<string, any> }>('/:id/integrations', async (request, reply) => {
    const { id } = request.params;
    const integrationsData = { ...request.body };

    const { data: existing } = await supabaseAdmin
      .from('company_integrations')
      .select('*')
      .eq('company_id', id)
      .maybeSingle();

    integrationsData.company_id = id;
    integrationsData.updated_at = new Date().toISOString();
    integrationsData.zabbix_password = resolveSecretForSave(
      integrationsData.zabbix_password,
      existing?.zabbix_password
    );
    integrationsData.ms_graph_client_secret = resolveSecretForSave(
      integrationsData.ms_graph_client_secret,
      existing?.ms_graph_client_secret
    );

    const { data, error } = await supabaseAdmin
      .from('company_integrations')
      .upsert(integrationsData, { onConflict: 'company_id' })
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'integration.save',
      entityType: 'company_integrations',
      entityId: data![0].id,
      companyId: id,
      summary: 'Integrações da empresa atualizadas',
      metadata: {
        zabbix_configured: Boolean(integrationsData.zabbix_api_url && integrationsData.zabbix_user && integrationsData.zabbix_password),
        ms365_configured: Boolean(integrationsData.ms_graph_tenant_id && integrationsData.ms_graph_client_id && integrationsData.ms_graph_client_secret),
        glpi_configured: Boolean(integrationsData.glpi_api_url && integrationsData.glpi_user_token && integrationsData.glpi_app_token),
      },
    });
    return sanitizeIntegration(data![0]);
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { error } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'company.delete',
      entityType: 'company',
      entityId: id,
      companyId: id,
      summary: `Empresa excluída: ${id}`,
    });
    return { success: true };
  });
}

function resolveSecretForSave(incoming: unknown, existing?: string | null): string | null {
  const value = typeof incoming === 'string' ? incoming.trim() : '';
  if (!value || value === '__configured__') return existing || null;
  return encryptSecret(value);
}

function sanitizeCompanyIntegrations(company: any) {
  if (!company?.company_integrations) return company;
  return {
    ...company,
    company_integrations: Array.isArray(company.company_integrations)
      ? company.company_integrations.map(sanitizeIntegration)
      : sanitizeIntegration(company.company_integrations),
  };
}

function sanitizeIntegration(integration: any) {
  if (!integration) return integration;
  const { zabbix_password, ms_graph_client_secret, ...safe } = integration;
  return {
    ...safe,
    zabbix_password: '',
    ms_graph_client_secret: '',
    zabbix_password_configured: hasConfiguredSecret(zabbix_password),
    ms_graph_client_secret_configured: hasConfiguredSecret(ms_graph_client_secret),
  };
}
