// src/routes/admin/users-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';

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
  status?: string;
}

export default async function adminUserRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get<{ Querystring: UserQuery }>('/', async (request, reply) => {
    const { role, company_id, status } = request.query;

    let query = supabaseAdmin.from('profiles').select('*, companies(name)').order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (company_id) query = query.eq('company_id', company_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    let emailMap = new Map<string, string>();
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? '']));
    } catch (_) {
      // email fica '' em caso de falha — não quebra o retorno principal
    }

    const enriched = (data ?? []).map((profile: any) => ({
      ...profile,
      email: emailMap.get(profile.id) || '',
    }));

    return enriched;
  });

  fastify.post<{ Body: CreateUserBody }>('/', async (request, reply) => {
    const { full_name, role, company_id, email, password } = request.body;

    if (!email || !password || !full_name) {
      return reply.code(400).send({ error: 'E-mail, senha e nome completo são obrigatórios' });
    }

    const finalCompanyId = normalizeCompanyId(company_id);
    if (role === 'client' && !finalCompanyId) {
      return reply.code(400).send({ error: 'Cliente precisa estar vinculado a uma empresa.' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return reply.code(500).send({ error: authError.message });

    const userId = authData.user.id;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name,
        role,
        company_id: finalCompanyId,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return reply.code(500).send({ error: error.message });
    }

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'user.create',
      entityType: 'profile',
      entityId: userId,
      companyId: finalCompanyId,
      summary: `Usuário criado: ${email}`,
      metadata: { full_name, role },
    });

    return data![0];
  });

  fastify.put<{ Params: { id: string }; Body: Partial<CreateUserBody> }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { full_name, role, company_id } = request.body;
    const finalCompanyId = normalizeCompanyId(company_id);

    if (role === 'client' && !finalCompanyId) {
      return reply.code(400).send({ error: 'Cliente precisa estar vinculado a uma empresa.' });
    }

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
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'user.update',
      entityType: 'profile',
      entityId: id,
      companyId: finalCompanyId,
      summary: `Usuário atualizado: ${data![0]?.full_name || id}`,
      metadata: { role },
    });
    return data![0];
  });

  fastify.post<{ Params: { id: string } }>('/:id/block', async (request, reply) => {
    return setUserStatus(fastify, request, reply, 'blocked');
  });

  fastify.post<{ Params: { id: string } }>('/:id/unblock', async (request, reply) => {
    return setUserStatus(fastify, request, reply, 'active');
  });

  fastify.post<{ Params: { id: string }; Body: { password: string } }>('/:id/reset-password', async (request, reply) => {
    const { id } = request.params;
    const { password } = request.body || {};

    if (!password || password.length < 8) {
      return reply.code(400).send({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (error) return reply.code(500).send({ error: error.message });

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'user.reset_password',
      entityType: 'profile',
      entityId: id,
      summary: `Senha redefinida para usuário ${id}`,
    });

    return { success: true };
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const actorId = (request.user as any)?.user?.id;

    if (actorId === id) {
      return reply.code(400).send({ error: 'Você não pode excluir o próprio usuário administrador.' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return reply.code(500).send({ error: error.message });

    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'user.delete',
      entityType: 'profile',
      entityId: id,
      summary: `Usuário excluído: ${id}`,
    });
    return { success: true };
  });
}

function normalizeCompanyId(companyId?: string): string | null {
  return companyId && companyId.trim() !== '' ? companyId : null;
}

async function setUserStatus(
  fastify: FastifyInstance,
  request: any,
  reply: any,
  status: 'active' | 'blocked'
) {
  const { id } = request.params;
  const actorId = (request.user as any)?.user?.id;

  if (actorId === id && status === 'blocked') {
    return reply.code(400).send({ error: 'Você não pode bloquear o próprio usuário administrador.' });
  }

  const { data, error } = await fastify.supabaseAdmin
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error) return reply.code(500).send({ error: error.message });

  await writeAdminAuditLog(fastify.supabaseAdmin, request, {
    action: status === 'blocked' ? 'user.block' : 'user.unblock',
    entityType: 'profile',
    entityId: id,
    companyId: data?.[0]?.company_id || null,
    summary: status === 'blocked' ? `Usuário bloqueado: ${id}` : `Usuário desbloqueado: ${id}`,
  });

  return data![0];
}
