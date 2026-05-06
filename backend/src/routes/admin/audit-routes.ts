import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

interface AuditQuery {
  action?: string;
  entity_type?: string;
  company_id?: string;
  admin_user_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export default async function adminAuditRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get<{ Querystring: AuditQuery }>('/', async (request, reply) => {
    const {
      action,
      entity_type,
      company_id,
      admin_user_id,
      date_from,
      date_to,
      limit = 100,
    } = request.query;

    let query = supabaseAdmin
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 100, 500));

    if (action) query = query.eq('action', action);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (company_id) query = query.eq('company_id', company_id);
    if (admin_user_id) query = query.eq('admin_user_id', admin_user_id);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });
    return data || [];
  });
}
