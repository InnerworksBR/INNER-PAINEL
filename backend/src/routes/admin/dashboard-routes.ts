// src/routes/admin/dashboard-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

export default async function adminDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Dashboard stats agregados
  fastify.get('/stats', async (_request, reply) => {
    try {
      const [companiesRes, profilesRes, documentsRes] = await Promise.all([
        supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('profiles').select('id, role', { count: 'exact' }),
        supabaseAdmin.from('documents').select('id', { count: 'exact', head: true }),
      ]);

      const profiles = profilesRes.data || [];
      const adminCount = profiles.filter((p: any) => p.role === 'admin').length;
      const clientCount = profiles.filter((p: any) => p.role === 'client').length;

      return {
        companies: companiesRes.count || 0,
        users: {
          total: profilesRes.count || 0,
          admins: adminCount,
          clients: clientCount,
        },
        documents: documentsRes.count || 0,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
