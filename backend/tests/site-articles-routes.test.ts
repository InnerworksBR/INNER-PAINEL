import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import sharp from 'sharp';
import { buildApp } from '../src/app';
import type { UserProfile } from '../src/types';

const prefix = '/api/admin/artigos';
const articleId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const actor: UserProfile = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'admin@example.com',
  role: 'admin',
  company_id: null,
  status: 'active',
};
const draft = {
  id: articleId, slug: null, version: 1, title: '', status: 'draft',
  publishedAt: null, updatedAt: '2026-11-16T15:20:10Z', summary: '',
  cover: null, blocks: [], publishedRevisionId: null, hasDraftChanges: false, revisions: [],
};
const articlePath = prefix + '/' + articleId;

type RpcCall = { name: string; params: Record<string, unknown> };
type RpcResult = { data: unknown; error: { code: string; message: string } | null };
const ok = (data: unknown): RpcResult => ({ data, error: null });
const failure = (code: string): RpcResult => ({
  data: null, error: { code, message: 'private database message' },
});

async function appFor(t: TestContext, enabled?: string, publicOrigin?: string) {
  // Fake only Supabase operations. JWT verification, live role refresh and route registration run through buildApp.
  process.env.SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.SUPABASE_KEY = 'site-articles-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'site-articles-test-service-key';
  process.env.JWT_SECRET = 'site-articles-test-jwt-secret';
  if (publicOrigin === undefined) delete process.env.SITE_ARTICLES_PUBLIC_ORIGIN;
  else process.env.SITE_ARTICLES_PUBLIC_ORIGIN = publicOrigin;
  if (enabled === undefined) delete process.env.SITE_ARTICLES_ENABLED;
  else process.env.SITE_ARTICLES_ENABLED = enabled;

  const app = buildApp({ logger: false });
  t.after(() => app.close());
  await app.ready();
  const state = {
    role: 'admin' as UserProfile['role'],
    status: 'active',
    allowed: true,
    respond: (_call: RpcCall): RpcResult => { throw new Error('Unexpected editorial RPC'); },
  };
  const calls: RpcCall[] = [];
  const objects = new Map<string, Buffer>();
  t.mock.method(app.supabaseAdmin, 'from', (table: string) => {
    if (table === 'system_settings') return { select: async () => ok([]) };
    assert.equal(table, 'profiles');
    return {
      select: () => ({
        eq: (_column: string, id: string) => {
          assert.equal(id, actor.id);
          return { maybeSingle: async () => ok({ role: state.role, status: state.status, company_id: null }) };
        },
      }),
    };
  });
  t.mock.method(app.supabaseAdmin, 'rpc', async (name: string, params: RpcCall['params']) => {
    calls.push({ name, params });
    assert.equal(params.p_actor_id, actor.id);
    if (name === 'site_article_allowed') return ok(state.allowed);
    return state.respond({ name, params });
  });
  t.mock.method(app.supabaseAdmin.storage, 'from', (bucket: string) => {
    assert.equal(bucket, 'site-articles');
    return {
      async upload(key: string, data: Buffer, options: { upsert: boolean; contentType: string; cacheControl?: string }) {
        assert.deepEqual(options, {
          upsert: false, contentType: 'image/webp', cacheControl: '0',
          headers: { 'cache-control': 'private, no-store' },
        });
        objects.set(key, data);
        return ok({ path: key });
      },
      async remove(keys: string[]) {
        for (const key of keys) objects.delete(key);
        return ok([]);
      },
      async download(key: string) {
        const data = objects.get(key);
        return data ? ok(new Blob([new Uint8Array(data)])) : failure('404');
      },
    };
  });
  const headers = { authorization: 'Bearer ' + app.jwt.sign({ user: actor }) };
  return { app, state, headers, calls, objects };
}

test('the feature defaults off without asking for editorial permission', async t => {
  const { app, headers, calls } = await appFor(t);
  const access = await app.inject({ url: prefix + '/access', headers });
  assert.equal(access.statusCode, 200);
  assert.deepEqual(access.json(), { allowed: false });
  assert.equal(access.headers['cache-control'], 'private, no-store');
  assert.equal((await app.inject({ url: prefix, headers })).statusCode, 403);
  assert.deepEqual(calls, []);
});

test('an administrator loses access on the request after editorial permission is revoked', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  assert.deepEqual((await app.inject({ url: prefix + '/access', headers })).json(), { allowed: true });
  state.allowed = false;
  const list = await app.inject({ url: prefix, headers });
  assert.equal(list.statusCode, 403);
  assert.deepEqual((await app.inject({ url: prefix + '/access', headers })).json(), { allowed: false });
  assert.deepEqual(calls.map(call => call.name), ['site_article_allowed', 'site_article_allowed', 'site_article_allowed']);
});

