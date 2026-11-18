import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import nodemailer from 'nodemailer';
import { buildApp } from '../src/app';
import { marketingConfig, marketingLink } from '../src/services/site-marketing';
import { clearSettingsCache, isMaintenanceModeEnabled } from '../src/services/settings-service';

const prefix = '/api/admin/marketing';
const publicPrefix = '/api/public/ebooks';
const id = '11111111-1111-4111-8111-111111111111';
const email = 'editor@example.test';
const formKey = 'homologacao-formulario-para-testes-marketing-1';

async function scenario(t: TestContext, enabled: boolean, maintenance = false, microsoft = false) {
  clearSettingsCache();
  t.after(clearSettingsCache);
  Object.assign(process.env, {
    SUPABASE_URL: 'http://127.0.0.1:1',
    SUPABASE_KEY: 'marketing-test-public-key',
    SUPABASE_SERVICE_ROLE_KEY: 'marketing-test-service-key',
    JWT_SECRET: 'marketing-test-jwt-secret',
    SITE_MARKETING_ENABLED: String(enabled),
    SITE_MARKETING_SITE_ORIGIN: 'https://example.test',
    SITE_MARKETING_PUBLIC_API_ORIGIN: 'http://127.0.0.1:5001',
    SITE_MARKETING_FORM_KEY: formKey,
    SITE_MARKETING_TOKEN_SECRET: 'homologacao-links-para-testes-marketing-1',
    SITE_MARKETING_DELIVERY_SMTP_HOST: '127.0.0.1',
    SITE_MARKETING_DELIVERY_SMTP_PORT: '1025',
    SITE_MARKETING_DELIVERY_SMTP_FROM: 'ebooks@example.test',
  });
  if (microsoft) {
    const mailEnv = {
      SITE_MARKETING_MICROSOFT_TENANT_ID: '11111111-1111-4111-8111-111111111111',
      SITE_MARKETING_MICROSOFT_CLIENT_ID: '22222222-2222-4222-8222-222222222222',
      SITE_MARKETING_MICROSOFT_CLIENT_SECRET: 'only-the-backend-uses-this',
      SITE_MARKETING_PANEL_ORIGIN: 'https://portal.example.test',
    };
    Object.assign(process.env, mailEnv);
    t.after(() => Object.keys(mailEnv).forEach(key => { delete process.env[key]; }));
  }
  const app = buildApp({ logger: false });
  t.after(() => app.close());
  await app.ready();
  const calls: { fn: string; params: Record<string, unknown> }[] = [];
  let role = 'admin';
  let pending: Record<string, unknown> | null = null;
  let activeMailbox: string | null = null;
  t.mock.method(app.supabaseAdmin, 'from', (table: string) => {
    if (table === 'system_settings') return { select: async () => ({
      data: [{ key: 'maintenanceMode', value: String(maintenance) }], error: null,
    }) };
    assert.equal(table, 'profiles');
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { role, status: 'active', company_id: null }, error: null,
    }) }) }) };
  });
  t.mock.method(app.supabaseAdmin, 'rpc', async (fn: string, params: Record<string, unknown>) => {
    calls.push({ fn, params });
    const operation = params.p_operation;
    if (fn === 'site_marketing_microsoft_mail') {
      const fields = params.p_data as Record<string, unknown>;
      if (operation === 'status') {
        return { data: { mailbox: activeMailbox, connected: Boolean(activeMailbox) }, error: null };
      }
      if (operation === 'begin') {
        pending = fields;
        return { data: true, error: null };
      }
      if (operation === 'take') {
        if (!pending || pending.stateHash !== fields.stateHash || pending.actor !== fields.actor) {
          return { data: null, error: null };
        }
        const { mailbox, verifier } = pending;
        pending = null;
        return { data: { id, mailbox, verifier }, error: null };
      }
      if (operation === 'connect') {
        activeMailbox = fields.mailbox as string;
        return { data: true, error: null };
      }
      if (operation === 'disconnect') {
        activeMailbox = null;
        pending = null;
        return { data: true, error: null };
      }
    }
    if (operation === 'access') return { data: { allowed: true }, error: null };
    if (operation === 'capture') return { data: { accepted: true }, error: null };
    if (operation === 'list') return { data: { ebooks: [], page: 1, hasMore: false }, error: null };
    if (operation === 'pauseCampaign') return { data: null, error: { code: '40001', message: 'internal' } };
    if (operation === 'download') return { data: null, error: { code: 'P0002', message: 'expired' } };
    if (operation === 'contacts') return { data: { contacts: [], page: 1, hasMore: false }, error: null };
    if (operation === 'unsubscribe') return { data: { unsubscribed: true }, error: null };
    throw new Error('unexpected RPC');
  });
  return {
    app, calls, setRole: (value: string) => { role = value; },
    auth: { authorization: 'Bearer ' + app.jwt.sign({ user: { id, email, role: 'admin' } }) },
  };
}

