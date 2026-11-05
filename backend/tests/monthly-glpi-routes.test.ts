import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import clientRoutes from '../src/routes/client/monthly-glpi-report-routes';
import adminRoutes from '../src/routes/admin/monthly-glpi-settings-routes';

async function appFor(t: any, role: string, company: string | null) {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role, company_id: company } }; });
  app.decorate('supabaseAdmin', { from(table: string) {
    let rows = table === 'monthly_glpi_reports' ? [
      { id: 'a', company_id: 'one', state: 'ready', period_start: '2026-10-01', analysis: 'Empresa um', metrics: {}, generated_at: '2026-11-01' },
      { id: 'b', company_id: 'two', state: 'ready', period_start: '2026-10-01', analysis: 'Empresa dois', metrics: {}, generated_at: '2026-11-01' },
    ] : [];
    const query: any = { select: () => query, eq: (k: string, v: any) => { rows = rows.filter(row => (row as any)[k] === v); return query; }, order: () => query, range: () => query,
      then: (resolve: any) => resolve({ data: rows, error: null }) };
    return query;
  }} as any);
  await app.register(clientRoutes);
  return app;
}

test('client cannot select reports of a different company', async t => {
  const app = await appFor(t, 'client', 'one');
  const response = await app.inject('/reports?company_id=two');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().map((report: any) => report.id), ['a']);
});

test('admin must explicitly select one company', async t => {
  const app = await appFor(t, 'admin', null);
  const response = await app.inject('/reports');
  assert.equal(response.statusCode, 400);
});

test('only administrators can change monthly report recipients', async t => {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role: 'client', company_id: 'one' } }; });
  app.decorate('supabaseAdmin', {} as any);
  await app.register(adminRoutes);
  const response = await app.inject({ method: 'PUT', url: '/two/monthly-glpi-settings', payload: { enabled: true, recipients: 'other@example.com' } });
  assert.equal(response.statusCode, 403);
});

test('rejects activation without valid explicit recipients', async t => {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role: 'admin' } }; });
  app.decorate('supabaseAdmin', {} as any);
  await app.register(adminRoutes);
  const response = await app.inject({ method: 'PUT', url: '/one/monthly-glpi-settings', payload: { enabled: true, recipients: '' } });
  assert.equal(response.statusCode, 400);
});