test('editorial endpoints reject an unsigned request and a stale admin token', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  assert.equal((await app.inject(prefix + '/access')).statusCode, 401);
  state.role = 'client';
  assert.equal((await app.inject({ url: prefix + '/access', headers })).statusCode, 403);
  state.role = 'admin';
  state.status = 'blocked';
  assert.equal((await app.inject({ url: articlePath, headers })).statusCode, 403);
  assert.deepEqual(calls, []);
});

test('list returns 20 articles and a next-page signal, with public links for published articles only', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  state.respond = () => {
    const { id, version, updatedAt } = draft;
    return ok(Array.from({ length: 21 }, (_, index) => ({
      id, version, updatedAt, slug: 'artigo-' + index, title: 'Artigo ' + index,
      status: index === 0 ? 'published' : 'unpublished', publishedAt: index === 0 ? updatedAt : null,
    })));
  };
  const response = await app.inject({ url: prefix + '?page=2', headers });
  assert.equal(response.statusCode, 200);
  const { articles, hasMore } = response.json();
  assert.equal(articles.length, 20);
  assert.equal(hasMore, true);
  assert.equal(articles[0].publicUrl, 'https://innerworks.com.br/artigos/artigo-0');
  assert.equal(articles[1].publicUrl, null);
  assert.deepEqual(calls[1], { name: 'site_article_list', params: { p_actor_id: actor.id, p_page: 2 } });
});

test('create returns the draft for the client-generated identifier', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  state.respond = () => ok(draft);
  const response = await app.inject({ method: 'POST', url: prefix, headers, payload: { id: articleId } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { article: { ...draft, publicUrl: null } });
  assert.deepEqual(calls[1], { name: 'site_article_create', params: { p_actor_id: actor.id, p_article_id: articleId } });
});

