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
    ] : table === 'glpi_report_previews' ? [
      { id: 'p1', company_id: 'one', state: 'ready', period_start: '2026-11-01', analysis: 'Prévia um', metrics: {}, generated_at: '2026-11-05' },
      { id: 'p2', company_id: 'two', state: 'ready', period_start: '2026-11-01', analysis: 'Prévia dois', metrics: {}, generated_at: '2026-11-05' },
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
  assert.deepEqual(response.json().map((report: any) => report.id), ['p1', 'a']);
  assert.equal(response.json()[0].is_preview, true);
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

test('manual preview ignores a client-provided company id and can be retrieved again without delay', async t => {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role: 'client', company_id: 'one' } }; });
  app.decorate('supabaseAdmin', {} as any);
  let companyUsed = '';
  await app.register(clientRoutes, { generatePreview: async (_db: any, company: string) => {
    companyUsed = company;
    return { id: 'saved-id', period_start: '2026-11-01', metrics: {}, analysis: 'Prévia', generated_at: '2026-11-05T14:00:00Z', is_preview: true };
  }} as any);
  const response = await app.inject({ method: 'POST', url: '/reports/preview?company_id=two' });
  assert.equal(response.statusCode, 200);
  assert.equal(companyUsed, 'one');
  assert.equal(response.json().is_preview, true);
  const duplicate = await app.inject({ method: 'POST', url: '/reports/preview' });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.json().id, 'saved-id');
});

test('manual preview requires a company for an admin and does not call generation', async t => {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role: 'admin', company_id: null } }; });
  app.decorate('supabaseAdmin', {} as any);
  let called = false;
  await app.register(clientRoutes, { generatePreview: async () => { called = true; throw new Error('unexpected'); } } as any);
  const response = await app.inject({ method: 'POST', url: '/reports/preview' });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});

test('rejects overlapping previews and allows a retry after a failed generation', async t => {
  const app = Fastify(); t.after(() => app.close());
  app.decorate('authenticate', async (request: any) => { request.user = { user: { role: 'client', company_id: 'one' } }; });
  app.decorate('supabaseAdmin', {} as any);
  let rejectFirst: (reason?: unknown) => void = () => {};
  let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  let calls = 0;
  await app.register(clientRoutes, { generatePreview: async () => {
    calls++;
    if (calls === 1) { started(); return new Promise((_resolve, reject) => { rejectFirst = reject; }); }
    return { is_preview: true };
  }} as any);
  const first = app.inject({ method: 'POST', url: '/reports/preview' });
  await ready;
  const concurrent = await app.inject({ method: 'POST', url: '/reports/preview' });
  assert.equal(concurrent.statusCode, 429);
  rejectFirst(new Error('GLPI unavailable'));
  assert.equal((await first).statusCode, 502);
  assert.equal((await app.inject({ method: 'POST', url: '/reports/preview' })).statusCode, 200);
});