test('connects an Exchange mailbox through delegated OAuth and exposes readiness without credentials', async t => {
  const { app, auth, calls, setRole } = await scenario(t, true, false, true);
  const settings = prefix + '/email';
  const start = settings + '/microsoft/start';
  assert.equal((await app.inject({ method: 'POST', url: start, payload: { mailbox: email } })).statusCode, 401);
  const initial = await app.inject({ url: settings, headers: auth });
  assert.deepEqual(initial.json(), { configured: true, connected: false, mailbox: null });
  const started = await app.inject({ method: 'POST', url: start, headers: auth, payload: { mailbox: email } });
  assert.equal(started.statusCode, 200);
  const url = new URL(started.json().authorizationUrl);
  assert.equal(url.origin, 'https://login.microsoftonline.com');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://portal.example.test/admin/marketing/email');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope')!, /https:\/\/outlook\.office\.com\/SMTP\.Send offline_access/);
  assert.doesNotMatch(started.body, /only-the-backend-uses-this|code_verifier/);
  const exchange = t.mock.method(globalThis, 'fetch', async (input: string, init: RequestInit) => {
    assert.match(input, /^https:\/\/login\.microsoftonline\.com\/.+\/oauth2\/v2\.0\/token$/);
    const body = init.body as URLSearchParams;
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'test-code');
    assert.ok(body.get('code_verifier'));
    return Response.json({ access_token: 'smtp-access-token', refresh_token: 'smtp-refresh-token', expires_in: 3600 });
  });
  const verified = t.mock.fn(async () => true);
  t.mock.method(nodemailer, 'createTransport', (options: unknown) => {
    assert.deepEqual((options as { auth: unknown }).auth, {
      type: 'OAuth2', user: email, accessToken: 'smtp-access-token',
    });
    assert.equal((options as { host: string }).host, 'smtp.office365.com');
    return { verify: verified, close() {} };
  });
  const complete = {
    method: 'POST' as const, url: settings + '/microsoft/finish', headers: auth,
    payload: { code: 'test-code', state: url.searchParams.get('state') },
  };
  assert.equal((await app.inject({ ...complete, payload: { ...complete.payload, state: 'x'.repeat(43) } })).statusCode, 422);
  setRole('client');
  assert.equal((await app.inject(complete)).statusCode, 403);
  setRole('admin');
  const connected = await app.inject(complete);
  assert.equal(connected.statusCode, 200);
  assert.deepEqual(connected.json(), { configured: true, connected: true, mailbox: email });
  assert.equal(verified.mock.callCount(), 1);
  assert.equal(exchange.mock.callCount(), 1);
  const saved = calls.find(call => call.params.p_operation === 'connect');
  assert.ok(saved);
  assert.doesNotMatch(JSON.stringify(saved), /smtp-access-token|smtp-refresh-token/);
  assert.deepEqual((await app.inject({ url: prefix + '/access', headers: auth })).json(), {
    allowed: true, deliveryReady: true, campaignReady: true,
  });
  assert.equal((await app.inject(complete)).statusCode, 422);
  assert.equal(exchange.mock.callCount(), 1);
  assert.equal((await app.inject({ method: 'DELETE', url: settings + '/microsoft', headers: auth })).statusCode, 204);
  assert.deepEqual((await app.inject({ url: prefix + '/access', headers: auth })).json(), {
    allowed: true, deliveryReady: false, campaignReady: false,
  });
});

