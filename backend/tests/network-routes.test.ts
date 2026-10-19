import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
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
