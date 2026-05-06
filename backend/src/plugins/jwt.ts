import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }

  await fastify.register(jwt, { secret });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();

      const user = (request.user as any)?.user;
      if (user?.id && fastify.supabaseAdmin) {
        const { data: profile, error } = await fastify.supabaseAdmin
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && profile?.status === 'blocked') {
          return reply.code(403).send({ error: 'Usuário bloqueado' });
        }
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Token inválido ou expirado' });
    }
  });
});
