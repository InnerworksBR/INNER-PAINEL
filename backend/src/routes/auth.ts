import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserProfile } from '../types';
import { getSessionTimeoutSeconds } from '../services/settings-service';
import { writeAdminAuditLog } from '../services/audit-service';

interface LoginBody {
  email: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UpdateProfileBody {
  full_name: string;
}

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabase, supabaseAdmin } = fastify;

  fastify.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return reply.code(401).send({ error: 'Credenciais inválidas' });
    }

    if (!data.user) {
      return reply.code(500).send({ error: 'Erro inesperado no login' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return reply.code(401).send({ error: 'Perfil não encontrado' });
    }

    if (profile.status === 'blocked') {
      return reply.code(403).send({ error: 'Usuário bloqueado. Fale com o administrador.' });
    }

    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    const userProfile: UserProfile & { company_name?: string } = {
      id: data.user.id,
      email: data.user.email!,
      role: profile.role,
      company_id: profile.company_id,
      company_name: profile.companies?.name,
      status: profile.status || 'active',
    };

    const expiresIn = await getSessionTimeoutSeconds(supabaseAdmin);
    const token = fastify.jwt.sign({ user: userProfile }, { expiresIn });

    if (profile.role === 'admin') {
      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'auth.admin_login',
        entityType: 'profile',
        entityId: data.user.id,
        summary: `Login administrativo: ${data.user.email}`,
      });
    }

    return { token, profile: userProfile };
  });

  fastify.get('/validate', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    return { valid: true, user: (request.user as any)?.user };
  });

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    return { user: getAuthenticatedUser(request) };
  });

  fastify.put<{ Body: UpdateProfileBody }>('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['full_name'],
        additionalProperties: false,
        properties: {
          full_name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const user = getAuthenticatedUser(request);
    const { full_name } = request.body;

    const trimmed = full_name.trim();
    if (!trimmed) {
      return reply.code(400).send({ error: 'O nome nao pode ser vazio.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      request.log.error({ err: updateError, userId: user.id }, 'Failed to update profile full_name');
      return reply.code(500).send({ error: 'Nao foi possivel atualizar o perfil agora.' });
    }

    if (user.role === 'admin') {
      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'auth.update_profile',
        entityType: 'profile',
        entityId: user.id,
        summary: `Perfil atualizado: full_name alterado para "${trimmed}"`,
      });
    }

    return { user: { ...user, full_name: trimmed } };
  });

  fastify.post<{ Body: ChangePasswordBody }>('/change-password', {
    preHandler: [fastify.authenticate],
    preValidation: [rejectUnexpectedPasswordFields],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['currentPassword', 'newPassword', 'confirmPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 8 },
          confirmPassword: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const user = getAuthenticatedUser(request);
    const { currentPassword, newPassword, confirmPassword } = request.body;

    if (!user || user.status === 'blocked') {
      return reply.code(403).send({ error: 'Usuario nao autorizado' });
    }

    if (newPassword !== confirmPassword) {
      return reply.code(400).send({ error: 'A confirmacao da nova senha nao confere.' });
    }

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (passwordError) {
      const status = typeof passwordError.status === 'number' ? passwordError.status : 500;
      if (status === 400 || status === 401) {
        return reply.code(401).send({ error: 'Senha atual invalida.' });
      }

      request.log.error({ err: passwordError, userId: user.id }, 'Failed to reauthenticate password change');
      return reply.code(500).send({ error: 'Nao foi possivel alterar a senha agora.' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      request.log.error({ err: updateError, userId: user.id }, 'Failed to change authenticated user password');
      return reply.code(500).send({ error: 'Nao foi possivel alterar a senha agora.' });
    }

    return { success: true, message: 'Senha alterada com sucesso.' };
  });
}

function getAuthenticatedUser(request: FastifyRequest): UserProfile {
  return (request.user as { user: UserProfile }).user;
}

async function rejectUnexpectedPasswordFields(request: FastifyRequest, reply: FastifyReply) {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return;
  }

  const allowedFields = new Set(['currentPassword', 'newPassword', 'confirmPassword']);
  if (Object.keys(request.body).some((field) => !allowedFields.has(field))) {
    return reply.code(400).send({ error: 'Campos invalidos para alteracao de senha.' });
  }
}
