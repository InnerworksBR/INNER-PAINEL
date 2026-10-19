import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateNetworkConfiguration } from './network-validation-service';

export class NetworkConfigError extends Error { constructor(message: string, public statusCode = 400) { super(message); } }
function key(): Buffer {
  const raw = process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY || process.env.INTEGRATION_SECRET_KEY;
  if (!raw) throw new NetworkConfigError('SNMP_CREDENTIAL_ENCRYPTION_KEY is required', 503);
  const decoded = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new NetworkConfigError('SNMP credential key must be 32 bytes', 503);
  return decoded;
}
export function encryptSnmpCredential(value: Record<string, unknown>) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { key_version: 'v1', iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), auth_tag: cipher.getAuthTag().toString('base64') };
}
export function decryptSnmpCredential(row: any): any {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}
export async function listCredentialMetadata(db: SupabaseClient, companyId: string) {
  const { data, error } = await db.from('network_snmp_credentials').select('id,name,version,username,security_level,auth_protocol,privacy_protocol,context_name').eq('company_id', companyId).order('name');
  if (error) throw new NetworkConfigError(error.message, 500);
  const allowed = ['id','name','version','username','security_level','auth_protocol','privacy_protocol','context_name'];
  return (data || []).map((row: any) => Object.fromEntries(allowed.filter(key => row[key] !== undefined).map(key => [key, row[key]])));
}
export async function saveNetworkConfiguration(db: SupabaseClient, agentId: string, companyId: string, input: unknown) {
  const config = validateNetworkConfiguration(input);
  const { data, error } = await db.rpc('save_network_agent_configuration', { p_agent_id: agentId, p_company_id: companyId, p_configuration: config });
  if (error) throw new NetworkConfigError(error.message, 400);
  return data;
}
export async function getAgentNetworkConfiguration(db: SupabaseClient, agentId: string) {
  const { data, error } = await db.rpc('get_agent_network_configuration', { p_agent_id: agentId });
  if (error) throw new NetworkConfigError(error.message, 500);
  const result = (Array.isArray(data) ? data[0] : data) || { version: 0, enabled: false, collection_interval_seconds: 60, discovery_interval_seconds: 900, networks: [], credentials: [] };
  if (Array.isArray(result.credentials)) {
    result.credentials = result.credentials.map((row: any) => {
      const secret = decryptSnmpCredential(row);
      const { ciphertext: _c, iv: _i, auth_tag: _a, key_version: _k, ...metadata } = row;
      return { ...metadata, ...secret };
    });
  }
  return result;
}
