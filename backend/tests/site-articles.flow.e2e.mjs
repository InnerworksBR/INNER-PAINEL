import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';

function setting(name) {
  const value = process.env['ARTICLES_E2E_' + name];
  assert.ok(value, 'Falta ARTICLES_E2E_' + name);
  return value;
}

function localOrigin(name) {
  const url = new URL(setting(name));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), name + ' precisa ser da homologação local');
  return url.origin;
}

test('rascunho, publicação, edição, restauração e retirada no Painel e no site', async () => {
  const apiOrigin = localOrigin('API_URL');
  const siteOrigin = localOrigin('SITE_URL');
  const supabaseOrigin = localOrigin('SUPABASE_URL');
  const publicKey = setting('ANON_KEY');
  const storageHeaders = { apikey: publicKey };
  if (!publicKey.startsWith('sb_publishable_')) storageHeaders.Authorization = 'Bearer ' + publicKey;

  async function login(account) {
    const response = await fetch(apiOrigin + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: setting(account + '_EMAIL'), password: setting(account + '_PASSWORD') }),
    });
    assert.equal(response.status, 200, 'Login de homologação: ' + account);
    return (await response.json()).token;
  }

  const editor = await login('EDITOR');
  const client = await login('CLIENT');

  function api(path, { method = 'GET', token = editor, json, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (json !== undefined) headers['content-type'] = 'application/json';
    return fetch(apiOrigin + '/api/admin/artigos' + path, {
      method,
      headers,
      body: json === undefined ? form : JSON.stringify(json),
    });
  }

  async function articleFrom(response, status = 200) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body.article;
  }

  async function expectSite(path, status, includes, excludes) {
    const response = await fetch(siteOrigin + path);
    assert.equal(response.status, status, path);
    const body = await response.text();
    if (includes) assert.ok(body.includes(includes), path + ' deveria conter ' + includes);
    if (excludes) assert.ok(!body.includes(excludes), path + ' deveria omitir ' + excludes);
  }

  function siteImage(id) {
    return fetch(siteOrigin + '/artigos/midia/' + id);
  }

  function storageImage(id) {
    return fetch(supabaseOrigin + '/storage/v1/object/authenticated/site-articles/' + id + '.webp', {
      headers: storageHeaders,
    });
  }

  async function expectImage(id, visible) {
    const siteResponse = await siteImage(id);
    assert.equal(siteResponse.status, visible ? 200 : 404, 'Imagem no site: ' + id);
    if (visible) {
      assert.match(siteResponse.headers.get('content-type'), /image\/webp/);
      assert.match(siteResponse.headers.get('cache-control'), /no-store/);
      assert.ok((await siteResponse.arrayBuffer()).byteLength > 0);
    }
    const directResponse = await storageImage(id);
    assert.equal(directResponse.ok, visible, 'Acesso direto à imagem: ' + id);
    if (visible) {
      assert.match(
        directResponse.headers.get('cache-control') ?? '',
        /\bno-store\b/i,
        'Cache do Storage para imagem editorial',
      );
      await directResponse.arrayBuffer();
    }
  }

  const png = await sharp({
    create: { width: 320, height: 240, channels: 3, background: '#75a623' },
  }).png().toBuffer();

  const id = randomUUID();
  const suffix = id.slice(0, 8);
  const title = 'Homologação Artigos ' + suffix;
  const updatedTitle = 'Revisão Editorial ' + suffix;
  const slug = 'homologacao-artigos-' + suffix;
  const publicPath = '/artigos/' + slug;
  let article;

  async function upload() {
    const form = new FormData();
    form.set('file', new Blob([png], { type: 'image/png' }), 'homologacao.png');
    const response = await api('/' + id + '/media', { method: 'POST', form });
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    return { mediaId: result.mediaId, alt: 'Imagem de homologação' };
  }

  function save(fields) {
    return api('/' + id, { method: 'PATCH', json: { version: article.version, ...fields } });
  }

  function transition(action, { version = article.version, requestId = randomUUID(), revisionId } = {}) {
    return api('/' + id + '/' + action, { method: 'POST', json: { version, requestId, revisionId } });
  }

  try {
    assert.equal((await api('', { token: null })).status, 401);
    assert.equal((await api('', { method: 'POST', token: client, json: { id } })).status, 403);

    article = await articleFrom(await api('', { method: 'POST', json: { id } }), 201);
    assert.equal(article.status, 'draft');

    const cover = await upload();
    const inline = await upload();
    const fields = {
      title,
      summary: 'Resumo de homologação',
      cover,
      blocks: [
        { type: 'paragraph', text: 'Texto original de homologação' },
        { type: 'image', ...inline },
      ],
    };

    article = await articleFrom(await save(fields));
    assert.equal(article.cover.mediaId, cover.mediaId);
    const preview = await api('/' + id + '/media/' + cover.mediaId);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('cache-control'), /no-store/);
    assert.equal((await api('/' + id + '/media/' + cover.mediaId, { token: client })).status, 403);

    await expectSite('/artigos', 200, 'Artigos', title);
    await expectSite(publicPath, 404, null, title);
    await expectImage(cover.mediaId, false);
    await expectImage(inline.mediaId, false);

    const publication = { version: article.version, requestId: randomUUID() };
    article = await articleFrom(await transition('publish', publication));
    const firstRevision = article.publishedRevisionId;
    assert.equal(article.publicUrl, siteOrigin + publicPath);
    assert.equal(article.slug, slug);
    assert.equal((await articleFrom(await transition('publish', publication))).publishedRevisionId, firstRevision);
    await expectSite('/artigos', 200, title);
    await expectSite(publicPath, 200, 'Texto original de homologação');
    await expectSite('/sitemap.xml', 200, publicPath);
    await expectImage(cover.mediaId, true);
    await expectImage(inline.mediaId, true);

    const signed = await fetch(
      supabaseOrigin + '/storage/v1/object/sign/site-articles/' + cover.mediaId + '.webp',
      {
        method: 'POST',
        headers: { ...storageHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60 }),
      },
    );
    assert.equal(signed.ok, false, 'O bucket editorial não pode emitir links assinados para visitantes');

    const newCover = await upload();
    const newFields = {
      ...fields,
      title: updatedTitle,
      cover: newCover,
      blocks: [{ type: 'paragraph', text: 'Texto revisado de homologação' }],
    };
    const previousVersion = article.version;
    article = await articleFrom(await save(newFields));
    assert.equal(article.hasDraftChanges, true);
    assert.equal((await api('/' + id, {
      method: 'PATCH',
      json: { version: previousVersion, ...fields },
    })).status, 409);
    await expectSite(publicPath, 200, title, updatedTitle);
    await expectImage(cover.mediaId, true);
    await expectImage(newCover.mediaId, false);

    article = await articleFrom(await transition('publish'));
    assert.equal(article.slug, slug);
    await expectSite(publicPath, 200, updatedTitle, title);
    await expectImage(newCover.mediaId, true);
    await expectImage(cover.mediaId, false);
    await expectImage(inline.mediaId, false);

    article = await articleFrom(await transition('restore', { revisionId: firstRevision }));
    await expectSite(publicPath, 200, title, updatedTitle);
    await expectImage(cover.mediaId, true);

    article = await articleFrom(await transition('unpublish'));
    assert.equal(article.status, 'unpublished');
    await expectSite('/artigos', 200, 'Artigos', title);
    await expectSite(publicPath, 404, null, title);
    await expectSite('/sitemap.xml', 200, null, publicPath);
    await expectImage(cover.mediaId, false);
    await expectImage(inline.mediaId, false);
    await expectImage(newCover.mediaId, false);
  } finally {
    const response = await api('/' + id);
    if (response.ok) {
      article = (await response.json()).article;
      if (article.status === 'published') {
        await articleFrom(await transition('unpublish'));
      }
    }
  }
});
