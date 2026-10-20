import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import agentRoutes from '../src/routes/agent-routes';
import networkAgentRoutes from '../src/routes/network-agent-routes';
import adminNetworkMonitoringRoutes from '../src/routes/admin/network-monitoring-routes';
import clientNetworkRoutes from '../src/routes/client/network-routes';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

test('administrative network routes require admin role and download path is deterministic', async () => {
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', {} as any);
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!request.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    request.user = { user: { id: 'user-id', role: request.headers.authorization === 'Bearer admin' ? 'admin' : 'client' } };
  });
  app.register(adminNetworkMonitoringRoutes, { prefix: '/api/admin/monitoring' });
  const previous = process.env.NETWORK_AGENT_PACKAGE_PATH;
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download', headers: { authorization: 'Bearer client' } })).statusCode, 403);
    process.env.NETWORK_AGENT_PACKAGE_PATH = resolve(tmpdir(), 'missing', 'Inner.Network.Agent-win-x64.zip');
    const unavailable = await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download', headers: { authorization: 'Bearer admin' } });
    assert.equal(unavailable.statusCode, 503);
    assert.match(unavailable.json().error, /ainda não foi compilado/);
    const dir = await mkdtemp(join(tmpdir(), 'network-agent-download-'));
    const packagePath = join(dir, 'Inner.Network.Agent-win-x64.zip');
    await writeFile(packagePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
    process.env.NETWORK_AGENT_PACKAGE_PATH = packagePath;
    const response = await app.inject({ method: 'GET', url: '/api/admin/monitoring/network-agent/download', headers: { authorization: 'Bearer admin' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/zip');
    assert.match(response.headers['content-disposition'], /Inner\.Network\.Agent-win-x64\.zip/);
    assert.equal(response.rawPayload.length, 5);
    await rm(dir, { recursive: true, force: true });
  } finally { await app.close(); if (previous === undefined) delete process.env.NETWORK_AGENT_PACKAGE_PATH; else process.env.NETWORK_AGENT_PACKAGE_PATH = previous; }
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

test('network list and stats page beyond 1000 rows while keeping visibility and unknown availability', async () => {
  const company = 'company-a'; const otherCompany = 'company-b'; const now = Date.now();
  const devices = Array.from({ length: 1105 }, (_, i) => ({ id: `device-${i}`, company_id: company, device_name: `device-${i}`, device_type: 'Switch', status: i === 0 ? 'Sem resposta SNMP' : 'Online', uptime_percent: i === 1 ? 80 : null, last_poll_at: new Date(now - (i === 2 ? 4 : 1) * 60_000).toISOString() }));
  devices.push({ id: 'hidden-device', company_id: company, device_name: 'hidden', device_type: 'Router', status: 'Offline', uptime_percent: 0, last_poll_at: new Date(now).toISOString() } as any);
  devices.push({ id: 'other-device', company_id: otherCompany, device_name: 'other', device_type: 'Router', status: 'Offline', uptime_percent: 0, last_poll_at: new Date(now).toISOString() } as any);
  const profiles = devices.map(d => ({ source_id: d.id, company_id: d.company_id, source_type: 'network_device', customer_visible: d.id !== 'hidden-device' }));
  class Query {
    filters: Array<[string, unknown]> = []; from = 0; to = Number.MAX_SAFE_INTEGER;
    constructor(private table: string) {}
    select() { return this; } order() { return this; }
    eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
    range(from: number, to: number) { this.from = from; this.to = to; return this; }
    async execute() {
      const rows = (this.table === 'network_devices' ? devices : profiles).filter(row => this.filters.every(([k, v]) => (row as any)[k] === v || String((row as any)[k]) === String(v)));
      return { data: rows.slice(this.from, this.to + 1), error: null };
    }
    then(resolve: any, reject: any) { return this.execute().then(resolve, reject); }
  }
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { from: (table: string) => new Query(table) } as any);
  app.decorate('authenticate', async (request: any) => { request.user = { user: { id: 'user', role: 'client', company_id: company } }; });
  app.register(clientNetworkRoutes, { prefix: '/api/client/monitoring/network' });
  try {
    const list = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices' });
    const stats = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/stats' });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().length, 1105);
    assert.equal(list.json().some((d: any) => d.id === 'hidden-device' || d.id === 'other-device'), false);
    assert.equal(stats.statusCode, 200);
    assert.equal(stats.json().total, 1105);
    assert.equal(stats.json().no_response, 1);
    assert.equal(stats.json().stale, 1);
    assert.equal(stats.json().avgUptime, 80);
    assert.equal(stats.json().uptime_measured_count, 1);
    assert.equal(stats.json().uptime_coverage_percent, 0.09);
  } finally { await app.close(); }
});

test('hidden network assets cannot be queried by known history ID and nested details keep telemetry freshness', async () => {
  const company = 'company-a';
  const source = { id: 'device-1', company_id: company, device_name: 'switch-a', device_type: 'Switch', status: 'Online', last_poll_at: new Date().toISOString(), snmp_community: 'secret' };
  let hidden = true; let historyRead = false;
  class Query {
    table: string; filters: Array<[string, unknown]> = [];
    constructor(table: string) { this.table = table; }
    select() { return this; } eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
    order() { return this; } limit() { historyRead = true; return this; } is() { return this; }
    async maybeSingle() { return { data: this.table === 'network_devices' ? source : hidden ? null : { source_id: source.id, customer_visible: true }, error: null }; }
    async single() { return { data: source, error: null }; }
  }
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { from: (table: string) => new Query(table) } as any);
  app.decorate('authenticate', async (request: any) => { request.user = { user: { id: 'user', role: 'client', company_id: company } }; });
  app.register(clientNetworkRoutes, { prefix: '/api/client/monitoring/network' });
  try {
    const hiddenHistory = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices/device-1/history' });
    assert.equal(hiddenHistory.statusCode, 404);
    assert.equal(historyRead, false);
    hidden = false;
    const detail = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices/device-1/details?company_id=company-a' });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().telemetry_status, 'fresh');
    assert.equal(detail.json().telemetry.telemetry_status, 'fresh');
    assert.equal(JSON.stringify(detail.json()).includes('secret'), false);
  } finally { await app.close(); }
});

test('legacy history is returned only for a unique same-company device name', async () => {
  const company = 'company-a';
  const devices = [
    { id: 'requested', company_id: company, device_name: 'duplicate', monitoring_source: 'legacy' },
    { id: 'hidden-collision', company_id: company, device_name: 'duplicate', monitoring_source: 'legacy' },
    { id: 'other-company', company_id: 'company-b', device_name: 'duplicate', monitoring_source: 'legacy' },
  ];
  const history = [{ id: 'legacy-row', company_id: company, network_device_id: null, device_name: 'duplicate' }];
  class Query {
    table: string; filters: Array<[string, unknown]> = []; nullFilters: string[] = [];
    constructor(table: string) { this.table = table; }
    select() { return this; } eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
    is(key: string, value: unknown) { this.nullFilters.push(key); return this; }
    order() { return this; } limit() { return this; }
    rows() { const source = this.table === 'network_devices' ? devices : history; return source.filter(row => this.filters.every(([k,v]) => (row as any)[k] === v) && this.nullFilters.every(key => (row as any)[key] == null)); }
    async single() { return { data: this.rows()[0] ?? null, error: null }; }
    async maybeSingle() { return { data: this.table === 'asset_profiles' ? { source_id: 'requested' } : this.rows()[0] ?? null, error: null }; }
    then(resolve: any, reject: any) { return Promise.resolve({ data: this.rows(), error: null }).then(resolve, reject); }
  }
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { from: (table: string) => new Query(table) } as any);
  app.decorate('authenticate', async (request: any) => { request.user = { user: { id: 'user', role: 'client', company_id: company } }; });
  app.register(clientNetworkRoutes, { prefix: '/api/client/monitoring/network' });
  try {
    const ambiguous = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices/requested/history' });
    assert.equal(ambiguous.statusCode, 200);
    assert.deepEqual(ambiguous.json(), []);
    devices.splice(1, 1);
    const unique = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices/requested/history' });
    assert.equal(unique.statusCode, 200);
    assert.deepEqual(unique.json(), history);
    const crossCompany = await app.inject({ method: 'GET', url: '/api/client/monitoring/network/devices/other-company/history' });
    assert.equal(crossCompany.statusCode, 403);
  } finally { await app.close(); }
});

