// src/hooks/auth-hook.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload } from '../types';

// FIX B3: properly return reply to halt request processing
export async function verifyAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const payload = request.user as JWTPayload;
  const user = payload?.user;

  if (!user || user.role !== 'admin') {
    return reply.code(403).send({
      error: 'Acesso negado. Requer privilégios de administrador.',
    });
  }
}
