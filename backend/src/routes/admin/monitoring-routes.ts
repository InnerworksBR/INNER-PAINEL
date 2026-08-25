import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';

type CreateTokenBody = {
  display_hint?: string;
  validity_minutes?: number;
};

type MonitoringSite = { id: string; name: string };
type MonitoringToken = {
  id: string;
  display_hint: string;
  token_preview: string | null;
  token: string | null;
  expires_at: string;
  source_type: string;
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

      const baseUrl = process.env.MONITORING_API_URL?.replace(/\/$/, '');
      if (!baseUrl) {
        return reply.code(503).send({ error: 'Integração de monitoring não configurada.' });
      }

      const portalUser = request.user.user;
      const bridgeToken = fastify.jwt.sign({
        user_id: portalUser.id,
        company_id: companyId,
        role: 'platform_admin',
        email: portalUser.email,
      } as unknown as JWTPayload, {
        iss: 'inner-monitoring',
        aud: 'inner-monitoring-api',
        expiresIn: '5m',
      });

      const headers = {
        authorization: `Bearer ${bridgeToken}`,
        'content-type': 'application/json',
      };

      try {
        const siteResponse = await fetch(`${baseUrl}/companies/${companyId}/default-site`, {
          method: 'POST',
          headers,
        });
        if (!siteResponse.ok) {
          return reply.code(siteResponse.status).send(await readMonitoringError(siteResponse));
        }

        const site = await siteResponse.json() as MonitoringSite;
        const tokenResponse = await fetch(`${baseUrl}/companies/${companyId}/activation-tokens`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            site_id: site.id,
            source_type: 'Agent',
            display_hint: display_hint?.trim() || 'Agente Windows',
            validity_minutes: validity_minutes ?? 60,
          }),
        });
        if (!tokenResponse.ok) {
          return reply.code(tokenResponse.status).send(await readMonitoringError(tokenResponse));
        }

        const token = await tokenResponse.json() as MonitoringToken;
        await writeAdminAuditLog(fastify.supabaseAdmin, request, {
          action: 'monitoring.activation_token.create',
          entityType: 'monitoring_activation_token',
          entityId: token.id,
          companyId,
          summary: 'Token de ativação do agente criado',
          metadata: { site_id: site.id, source_type: token.source_type, expires_at: token.expires_at },
        });

        return reply.code(201).send({
          id: token.id,
          display_hint: token.display_hint,
          token: token.token,
          token_preview: token.token_preview,
          expires_at: token.expires_at,
          site: { id: site.id, name: site.name },
        });
      } catch (error) {
        request.log.error(error, 'Falha ao criar token de ativação no monitoring');
        return reply.code(502).send({ error: 'Não foi possível comunicar com o monitoring.' });
      }
    }
  );
}

async function readMonitoringError(response: Response): Promise<{ error: string }> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return { error: payload?.error || 'Falha na API de monitoring.' };
}
