import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';

export default async function adminMs365Routes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get<{ Querystring: { company_id?: string } }>('/licenses', async (request, reply) => {
    const { company_id } = request.query;
    if (!company_id) return reply.code(400).send({ error: 'company_id é obrigatório' });

    const { data, error } = await supabaseAdmin
      .from('ms365_metrics')
      .select('*')
      .eq('company_id', company_id)
      .order('license_name');
    if (error) return reply.code(500).send({ error: error.message });
    return data || [];
  });

  fastify.patch<{ Params: { id: string }; Body: { include_in_dashboard: boolean } }>(
    '/licenses/:id/dashboard-inclusion',
    async (request, reply) => {
      const { id } = request.params;
      const { data, error } = await supabaseAdmin
        .from('ms365_metrics')
        .update({ include_in_dashboard: Boolean(request.body?.include_in_dashboard) })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) return reply.code(500).send({ error: error.message });
      if (!data) return reply.code(404).send({ error: 'Licença não encontrada' });

      await writeAdminAuditLog(supabaseAdmin, request, {
        action: 'ms365_metric.dashboard_inclusion',
        entityType: 'ms365_metric',
        entityId: id,
        companyId: data.company_id,
        summary: `${data.include_in_dashboard ? 'Licença incluída' : 'Licença removida'} do dashboard: ${data.license_name}`,
        metadata: { include_in_dashboard: data.include_in_dashboard },
      });
      return data;
    }
  );
}
