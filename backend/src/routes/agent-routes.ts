import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JWTPayload } from '../types';
import type { HeartbeatRequest } from '../types/agent';
import {
  AgentAuthError,
  createAgentClaims,
  enrollAgent,
  parseAgentClaims,
  rotateAgentRefreshToken,
} from '../services/agent-auth-service';
import {
  AgentIngestionError,
  ingestMetricBatch,
  recordAgentHeartbeat,
} from '../services/agent-ingestion-service';
import { AgentPayloadError } from '../types/agent';

type EnrollmentBody = {
  activation_token?: string;
  machine_id?: string;
  hostname?: string;
  agent_version?: string;
  os_info?: string | null;
  os_version?: string | null;
  hypervisor?: string | null;
};

type RefreshBody = {
  refresh_token?: string;
};

const AGENT_ACCESS_TOKEN_SECONDS = 15 * 60;

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: EnrollmentBody }>('/enroll', async (request, reply) => {
    const body = request.body || {};
    const validationError = validateEnrollmentBody(body);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    try {
      const result = await enrollAgent(fastify.supabaseAdmin, {
        activation_token: body.activation_token!,
        machine_id: body.machine_id!,
        hostname: body.hostname!,
        agent_version: body.agent_version!,
        os_info: body.os_info,
        os_version: body.os_version,
        hypervisor: body.hypervisor || 'Hyper-V',
      });

      return reply.code(201).send(buildCredentialsResponse(fastify, result.agent, result.refresh_token));
    } catch (error) {
      return sendAgentAuthError(request, reply, error, 'Falha no enrollment do agente');
    }
  });

  fastify.post<{ Body: RefreshBody }>('/refresh', async (request, reply) => {
    const refreshToken = request.body?.refresh_token?.trim();
    if (!refreshToken) {
      return reply.code(400).send({ error: 'refresh_token é obrigatório.' });
    }

    try {
      const result = await rotateAgentRefreshToken(fastify.supabaseAdmin, refreshToken);
      return reply.send(buildCredentialsResponse(fastify, result.agent, result.refresh_token));
    } catch (error) {
      return sendAgentAuthError(request, reply, error, 'Falha na renovação do agente');
    }
  });

  fastify.post('/metrics', async (request, reply) => {
    const principal = await authenticateAgentRequest(request, reply);
    if (!principal) return;

    try {
      const rawIdempotencyKey = request.headers['idempotency-key'];
      const idempotencyKey = Array.isArray(rawIdempotencyKey) ? rawIdempotencyKey[0] : rawIdempotencyKey;
      const result = await ingestMetricBatch(
        fastify.supabaseAdmin,
        principal.agent_id,
        request.body,
        idempotencyKey,
      );
      return reply.code(result.status === 'duplicate' ? 200 : 202).send(result);
    } catch (error) {
      return sendIngestionError(request, reply, error);
    }
  });

  fastify.post<{ Body: HeartbeatRequest }>('/heartbeat', async (request, reply) => {
    const principal = await authenticateAgentRequest(request, reply);
    if (!principal) return;

    try {
      await recordAgentHeartbeat(fastify.supabaseAdmin, principal.agent_id, request.body);
      return reply.code(204).send();
    } catch (error) {
      return sendIngestionError(request, reply, error);
    }
  });
}

export async function authenticateAgentRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ReturnType<typeof parseAgentClaims> | null> {
  try {
    await request.jwtVerify({
      decode: {},
      verify: { allowedIss: 'inner-agent', allowedAud: 'inner-agent-api' },
    });
    const principal = parseAgentClaims(request.user as unknown);
    if (!principal) {
      await reply.code(401).send({ error: 'Credencial de agente inválida.' });
      return null;
    }

    const { data: agent, error } = await request.server.supabaseAdmin
      .from('registered_agents')
      .select('id, company_id, status')
      .eq('id', principal.agent_id)
      .eq('company_id', principal.company_id)
      .neq('status', 'Revoked')
      .maybeSingle();
    if (error) {
      request.log.error(error, 'Falha ao validar o estado do agente');
      await reply.code(503).send({ error: 'Não foi possível validar o agente.' });
      return null;
    }
    if (!agent) {
      await reply.code(401).send({ error: 'Agente revogado ou não encontrado.' });
      return null;
    }
    return principal;
  } catch {
    await reply.code(401).send({ error: 'Token do agente inválido ou expirado.' });
    return null;
  }
}

function buildCredentialsResponse(
  fastify: FastifyInstance,
  agent: { id: string; company_id: string },
  refreshToken: string,
) {
  const accessToken = fastify.jwt.sign(
    createAgentClaims({ agent_id: agent.id, company_id: agent.company_id }) as unknown as JWTPayload,
    {
      iss: 'inner-agent',
      aud: 'inner-agent-api',
      expiresIn: `${AGENT_ACCESS_TOKEN_SECONDS}s`,
    },
  );

  return {
    agent_id: agent.id,
    company_id: agent.company_id,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: AGENT_ACCESS_TOKEN_SECONDS,
  };
}

function validateEnrollmentBody(body: EnrollmentBody): string | null {
  if (!body.activation_token?.trim()) return 'activation_token é obrigatório.';
  if (!body.machine_id?.trim()) return 'machine_id é obrigatório.';
  if (!body.hostname?.trim()) return 'hostname é obrigatório.';
  if (!body.agent_version?.trim()) return 'agent_version é obrigatório.';
  if (body.activation_token.length > 512) return 'activation_token inválido.';
  if (body.machine_id.length > 255 || body.hostname.length > 255 || body.agent_version.length > 100) {
    return 'Dados do agente excedem o tamanho permitido.';
  }
  return null;
}

function sendAgentAuthError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  logMessage: string,
) {
  if (error instanceof AgentAuthError) {
    if (error.statusCode >= 500) request.log.error(error, logMessage);
    return reply.code(error.statusCode).send({ error: publicAuthError(error) });
  }

  request.log.error(error, logMessage);
  return reply.code(500).send({ error: 'Não foi possível autenticar o agente.' });
}

function publicAuthError(error: AgentAuthError): string {
  if (error.code === 'INVALID_ACTIVATION_TOKEN') return 'Token de ativação inválido, expirado ou já utilizado.';
  if (error.code === 'INVALID_REFRESH_TOKEN') return 'Refresh token inválido ou revogado.';
  return 'Não foi possível autenticar o agente.';
}

function sendIngestionError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof AgentPayloadError) {
    const statusCode = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    return reply.code(statusCode).send({ error: error.message.replace(`${error.code}: `, '') });
  }

  if (error instanceof AgentIngestionError) {
    if (error.statusCode >= 500) request.log.error(error, 'Falha na ingestão do agente');
    return reply.code(error.statusCode).send({ error: error.statusCode === 401 ? 'Agente não autorizado.' : 'Não foi possível processar as métricas.' });
  }

  request.log.error(error, 'Falha inesperada na ingestão do agente');
  return reply.code(500).send({ error: 'Não foi possível processar as métricas.' });
}
