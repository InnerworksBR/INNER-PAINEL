import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload, UserProfile } from '../types';

type LiveProfileRow = {
  full_name?: unknown;
  role?: unknown;
  company_id?: unknown;
  status?: unknown;
  companies?: { name?: unknown } | Array<{ name?: unknown }> | null;
};

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }

  await fastify.register(jwt, { secret });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();

      const payload = request.user as JWTPayload;
      const liveUser = await loadLiveUser(fastify, payload?.user);
      if (!liveUser) {
        return reply.code(401).send({ error: 'Perfil nao encontrado' });
      }

      if (liveUser.status === 'blocked') {
        return reply.code(403).send({ error: 'Usuario bloqueado' });
      }

      payload.user = liveUser;
    } catch (err) {
      return reply.code(401).send({ error: 'Token invalido ou expirado' });
    }
  });
});

export async function loadLiveUser(
  fastify: FastifyInstance,
  tokenUser?: UserProfile
): Promise<UserProfile | null> {
  if (!tokenUser?.id || !tokenUser.email || !fastify.supabaseAdmin) {
    return null;
  }

  const { data, error } = await fastify.supabaseAdmin
    .from('profiles')
    .select('full_name, role, company_id, status, companies(name)')
    .eq('id', tokenUser.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profile = data as LiveProfileRow;
  if (profile.role !== 'admin' && profile.role !== 'client') {
    return null;
  }

  const companyId = typeof profile.company_id === 'string' ? profile.company_id : null;
  const companyName = getCompanyName(profile.companies);

  return {
    id: tokenUser.id,
    email: tokenUser.email,
    ...(typeof profile.full_name === 'string' ? { full_name: profile.full_name } : {}),
    role: profile.role,
    company_id: companyId,
    ...(companyName ? { company_name: companyName } : {}),
    status: typeof profile.status === 'string' ? profile.status : 'active',
  };
}

function getCompanyName(companies: LiveProfileRow['companies']): string | undefined {
  const company = Array.isArray(companies) ? companies[0] : companies;
  return typeof company?.name === 'string' ? company.name : undefined;
}
