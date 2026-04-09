// src/routes/admin/companies-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

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

  // Listar todas as empresas com paginação
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
    return { data, total: count };
  });

  // Criar empresa
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
    return data![0];
  });

  // Atualizar empresa
  fastify.put<{ Params: { id: string }; Body: Partial<CompanyBody> }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    return data![0];
  });

  // Consultar uma empresa específica
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*, company_integrations(*)')
      .eq('id', id)
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Salvar/Atualizar credenciais de integração
  fastify.post<{ Params: { id: string }; Body: Record<string, string> }>('/:id/integrations', async (request, reply) => {
    const { id } = request.params;
    const integrationsData = { ...request.body };

    integrationsData.company_id = id;
    integrationsData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('company_integrations')
      .upsert(integrationsData, { onConflict: 'company_id' })
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    return data![0];
  });

  // Excluir empresa
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { error } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });
}
