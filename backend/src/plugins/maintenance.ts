import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JWTPayload } from '../types';
import { isMaintenanceModeEnabled } from '../services/settings-service';
import { loadLiveUser } from './jwt';

const BYPASS_PREFIXES = ['/api/auth/login', '/api/health'];

export default fp(async function maintenancePlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?', 1)[0];
    const publicEbooks = path === '/api/public/ebooks' || path.startsWith('/api/public/ebooks/');
    if (publicEbooks || BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return;
    }

    const enabled = await isMaintenanceModeEnabled(fastify.supabaseAdmin);
    if (!enabled) return;

    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;
      const liveUser = await loadLiveUser(fastify, payload?.user);
      if (liveUser?.status !== 'blocked' && liveUser?.role === 'admin') {
        payload.user = liveUser;
        return;
      }
    } catch (_) {
      // Visitors and clients are blocked while maintenance is enabled.
    }

    return reply.code(503).send({
      error: 'Portal em manutencao. Tente novamente mais tarde.',
      maintenanceMode: true,
    });
  });
});