test('hides the disabled marketing area and checks the current role on each authenticated request', async t => {
  const { app, auth, setRole, calls } = await scenario(t, false);
  const access = await app.inject({ url: prefix + '/access', headers: auth });
  assert.equal(access.statusCode, 200);
  assert.deepEqual(access.json(), { allowed: false, deliveryReady: false, campaignReady: false });
  assert.equal((await app.inject({ url: prefix + '/contacts', headers: auth })).statusCode, 403);
  assert.equal((await app.inject(publicPrefix)).statusCode, 404);
  setRole('client');
  assert.equal((await app.inject({ url: prefix + '/access', headers: auth })).statusCode, 403);
  assert.deepEqual(calls, []);
});

test('receives a real opt-in only from the site, normalizes contact data and hides the address in the response', async t => {
  const { app, calls } = await scenario(t, true);
  const url = publicPrefix + '/guia/requests';
  const payload = { email: '  Pessoas@Example.Test ', name: ' Ana ', marketingConsent: true, website: '' };
  assert.equal((await app.inject({ method: 'POST', url, payload })).statusCode, 403);
  assert.deepEqual(calls, []);
  const response = await app.inject({ method: 'POST', url, payload, headers: { 'x-marketing-form-key': formKey } });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { accepted: true });
  assert.equal(response.headers['cache-control'], 'private, no-store');
  const [{ fn, params }] = calls;
  assert.equal(fn, 'site_marketing_public');
  assert.equal(params.p_operation, 'capture');
  assert.deepEqual(params.p_data, {
    slug: 'guia', email: 'pessoas@example.test', name: 'Ana', consent: true, sourceKey: (params.p_data as { sourceKey: string }).sourceKey,
  });
  assert.match((params.p_data as { sourceKey: string }).sourceKey, /^site:[a-f0-9]{64}$/);
});

test('rejects stale changes without returning private database errors', async t => {
  const { app, auth } = await scenario(t, true);
  const result = await app.inject({ method: 'POST', url: prefix + '/campaigns/' + id + '/pause', headers: auth, payload: { version: 2 } });
  assert.equal(result.statusCode, 409);
  assert.equal(result.json().code, 'conflict');
  assert.doesNotMatch(result.body, /internal/);
});

test('passes a signed download through Fastify routing and rejects reuse as a confirmation', async t => {
  const { app, calls } = await scenario(t, true);
  const path = new URL(marketingLink(marketingConfig(), 'download', id)).pathname;
  assert.equal((await app.inject(path)).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: path.replace('/download/', '/confirm/') })).statusCode, 404);
  assert.deepEqual(calls, [{ fn: 'site_marketing_public', params: { p_operation: 'download', p_data: { id } } }]);
});

test('keeps previously sent unsubscribe links available when the feature is paused', async t => {
  const { app, calls } = await scenario(t, false, true);
  assert.equal(await isMaintenanceModeEnabled(app.supabaseAdmin), true);
  const url = new URL(marketingLink(marketingConfig(), 'unsubscribe', id)).pathname;
  assert.equal((await app.inject(url)).statusCode, 200);
  assert.deepEqual(calls, []);
  const response = await app.inject({
    method: 'POST', url,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'List-Unsubscribe=One-Click',
  });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(calls, [{ fn: 'site_marketing_public', params: { p_operation: 'unsubscribe', p_data: { id } } }]);
});

test('checks and forwards the contact request date filter', async t => {
  const { app, auth, calls } = await scenario(t, true);
  const url = prefix + '/contacts';
  assert.equal((await app.inject({ url: url + '?from=2026-02-30', headers: auth })).statusCode, 422);
  assert.equal((await app.inject({ url: url + '?from=2026-11-17&to=2026-11-16', headers: auth })).statusCode, 422);
  assert.deepEqual(calls, []);
  assert.equal((await app.inject({ url: url + '?from=2026-11-17&to=2026-11-17', headers: auth })).statusCode, 200);
  const { params } = calls[0];
  assert.deepEqual(params.p_data, { page: 1, ebookId: undefined, status: undefined, q: undefined, from: '2026-11-17', to: '2026-11-17' });
});