test('admin network-agent list retains safe heartbeat diagnostics in its paginated projection', async () => {
  class Query {
    table: string; count = false;
    constructor(table: string) { this.table = table; }
    select(_fields: string, options?: any) { this.count = !!options?.count; return this; }
    eq() { return this; } order() { return this; } range() { return this; }
    then(resolve: any, reject: any) {
      const result = this.table === 'registered_agents'
        ? { data: [{ id: 'agent-1', hostname: 'collector', agent_version: '1.0', status: 'Online', last_heartbeat: 'now', metadata: { discovery_state: 'discovering', last_discovery_at: '2026-10-19T12:00:00Z', last_collection_result: 'success', pending_count: 2 }, agent_secret: 'never-select-me' }], error: null }
        : { data: null, count: 3, error: null };
      return Promise.resolve(result).then(resolve, reject);
    }
  }
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', { from: (table: string) => new Query(table) } as any);
  app.decorate('authenticate', async (request: any) => { request.user = { user: { id: 'admin', role: 'admin' } }; });
  app.register(adminNetworkMonitoringRoutes, { prefix: '/api/admin/monitoring' });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/admin/monitoring/companies/company-a/network-agents' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json()[0].discovery_state, 'discovering');
    assert.equal(response.json()[0].last_discovery_at, '2026-10-19T12:00:00Z');
    assert.equal(response.json()[0].pending_count, 2);
    assert.equal(JSON.stringify(response.json()).includes('never-select-me'), false);
  } finally { await app.close(); }
});
