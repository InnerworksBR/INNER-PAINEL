import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JWTPayload } from '../types';
import { isMaintenanceModeEnabled } from '../services/settings-service';

const BYPASS_PREFIXES = ['/api/auth/login', '/api/health'];

export default fp(async function maintenancePlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (BYPASS_PREFIXES.some((path) => request.url.startsWith(path))) {
      return;
    }

    const enabled = await isMaintenanceModeEnabled(fastify.supabaseAdmin);
    if (!enabled) return;

    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;
      if (payload?.user?.role === 'admin') return;
    } catch (_) {
      // Visitors and clients are blocked while maintenance is enabled.
    }

    return reply.code(503).send({
      error: 'Portal em manutenção. Tente novamente mais tarde.',
      maintenanceMode: true,
    });
  });
});
