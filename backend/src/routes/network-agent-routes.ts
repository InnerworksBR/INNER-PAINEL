import type { FastifyInstance } from 'fastify';
import { createAgentClaims } from '../services/agent-auth-service';
import { createPairing, readPairingStatus, completePairing, PairingError } from '../services/network-pairing-service';
import { getAgentNetworkConfiguration } from '../services/network-config-service';
import { ingestNetworkBatch } from '../services/network-ingestion-service';
import { authenticateAgentRequest } from './agent-routes';
const requestBuckets = new Map<string, { start: number; count: number }>();
function limited(key: string, max: number, windowMs: number): number {
  const now = Date.now(); let bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) { bucket = { start: now, count: 0 }; requestBuckets.set(key, bucket); }
  bucket.count++;
  if (requestBuckets.size > 10_000) for (const [k, v] of requestBuckets) if (now - v.start > 60 * 60_000) requestBuckets.delete(k);
  return bucket.count <= max ? 0 : Math.ceil((windowMs - (now - bucket.start)) / 1000);
}

export default async function networkAgentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/pairings', async (request, reply) => {
    const wait = limited(`create:${request.ip}`, 5, 60 * 60_000);
    if (wait) return reply.header('Retry-After', String(wait)).code(429).send({ error: 'Limite de novas sessões atingido.' });
    const b: any = request.body;
    if (!b || typeof b.machine_id !== 'string' || !b.machine_id.trim() || b.machine_id.length > 255 || typeof b.hostname !== 'string' || !b.hostname.trim() || b.hostname.length > 255 || typeof b.agent_version !== 'string' || b.agent_version.length > 100 || typeof b.os_version !== 'string' || b.os_version.length > 255 || !Array.isArray(b.detected_networks) || b.detected_networks.length > 64 || !b.detected_networks.every((x: unknown) => typeof x === 'string' && x.length <= 64)) return reply.code(400).send({ error: 'Invalid pairing request.' });
    try { return reply.code(201).send(await createPairing(fastify.supabaseAdmin, b)); } catch (e) { return sendError(reply, e); }
  });
  fastify.post('/pairings/status', async (request, reply) => {
    const b: any = request.body;
    if (!b || typeof b.pairing_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.pairing_id) || typeof b.device_secret !== 'string' || b.device_secret.length < 40 || b.device_secret.length > 128) return reply.code(400).send({ error: 'Invalid pairing session.' });
    const wait = limited(`status:${b.pairing_id}`, 12, 60_000);
    if (wait) return reply.header('Retry-After', String(wait)).code(429).send({ error: 'Consultas da sessão limitadas.' });
    try { return reply.send(await readPairingStatus(fastify.supabaseAdmin, b.pairing_id, b.device_secret)); } catch (e) { return sendError(reply, e); }
  });
  fastify.post('/pairings/complete', async (request, reply) => {
    const b: any = request.body;
    if (!b || typeof b.pairing_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.pairing_id) || typeof b.device_secret !== 'string' || b.device_secret.length < 40 || b.device_secret.length > 128 || typeof b.refresh_token_hash !== 'string' || !/^[a-f\d]{64}$/i.test(b.refresh_token_hash)) return reply.code(400).send({ error: 'Invalid pairing completion.' });
    const wait = limited(`complete:${b.pairing_id}`, 6, 60_000);
    if (wait) return reply.header('Retry-After', String(wait)).code(429).send({ error: 'Conclusões da sessão limitadas.' });
    try {
      const result = await completePairing(fastify.supabaseAdmin, b.pairing_id, b.device_secret, b.refresh_token_hash);
      const accessToken = fastify.jwt.sign(createAgentClaims({ agent_id: result.agent_id, company_id: result.company_id }) as any, { iss: 'inner-agent', aud: 'inner-agent-api', expiresIn: '15m' });
      return reply.send({ agent_id: result.agent_id, company_id: result.company_id, access_token: accessToken, expires_in: 900 });
    } catch (e) { return sendError(reply, e); }
  });
  fastify.get('/network/config', async (request, reply) => {
    const principal = await authenticateAgentRequest(request, reply, 'network'); if (!principal) return;
    try { return reply.send(await getAgentNetworkConfiguration(fastify.supabaseAdmin, principal.agent_id)); } catch (e) { return reply.code(503).send({ error: 'Could not load network configuration.' }); }
  });
  fastify.post('/network/metrics', { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const principal = await authenticateAgentRequest(request, reply, 'network'); if (!principal) return;
    try {
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || key !== `${principal.agent_id}-${(request.body as any)?.sequence}`) return reply.code(400).send({ error: 'Invalid Idempotency-Key.' });
      const result = await ingestNetworkBatch(fastify.supabaseAdmin, principal.agent_id, principal.company_id, request.body);
      return reply.code(result.status === 'duplicate' ? 200 : 202).send(result);
    } catch (e: any) { return reply.code(e.statusCode || (e.code === 'INVALID_PAYLOAD' || e.code === 'INVALID_METRIC' ? 400 : 500)).send({ error: e.message }); }
  });
}
function sendError(reply: any, error: unknown) { const e = error as PairingError; return reply.code(e.statusCode || 503).send({ error: e.message }); }
