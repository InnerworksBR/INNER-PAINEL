import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AgentPrincipal } from '../types/agent';

export interface ActivationTokenRecord {
  id: string;
  company_id: string;
  is_active: boolean;
  used_at: string | null;
  expires_at: string | null;
}

export interface AgentEnrollmentInput {
  activation_token: string;
  machine_id: string;
  hostname: string;
  agent_version: string;
  os_info?: string | null;
  os_version?: string | null;
  hypervisor?: string | null;
}

export interface AgentRecord {
  id: string;
  company_id: string;
  hostname: string;
  agent_version: string | null;
}

export interface AgentCredentials {
  agent_id: string;
  company_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AgentAccessClaims extends AgentPrincipal {
  kind: 'agent';
}

export class AgentAuthError extends Error {
  constructor(
    public readonly code: 'INVALID_ACTIVATION_TOKEN' | 'AGENT_NOT_FOUND' | 'INVALID_REFRESH_TOKEN' | 'AUTH_STORAGE_ERROR',
    message: string,
    public readonly statusCode = code === 'AUTH_STORAGE_ERROR' ? 500 : 401,
  ) {
    super(`${code}: ${message}`);
    this.name = 'AgentAuthError';
  }
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function isActivationTokenUsable(
  token: Pick<ActivationTokenRecord, 'is_active' | 'used_at' | 'expires_at'>,
  now = new Date(),
): boolean {
  if (!token.is_active || token.used_at) {
    return false;
  }

  return !token.expires_at || new Date(token.expires_at).getTime() > now.getTime();
}

export function buildAgentAssetKey(companyId: string, machineId: string): string {
  return `agent:${companyId.trim()}:${machineId.trim()}`;
}

export function createAgentClaims(agent: Pick<AgentPrincipal, 'agent_id' | 'company_id'>): AgentAccessClaims {
  return {
    kind: 'agent',
    agent_id: agent.agent_id,
    company_id: agent.company_id,
  };
}

export function parseAgentClaims(payload: unknown): AgentPrincipal | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  if (
    candidate.kind !== 'agent' ||
    typeof candidate.agent_id !== 'string' ||
    !candidate.agent_id.trim() ||
    typeof candidate.company_id !== 'string' ||
    !candidate.company_id.trim()
  ) {
    return null;
  }

  return {
    kind: 'agent',
    agent_id: candidate.agent_id,
    company_id: candidate.company_id,
  };
}

export async function createActivationToken(
  supabase: SupabaseClient,
  companyId: string,
  createdBy: string,
  displayHint: string,
  validityMinutes: number,
): Promise<{ id: string; token: string; display_hint: string; expires_at: string }> {
  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + validityMinutes * 60_000).toISOString();
  const label = displayHint.trim() || 'Agente Hyper-V';

  const { data, error } = await supabase
    .from('agent_activation_tokens')
    .insert({
      company_id: companyId,
      token: null,
      token_hash: hashOpaqueToken(rawToken),
      label,
      expires_at: expiresAt,
      is_active: true,
      created_by: createdBy,
    })
    .select('id, label, expires_at')
    .single();

  if (error || !data) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', error?.message || 'Não foi possível salvar o token de ativação.');
  }

  return {
    id: String(data.id),
    token: rawToken,
    display_hint: String(data.label || label),
    expires_at: String(data.expires_at || expiresAt),
  };
}

export async function enrollAgent(
  supabase: SupabaseClient,
  input: AgentEnrollmentInput,
): Promise<{ agent: AgentRecord; refresh_token: string }> {
  const tokenHash = hashOpaqueToken(input.activation_token);
  const { data: token, error: tokenError } = await supabase
    .from('agent_activation_tokens')
    .select('id, company_id, is_active, used_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenError) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', tokenError.message);
  }

  if (!token || !isActivationTokenUsable(token as ActivationTokenRecord)) {
    throw new AgentAuthError('INVALID_ACTIVATION_TOKEN', 'Token de ativação inválido, expirado ou já utilizado.');
  }

  const { data: claimedToken, error: claimError } = await supabase
    .from('agent_activation_tokens')
    .update({ used_at: new Date().toISOString(), is_active: false })
    .eq('id', token.id)
    .eq('is_active', true)
    .is('used_at', null)
    .select('id')
    .maybeSingle();

  if (claimError) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', claimError.message);
  }

  if (!claimedToken) {
    throw new AgentAuthError('INVALID_ACTIVATION_TOKEN', 'Token de ativação já foi utilizado.');
  }

  const refreshToken = generateOpaqueToken();
  const assetKey = buildAgentAssetKey(String(token.company_id), input.machine_id);
  const { data: agent, error: agentError } = await supabase
    .from('registered_agents')
    .upsert({
      company_id: token.company_id,
      agent_type: 'endpoint',
      asset_key: assetKey,
      agent_secret: hashOpaqueToken(generateOpaqueToken()),
      refresh_token_hash: hashOpaqueToken(refreshToken),
      machine_id: input.machine_id.trim(),
      hostname: input.hostname.trim(),
      os_info: input.os_info?.trim() || null,
      os_version: input.os_version?.trim() || null,
      hypervisor: input.hypervisor?.trim() || 'Hyper-V',
      version: input.agent_version.trim(),
      agent_version: input.agent_version.trim(),
      status: 'Online',
      last_heartbeat: new Date().toISOString(),
      metadata: { enrollment: 'native-agent-v1' },
    }, { onConflict: 'asset_key' })
    .select('id, company_id, hostname, agent_version')
    .single();

  if (agentError || !agent) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', agentError?.message || 'Não foi possível registrar o agente.');
  }

  return {
    agent: agent as AgentRecord,
    refresh_token: refreshToken,
  };
}

export async function rotateAgentRefreshToken(
  supabase: SupabaseClient,
  rawRefreshToken: string,
): Promise<{ agent: AgentRecord; refresh_token: string }> {
  const { data: agent, error } = await supabase
    .from('registered_agents')
    .select('id, company_id, hostname, agent_version, status')
    .eq('refresh_token_hash', hashOpaqueToken(rawRefreshToken))
    .maybeSingle();

  if (error) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', error.message);
  }

  if (!agent || agent.status === 'Revoked') {
    throw new AgentAuthError('INVALID_REFRESH_TOKEN', 'Refresh token inválido ou revogado.');
  }

  const refreshToken = generateOpaqueToken();
  const { error: updateError } = await supabase
    .from('registered_agents')
    .update({ refresh_token_hash: hashOpaqueToken(refreshToken), last_heartbeat: new Date().toISOString() })
    .eq('id', agent.id);

  if (updateError) {
    throw new AgentAuthError('AUTH_STORAGE_ERROR', updateError.message);
  }

  return { agent: agent as AgentRecord, refresh_token: refreshToken };
}