test('published detail links use the configured public origin', async t => {
  const { app, headers, state } = await appFor(t, 'true', 'https://preview.example.com/');
  state.respond = () => ok({
    ...draft, slug: 'artigo', status: 'published', publishedAt: draft.updatedAt, publishedRevisionId: revisionId,
  });
  const response = await app.inject({ url: articlePath, headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().article.publicUrl, 'https://preview.example.com/artigos/artigo');
});

test('draft saves allow unfinished blocks and preserve typed text for safe rendering', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  const blocks = [{ type: 'paragraph', text: '<exemplo>' }, { type: 'list', ordered: false, items: [] }];
  state.respond = () => ok({ ...draft, version: 2, blocks, hasDraftChanges: true });
  const response = await app.inject({
    method: 'PATCH', url: articlePath, headers, payload: { version: 1, title: '', summary: '', cover: null, blocks },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().article.blocks, blocks);
  assert.deepEqual(calls[1], {
    name: 'site_article_save',
    params: { p_actor_id: actor.id, p_article_id: articleId, p_version: 1, p_title: '', p_summary: '', p_cover: null, p_blocks: blocks },
  });
});

test('bad versions, pages and structured content never reach the editorial RPCs', async t => {
  const { app, headers, calls } = await appFor(t, 'true');
  const valid = { version: 1, title: '', summary: '', cover: null, blocks: [] };
  const invalid = [
    { ...valid, version: '1' },
    { ...valid, title: 'x'.repeat(161) },
    { ...valid, summary: 'x'.repeat(321) },
    { ...valid, cover: { mediaId: 'https://example.com/image.webp', alt: '' } },
    { ...valid, blocks: [{ type: 'html', html: '<p>raw</p>' }] },
    { ...valid, blocks: [{ type: 'list', ordered: 'false', items: [] }] },
    { ...valid, blocks: [{ type: 'paragraph', text: 'x'.repeat(4001) }] },
    { ...valid, blocks: Array.from({ length: 101 }, () => ({ type: 'paragraph', text: '' })) },
  ];
  for (const payload of invalid) {
    const response = await app.inject({ method: 'PATCH', url: articlePath, headers, payload });
    assert.equal(response.statusCode, 422);
  }
  for (const url of [prefix + '?page=0', prefix + '?page=1.1', prefix + '?page=1&page=2', prefix + '/not-an-id']) {
    assert.equal((await app.inject({ url, headers })).statusCode, 422);
  }
  assert.ok(calls.every(call => call.name === 'site_article_allowed'));
});

test('draft JSON exceeding the route body limit returns 413 before saving', async t => {
  const { app, headers, calls } = await appFor(t, 'true');
  const blocks = Array.from({ length: 70 }, () => ({ type: 'paragraph', text: 'x'.repeat(4000) }));
  const response = await app.inject({
    method: 'PATCH', url: articlePath, headers, payload: { version: 1, title: '', summary: '', cover: null, blocks },
  });
  assert.equal(response.statusCode, 413);
  assert.deepEqual(calls.map(call => call.name), ['site_article_allowed']);
});

test('transitions forward the expected version, request ID and server audit context', async t => {
  const { app, headers, calls, state } = await appFor(t, 'true');
  state.respond = () => ok(draft);
  for (const action of ['publish', 'unpublish', 'restore']) {
    const response = await app.inject({
      method: 'POST', url: articlePath + '/' + action, headers: { ...headers, 'user-agent': 'editor-tests' },
      remoteAddress: '127.0.0.5', payload: { version: 2, requestId, ...(action === 'restore' ? { revisionId } : {}) },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls.at(-1), {
      name: 'site_article_transition',
      params: {
        p_actor_id: actor.id, p_actor_email: actor.email, p_article_id: articleId,
        p_version: 2, p_request_id: requestId, p_action: action,
        p_revision_id: action === 'restore' ? revisionId : null, p_ip: '127.0.0.5', p_user_agent: 'editor-tests',
      },
    });
  }
});

test('database validation, permission, conflict and missing responses do not expose database messages', async t => {
  const { app, headers, state } = await appFor(t, 'true');
  for (const [code, status] of [['42501', 403], ['P0002', 404], ['PT409', 409], ['PT422', 422], ['XX000', 500]] as const) {
    state.respond = () => failure(code);
    const response = await app.inject({ url: articlePath, headers });
    assert.equal(response.statusCode, status);
    assert.equal(typeof response.json().error, 'string');
    assert.doesNotMatch(response.body, /private database message/);
  }
});

const boundary = 'image-test-boundary';
function upload(headers: { authorization: string }, ...files: Buffer[]) {
  const parts = files.flatMap(file => [
    Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'),
    file,
    Buffer.from('\r\n'),
  ]);
  return {
    method: 'POST' as const,
    url: articlePath + '/media',
    headers: { ...headers, 'content-type': 'multipart/form-data; boundary=' + boundary },
    payload: Buffer.concat([...parts, Buffer.from('--' + boundary + '--\r\n')]),
  };
}

const picture = () => sharp({ create: { width: 2400, height: 240, channels: 3, background: 'white' } })
  .withExif({ IFD0: { Artist: 'Private test metadata' } }).jpeg().toBuffer();

test('upload recodes the image before registering it and preview only serves registered media', async t => {
  const { app, headers, state, objects } = await appFor(t, 'true');
  let registered = '';
  state.respond = ({ name, params }) => {
    if (name === 'site_article_add_media') {
      assert.equal(params.p_article_id, articleId);
      assert.equal(params.p_width, 1600);
      assert.equal(params.p_height, 160);
      registered = String(params.p_media_id);
      assert.ok(objects.has(registered + '.webp'));
      return ok(null);
    }
    assert.equal(name, 'site_article_get_media');
    return ok(params.p_media_id === registered && params.p_article_id === articleId);
  };
  const uploaded = await app.inject(upload(headers, await picture()));
  assert.equal(uploaded.statusCode, 201);
  assert.match(registered, /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/);
  assert.deepEqual(uploaded.json(), { mediaId: registered, width: 1600, height: 160 });
  const previewUrl = articlePath + '/media/' + registered;
  const preview = await app.inject({ url: previewUrl, headers });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.headers['content-type'], 'image/webp');
  assert.equal(preview.headers['cache-control'], 'private, no-store');
  assert.equal(preview.headers['x-content-type-options'], 'nosniff');
  const metadata = await sharp(preview.rawPayload).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.equal((await app.inject({ url: prefix + '/' + revisionId + '/media/' + registered, headers })).statusCode, 404);
  state.allowed = false;
  assert.equal((await app.inject({ url: previewUrl, headers })).statusCode, 403);
});

test('oversized images, extra file parts and non-images do not write to storage', async t => {
  const { app, headers, objects } = await appFor(t, 'true');
  const invalidImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"></svg>');
  assert.equal((await app.inject(upload(headers, invalidImage))).statusCode, 422);
  assert.equal((await app.inject(upload(headers, Buffer.alloc(8 * 1024 * 1024 + 1)))).statusCode, 413);
  const file = await picture();
  assert.equal((await app.inject(upload(headers, file, file))).statusCode, 422);
  assert.equal(objects.size, 0);
});

test('an uncertain registration result preserves the stored media object', async t => {
  const { app, headers, state, objects } = await appFor(t, 'true');
  state.respond = () => failure('NETWORK_ERROR');
  assert.equal((await app.inject(upload(headers, await picture()))).statusCode, 500);
  assert.equal(objects.size, 1);
});

test('a confirmed rollback removes the newly uploaded object', async t => {
  const { app, headers, state, calls, objects } = await appFor(t, 'true');
  state.respond = () => failure('P0002');
  assert.equal((await app.inject(upload(headers, await picture()))).statusCode, 404);
  assert.equal(calls.at(-1)?.name, 'site_article_add_media');
  assert.equal(objects.size, 0);
});
