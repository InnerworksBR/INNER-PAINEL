import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import dashboardRoutes from '../src/routes/client/dashboard-routes';
import glpiRoutes from '../src/routes/client/glpi-routes';
import metricsRoutes from '../src/routes/client/metrics-routes';

async function summary(t: any, tables: Record<string, any[]>, failedTable?: string, path = '/summary') {
  const app = Fastify();
  t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => {
    request.user = { user: { role: 'client', company_id: 'c1' } };
  });
  app.decorate('supabaseAdmin', { from(table: string) {
    let rows = tables[table] || [];
    const query: any = {
      select: () => query,
      eq: (key: string, value: any) => { rows = rows.filter(row => row[key] === value); return query; },
      order: () => query,
      range: (start: number, end: number) => { rows = rows.slice(start, end + 1); return query; },
      then: (resolve: any) => resolve({ data: rows.slice(0, 500), error: table === failedTable ? new Error('database unavailable') : null }),
    };
    return query;
  }} as any);
  await app.register(dashboardRoutes);
  await app.register(glpiRoutes, { prefix: '/glpi' });
  await app.register(metricsRoutes, { prefix: '/metrics' });
  return app.inject(path);
}

test('dashboard counts the same native servers as the server list without requiring profiles', async t => {
  const now = new Date().toISOString();
  const servers = Array.from({ length: 13 }, (_, id) => ({ id, company_id: 'c1', monitoring_source: 'agent_native', status: id < 9 ? 'Online' : 'Offline', last_updated: now }));
  servers.push({ id: 99, company_id: 'other', monitoring_source: 'agent_native', status: 'Online', last_updated: now });
  const response = await summary(t, { servers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().servers.total, 13);
  assert.equal(response.json().servers.online, 9);
  assert.equal(response.json().servers.offline, 4);
});

test('dashboard marks stale native metrics offline', async t => {
  const response = await summary(t, { servers: [{ id: 1, company_id: 'c1', monitoring_source: 'agent_native', status: 'Online', last_updated: '2020-01-01' }] });
  assert.equal(response.json().servers.offline, 1);
});

test('dashboard counts unresolved tickets across all database pages', async t => {
  const tickets = Array.from({ length: 503 }, (_, id) => ({ id, company_id: 'c1', status: id < 490 ? 'Resolvido' : 'Novo' }));
  const response = await summary(t, { glpi_tickets: tickets });
  assert.equal(response.json().tickets.total, 503);
  assert.equal(response.json().tickets.open, 13);
});

test('health with no monitored assets is explicitly unavailable', async t => {
  const response = await summary(t, {});
  assert.equal(response.json().health.hasData, false);
  assert.equal(response.json().health.warning, 0);
});

test('query errors do not become a successful empty dashboard', async t => {
  const response = await summary(t, {}, 'servers');
  assert.equal(response.statusCode, 500);
});

test('ticket list and statistics agree with dashboard beyond the database page limit', async t => {
  const glpi_tickets = Array.from({ length: 503 }, (_, id) => ({ id, company_id: 'c1', status: id < 490 ? 'Resolvido' : 'Novo', requester: '11', category: '3' }));
  const list = await summary(t, { glpi_tickets }, undefined, '/glpi/tickets');
  const stats = await summary(t, { glpi_tickets }, undefined, '/glpi/stats');
  assert.equal(list.json().length, 503);
  assert.equal(stats.json().open, 13);
  assert.equal(list.json()[0].requester, 'Requerente não informado');
  assert.deepEqual(stats.json().topRequesters, []);
  assert.deepEqual(stats.json().byCategory, { 'Categoria não informada': 503 });
});

test('server list retains all native servers across database pages', async t => {
  const servers = Array.from({ length: 503 }, (_, id) => ({ id, company_id: 'c1', monitoring_source: 'agent_native', status: 'Offline' }));
  const list = await summary(t, { servers }, undefined, '/metrics/servers');
  assert.equal(list.json().length, 503);
});

test('stale metrics in attention are not counted as offline', async t => {
  const last_updated = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const response = await summary(t, { servers: [{ id: 1, company_id: 'c1', monitoring_source: 'agent_native', status: 'Online', last_updated }] });
  assert.equal(response.json().servers.warning, 1);
  assert.equal(response.json().servers.offline, 0);
  assert.equal(response.json().health.warning, 100);
});
