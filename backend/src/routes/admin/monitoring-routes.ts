import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';
import { createActivationToken } from '../../services/agent-auth-service';

type CreateTokenBody = {
  display_hint?: string;
  validity_minutes?: number;
};

export default async function adminMonitoringRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.post<{ Params: { companyId: string }; Body: CreateTokenBody }>(
    '/companies/:companyId/activation-tokens',
    async (request, reply) => {
      const { companyId } = request.params;
      const { display_hint, validity_minutes } = request.body || {};

      if (validity_minutes !== undefined &&
        (!Number.isInteger(validity_minutes) || validity_minutes < 5 || validity_minutes > 1440)) {
        return reply.code(400).send({ error: 'A validade deve estar entre 5 e 1440 minutos.' });
      }

      const portalUser = request.user.user;

      try {
        const token = await createActivationToken(
          fastify.supabaseAdmin,
          companyId,
          portalUser.id,
          display_hint?.trim() || 'Agente Hyper-V',
          validity_minutes ?? 60,
        );

        await writeAdminAuditLog(fastify.supabaseAdmin, request, {
          action: 'agent.activation_token.create',
          entityType: 'agent_activation_token',
          entityId: token.id,
          companyId,
          summary: 'Token de ativação do agente criado',
          metadata: { source_type: 'native-hyperv-agent', expires_at: token.expires_at },
        });

        return reply.code(201).send({
          id: token.id,
          display_hint: token.display_hint,
          token: token.token,
          token_preview: `${token.token.slice(0, 8)}…`,
          expires_at: token.expires_at,
          site: { id: 'native', name: 'Agente nativo Hyper-V' },
        });
      } catch (error) {
        request.log.error(error, 'Falha ao criar token de ativação do agente');
        return reply.code(500).send({ error: 'Não foi possível criar o token de ativação.' });
      }
    }
  );
}
