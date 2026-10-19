import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateOpaqueToken, hashOpaqueToken } from './agent-auth-service';
export class PairingError extends Error { constructor(message: string, public statusCode = 400) { super(message); } }
const code = () => Array.from({ length: 3 }, () => randomInt(0, 65536).toString(16).padStart(4, '0').toUpperCase()).join('-');
export async function createPairing(db: SupabaseClient, body: any) {
  const userCode = code(), deviceSecret = generateOpaqueToken(32), expires = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await db.rpc('create_network_pairing', { p_machine_id: body.machine_id, p_hostname: body.hostname, p_agent_version: body.agent_version, p_os_version: body.os_version, p_detected_networks: body.detected_networks, p_code_hash: hashOpaqueToken(userCode), p_device_secret_hash: hashOpaqueToken(deviceSecret), p_expires_at: expires });
  if (error) throw new PairingError('Não foi possível criar a sessão de vinculação.', 503);
  return { pairing_id: typeof data === 'string' ? data : data?.id, user_code: userCode, device_secret: deviceSecret, expires_at: expires, poll_interval_seconds: 5, verification_url: process.env.NETWORK_AGENT_VERIFICATION_URL || '/admin/empresas' };
}
export async function claimPairing(db: SupabaseClient, companyId: string, userId: string, rawCode: string) {
  const { data, error } = await db.rpc('claim_network_pairing', { p_company_id: companyId, p_user_id: userId, p_code_hash: hashOpaqueToken(rawCode) });
  if (error || !data) throw new PairingError('Código inválido, expirado ou já utilizado.', 404);
  return data;
}
export async function readPairingStatus(db: SupabaseClient, id: string, secret: string) {
  const { data, error } = await db.rpc('get_network_pairing_status', { p_pairing_id: id, p_device_secret_hash: hashOpaqueToken(secret) });
  if (error) throw new PairingError('Sessão inválida.', 401);
  return data;
}
export async function completePairing(db: SupabaseClient, id: string, secret: string, refreshHash: string) {
  const agentSecret = generateOpaqueToken();
  const { data, error } = await db.rpc('complete_network_pairing', { p_pairing_id: id, p_device_secret_hash: hashOpaqueToken(secret), p_refresh_token_hash: refreshHash, p_agent_secret_hash: hashOpaqueToken(agentSecret) });
  if (error) throw new PairingError('Vinculação inválida ou expirada.', 401);
  return { ...(Array.isArray(data) ? data[0] : data), agent_secret: agentSecret };
}
