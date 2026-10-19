import type { FastifyInstance } from 'fastify';
import { existsSync, createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';
import { claimPairing, PairingError } from '../../services/network-pairing-service';
import { encryptSnmpCredential, listCredentialMetadata, NetworkConfigError, saveNetworkConfiguration } from '../../services/network-config-service';
const claimAttempts = new Map<string, { start: number; count: number }>();

export default async function adminNetworkMonitoringRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', fastify.authenticate); fastify.addHook('preHandler', verifyAdmin);
  fastify.get('/network-agent/download', async (_request, reply) => {
    const fixed = 'Inner.Network.Agent-win-x64.zip';
    const candidates = [process.env.NETWORK_AGENT_PACKAGE_PATH, resolve(process.cwd(), 'artifacts', fixed), resolve(process.cwd(), '..', 'agent', 'artifacts', fixed)].filter((v): v is string => !!v);
    const packagePath = candidates.find(path => path.endsWith(fixed) && existsSync(path));
    if (!packagePath) return reply.code(503).send({ error: 'Pacote do agente de rede ainda não foi compilado. Gere Inner.Network.Agent-win-x64.zip e publique-o no diretório de artefatos do backend.' });
    reply.header('Content-Type', 'application/zip').header('Content-Disposition', `attachment; filename="${fixed}"`);
    return reply.send(createReadStream(packagePath));
  });
  fastify.post<{ Params: { companyId: string } }>('/companies/:companyId/network-agents/claim', async (request, reply) => {
    const now = Date.now(); const bucket = claimAttempts.get(request.ip);
    if (!bucket || now - bucket.start >= 60_000) claimAttempts.set(request.ip, { start: now, count: 1 });
    else bucket.count++;
    const attempt = claimAttempts.get(request.ip)!;
    if (attempt.count > 10) return reply.header('Retry-After', String(Math.ceil((60_000 - (now - attempt.start)) / 1000))).code(429).send({ error: 'Muitas tentativas de vinculação.' });
    const body: any = request.body;
    if (!body || typeof body.code !== 'string' || !/^[0-9A-F]{4}(?:-[0-9A-F]{4}){2}$/.test(body.code)) return reply.code(400).send({ error: 'Código inválido.' });
    try {
      const result: any = await claimPairing(fastify.supabaseAdmin, request.params.companyId, (request.user as any).user.id, body.code);
      await writeAdminAuditLog(fastify.supabaseAdmin, request, { action: 'network_agent.claim', entityType: 'network_agent_pairing', entityId: result.pairing_id, companyId: request.params.companyId, summary: 'Agente de rede vinculado', metadata: { hostname: result.hostname } });
      return reply.send({ hostname: result.hostname, company_id: result.company_id, state: 'approved' });
    } catch (e) { const err = e as PairingError; return reply.code(err.statusCode || 404).send({ error: err.message }); }
  });
  fastify.get<{ Params: { companyId: string } }>('/companies/:companyId/network-agents', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.from('registered_agents').select('id,hostname,agent_version,status,last_heartbeat,metadata').eq('company_id', request.params.companyId).eq('agent_kind', 'network');
    if (error) return reply.code(500).send({ error: 'Could not list agents.' });
    return Promise.all((data || []).map(async (a: any) => {
      const count = await fastify.supabaseAdmin.from('network_devices').select('id', { count: 'exact', head: true }).eq('agent_id', a.id).eq('company_id', request.params.companyId);
      return { id: a.id, hostname: a.hostname, agent_version: a.agent_version, status: a.status, last_heartbeat: a.last_heartbeat, detected_networks: a.metadata?.detected_networks || [], device_count: count.count || 0 };
    }));
  });
  fastify.get<{ Params: { companyId: string } }>('/companies/:companyId/network-scopes', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.from('network_physical_scopes').select('id,name,created_at').eq('company_id', request.params.companyId).order('name');
    if (error) return reply.code(500).send({ error: 'Could not list physical network scopes.' });
    return data || [];
  });
  fastify.post<{ Params: { companyId: string } }>('/companies/:companyId/network-scopes', async (request, reply) => {
    const body: any = request.body;
    if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) return reply.code(400).send({ error: 'Scope name must be between 1 and 120 characters.' });
    const { data, error } = await fastify.supabaseAdmin.from('network_physical_scopes').insert({ company_id: request.params.companyId, name: body.name.trim() }).select('id,name,created_at').single();
    if (error) return reply.code(error.code === '23505' ? 409 : 400).send({ error: 'Could not create physical network scope.' });
    return reply.code(201).send(data);
  });
  fastify.get<{ Params: { companyId: string; agentId: string } }>('/companies/:companyId/network-agents/:agentId/config', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.from('network_agent_configurations').select('version,enabled,collection_interval_seconds,discovery_interval_seconds,configuration').eq('company_id', request.params.companyId).eq('agent_id', request.params.agentId).maybeSingle();
    if (error) return reply.code(500).send({ error: 'Could not load configuration.' });
    return data ? { ...data.configuration, version: data.version, enabled: data.enabled, collection_interval_seconds: data.collection_interval_seconds, discovery_interval_seconds: data.discovery_interval_seconds } : { version: 0, enabled: false, collection_interval_seconds: 60, discovery_interval_seconds: 900, networks: [] };
  });
  fastify.put<{ Params: { companyId: string; agentId: string } }>('/companies/:companyId/network-agents/:agentId/config', async (request, reply) => {
    try { return reply.send(await saveNetworkConfiguration(fastify.supabaseAdmin, request.params.agentId, request.params.companyId, request.body)); } catch (e) { const err = e as NetworkConfigError; return reply.code(err.statusCode || 400).send({ error: err.message }); }
  });
  fastify.post<{ Params: { companyId: string; agentId: string } }>('/companies/:companyId/network-agents/:agentId/revoke', async (request, reply) => {
    const { error } = await fastify.supabaseAdmin.from('registered_agents').update({ status: 'Revoked', refresh_token_hash: null }).eq('id', request.params.agentId).eq('company_id', request.params.companyId).eq('agent_kind', 'network');
    if (error) return reply.code(500).send({ error: 'Could not revoke agent.' });
    return reply.code(204).send();
  });
  fastify.get<{ Params: { companyId: string } }>('/companies/:companyId/snmp-credentials', async (request, reply) => {
    try { return reply.send(await listCredentialMetadata(fastify.supabaseAdmin, request.params.companyId)); } catch { return reply.code(500).send({ error: 'Could not list credentials.' }); }
  });
  const upsertCredential = async (request: any, reply: any, id?: string) => {
    const b = request.body;
    try {
      const valid = b && typeof b.name === 'string' && b.name.trim().length > 0 && b.name.length <= 100 &&
        (typeof b.context_name === 'undefined' || b.context_name === null || typeof b.context_name === 'string' && b.context_name.length <= 255) &&
        (b.version === '2c'
          ? typeof b.community === 'string' && b.community.length > 0 && b.community.length <= 512
          : b.version === '3' && typeof b.username === 'string' && b.username.length > 0 && b.username.length <= 255 &&
            ['authNoPriv','authPriv'].includes(b.security_level) && ['SHA1','SHA256'].includes(b.auth_protocol) &&
            typeof b.auth_password === 'string' && b.auth_password.length > 0 && b.auth_password.length <= 1024 &&
            (b.security_level !== 'authPriv' || b.privacy_protocol === 'AES128' && typeof b.privacy_password === 'string' && b.privacy_password.length > 0 && b.privacy_password.length <= 1024));
      if (!valid) return reply.code(400).send({ error: 'Invalid SNMP credential.' });
      const secret = b.version === '2c'
        ? { community: b.community }
        : { username: b.username, security_level: b.security_level, auth_protocol: b.auth_protocol, auth_password: b.auth_password, ...(b.security_level === 'authPriv' ? { privacy_protocol: b.privacy_protocol, privacy_password: b.privacy_password } : {}), ...(b.context_name ? { context_name: b.context_name } : {}) };
      const encrypted = encryptSnmpCredential(secret); const safe = { name: b.name.trim(), version: b.version, username: b.version === '3' ? b.username : null, security_level: b.version === '3' ? b.security_level : null, auth_protocol: b.version === '3' ? b.auth_protocol : null, privacy_protocol: b.version === '3' ? b.privacy_protocol || null : null, context_name: b.context_name || null, ...encrypted };
      if (id) {
        const { data, error } = await fastify.supabaseAdmin.rpc('replace_network_snmp_credential', { p_company_id: request.params.companyId, p_credential_id: id, p_values: safe });
        if (error) return reply.code(400).send({ error: 'Could not save SNMP credential.' });
        if (!data) return reply.code(404).send({ error: 'Credential not found.' });
        return reply.code(200).send(data);
      }
      const { data, error } = await fastify.supabaseAdmin.from('network_snmp_credentials').insert({ ...safe, company_id: request.params.companyId }).select('id,name,version,username,security_level,auth_protocol,privacy_protocol,context_name').single();
      if (error) return reply.code(400).send({ error: 'Could not save SNMP credential.' });
      return reply.code(id ? 200 : 201).send(data);
    } catch (e) { const err = e as NetworkConfigError; return reply.code(err.statusCode || 400).send({ error: err.message }); }
  };
  fastify.post<{ Params: { companyId: string } }>('/companies/:companyId/snmp-credentials', (req, rep) => upsertCredential(req, rep));
  fastify.put<{ Params: { companyId: string; credentialId: string } }>('/companies/:companyId/snmp-credentials/:credentialId', (req, rep) => upsertCredential(req, rep, req.params.credentialId));
  fastify.delete<{ Params: { companyId: string; credentialId: string } }>('/companies/:companyId/snmp-credentials/:credentialId', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.rpc('delete_network_snmp_credential', { p_company_id: request.params.companyId, p_credential_id: request.params.credentialId });
    if (error) return reply.code(500).send({ error: 'Could not delete credential.' });
    if (!data) return reply.code(404).send({ error: 'Credential not found.' });
    return reply.code(204).send();
  });
}
