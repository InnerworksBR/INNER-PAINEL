import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import agentRoutes from '../src/routes/agent-routes';
import networkAgentRoutes from '../src/routes/network-agent-routes';
import adminNetworkMonitoringRoutes from '../src/routes/admin/network-monitoring-routes';

function appWithDb(db: any, claims?: any) {
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', db);
  app.decorateRequest('user', null);
  app.decorateRequest('jwtVerify', async function (this: any) {
    if (!claims) throw new Error('missing bearer');
    this.user = claims;
  });
  app.register(networkAgentRoutes, { prefix: '/api/agent/v1' });
  return app;
}

test('pairing rejects malformed bodies and rate limits a source IP', async () => {
  const app = appWithDb({});
  try {
    const invalid = await app.inject({ method: 'POST', url: '/api/agent/v1/pairings', payload: { machine_id: 5 } });
    assert.equal(invalid.statusCode, 400);
    for (let i = 0; i < 4; i++) await app.inject({ method: 'POST', url: '/api/agent/v1/pairings', payload: { machine_id: 5 } });
    const limited = await app.inject({ method: 'POST', url: '/api/agent/v1/pairings', payload: { machine_id: 5 } });
    assert.equal(limited.statusCode, 429);
    assert.ok(limited.headers['retry-after']);
  } finally { await app.close(); }
});

test('network config endpoint rejects anonymous requests', async () => {
  const app = appWithDb({});
  try {
    const response = await app.inject({ method: 'GET', url: '/api/agent/v1/network/config' });
    assert.equal(response.statusCode, 401);
  } finally { await app.close(); }
});

test('Hyper-V credentials cannot read the network-agent configuration namespace', async () => {
  const query = {
    select() { return this; }, eq() { return this; }, neq() { return this; },
    async maybeSingle() { return { data: { id: 'agent-id', company_id: 'company-id', status: 'Online', agent_kind: 'hyperv' }, error: null }; },
  };
  const app = appWithDb({ from: () => query }, { kind: 'agent', agent_id: 'agent-id', company_id: 'company-id' });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/agent/v1/network/config' });
    assert.equal(response.statusCode, 403);
  } finally { await app.close(); }
});

test('network metrics accepts the documented payload size above Fastify’s default 1 MiB limit', async () => {
  const query = {
    select() { return this; }, eq() { return this; }, neq() { return this; },
    async maybeSingle() { return { data: { id: 'agent-id', company_id: 'company-id', status: 'Online', agent_kind: 'network' }, error: null }; },
  };
  const db = { from: () => query, async rpc(_name: string, args: any) { return { data: { status: 'accepted', sequence: args.p_batch.sequence }, error: null }; } };
  const app = appWithDb(db, { kind: 'agent', agent_id: 'agent-id', company_id: 'company-id' });
  const interfaces = Array.from({ length: 4096 }, (_, if_index) => ({ if_index, name: 'eth0', description: 'x'.repeat(255) }));
  const payload = { sequence: 123, collected_at: new Date().toISOString(), devices: [{ network_id: '11111111-1111-4111-8111-111111111111', device_uid: 'uid', ip_address: '10.0.0.1', device_name: 'switch', device_type: 'Switch', observed_at: new Date().toISOString(), result: 'success', interfaces }] };
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) > 1024 * 1024);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/agent/v1/network/metrics', headers: { 'idempotency-key': 'agent-id-123' }, payload });
    assert.equal(response.statusCode, 202);
  } finally { await app.close(); }
});

test('administrative network routes require admin role and download is unavailable before packaging', async () => {
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', {} as any);
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!request.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    request.user = { user: { id: 'user-id', role: request.headers.authorization === 'Bearer admin' ? 'admin' : 'client' } };
  });
  app.register(adminNetworkMonitoringRoutes, { prefix: '/api/admin/monitoring' });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download', headers: { authorization: 'Bearer client' } })).statusCode, 403);
    const response = await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download', headers: { authorization: 'Bearer admin' } });
    assert.equal(response.statusCode, 503);
    assert.match(response.json().error, /ainda não foi compilado/);
  } finally { await app.close(); }
});

test('credential replacement goes through the atomic RPC and never returns its secret', async () => {
  const previous = process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY;
  process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
  let rpcName = '';
  let rpcArgs: any;
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { async rpc(name: string, args: any) { rpcName = name; rpcArgs = args; return { data: { id: 'credential-id', name: 'core', version: '2c' }, error: null }; } } as any);
  app.decorate('authenticate', async (request: any) => { request.user = { user: { id: 'admin-id', role: 'admin' } }; });
  app.register(adminNetworkMonitoringRoutes, { prefix: '/api/admin/monitoring' });
  try {
    const response = await app.inject({ method: 'PUT', url: '/api/admin/monitoring/companies/company-id/snmp-credentials/credential-id', payload: { name: 'core', version: '2c', community: 'must-not-return' } });
    assert.equal(response.statusCode, 200);
    assert.equal(rpcName, 'replace_network_snmp_credential');
    assert.equal(rpcArgs.p_company_id, 'company-id');
    assert.equal(JSON.stringify(response.json()).includes('must-not-return'), false);
    assert.ok(rpcArgs.p_values.ciphertext);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY; else process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY = previous;
  }
});

test('refresh route accepts a pre-persisted network replacement token for safe retries', async () => {
  let rpcName = '';
  let rpcArgs: any;
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { async rpc(name: string, args: any) { rpcName = name; rpcArgs = args; return { data: { id: 'network-agent', company_id: 'company', hostname: 'collector', agent_version: '1' }, error: null }; } } as any);
  app.decorate('jwt', { sign: () => 'access-token' } as any);
  app.register(agentRoutes, { prefix: '/api/agent/v1' });
  try {
    const oldToken = 'o'.repeat(48);
    const replacementToken = 'n'.repeat(48);
    const response = await app.inject({ method: 'POST', url: '/api/agent/v1/refresh', payload: { refresh_token: oldToken, replacement_refresh_token: replacementToken } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().refresh_token, replacementToken);
    assert.equal(rpcName, 'rotate_network_agent_refresh_token');
    assert.ok(rpcArgs.p_current_hash);
    assert.notEqual(rpcArgs.p_current_hash, 'old-persisted-token');
  } finally { await app.close(); }
});
