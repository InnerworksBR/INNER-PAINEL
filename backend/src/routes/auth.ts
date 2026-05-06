import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserProfile } from '../types';
import { getSessionTimeoutSeconds } from '../services/settings-service';
import { writeAdminAuditLog } from '../services/audit-service';

interface LoginBody {
  email: string;
  password: string;
}

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

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
}
