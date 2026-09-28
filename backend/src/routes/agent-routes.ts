import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JWTPayload } from '../types';
import {
  AgentAuthError,
  createAgentClaims,
  enrollAgent,
  parseAgentClaims,
  rotateAgentRefreshToken,
} from '../services/agent-auth-service';

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
}

export async function authenticateAgentRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ReturnType<typeof parseAgentClaims> | null> {
  try {
    await request.jwtVerify();
    const principal = parseAgentClaims(request.user as unknown);
    if (!principal) {
      await reply.code(401).send({ error: 'Credencial de agente inválida.' });
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
