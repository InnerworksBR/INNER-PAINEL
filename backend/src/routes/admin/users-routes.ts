// src/routes/admin/users-routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

interface CreateUserBody {
  full_name: string;
  email: string;
  password: string;
  role: 'admin' | 'client';
  company_id?: string;
}

interface UserQuery {
  role?: string;
  company_id?: string;
}

export default async function adminUserRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Listar usuários (Perfis)
  fastify.get<{ Querystring: UserQuery }>('/', async (request, reply) => {
    const { role, company_id } = request.query;

    let query = supabaseAdmin.from('profiles').select('*, companies(name)');

    if (role) query = query.eq('role', role);
    if (company_id) query = query.eq('company_id', company_id);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data;
  });

  // Criar Usuário
  fastify.post<{ Body: CreateUserBody }>('/', async (request, reply) => {
    const { full_name, role, company_id, email, password } = request.body;

    if (!email || !password || !full_name) {
      return reply.code(400).send({ error: 'E-mail, senha e nome completo são obrigatórios' });
    }

    // 1. Criar no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return reply.code(500).send({ error: authError.message });
    }

    const userId = authData.user.id;
    const finalCompanyId = company_id && company_id.trim() !== '' ? company_id : null;

    // 2. Criar Perfil
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name,
        role,
        company_id: finalCompanyId,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      // Cleanup: remover usuário do Auth se perfil falhar
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return reply.code(500).send({ error: error.message });
    }

    return data![0];
  });

  // Atualizar Usuário
  fastify.put<{ Params: { id: string }; Body: Partial<CreateUserBody> }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { full_name, role, company_id } = request.body;

    const finalCompanyId = company_id && company_id.trim() !== '' ? company_id : null;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        ...(full_name && { full_name }),
        ...(role && { role }),
        company_id: finalCompanyId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) return reply.code(500).send({ error: error.message });
    return data![0];
  });

  // Excluir Usuário
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    // Remover do Auth (cascade deleta o perfil via FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });
}
