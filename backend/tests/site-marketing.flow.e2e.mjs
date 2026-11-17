import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';

function localOrigin(name) {
  const url = new URL(process.env['MARKETING_E2E_' + name]);
  assert.equal(url.protocol, 'http:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use somente homologação local.');
  assert.equal(url.href, url.origin + '/');
  return url.origin;
}

function fixturePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 120] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 5\n0000000000 65535 f \n';
  for (const offset of offsets) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(pdf);
}

test('site, Painel, Supabase e SMTP completam o fluxo de Marketing em homologação', { timeout: 220000 }, async t => {
  const api = localOrigin('API_URL');
  const panel = localOrigin('PANEL_URL');
  const site = localOrigin('SITE_URL');
  const mail = localOrigin('MAILPIT_URL');
  const accounts = JSON.parse(await readFile(process.env.MARKETING_E2E_ACCOUNTS, 'utf8'));
  const browserRequire = createRequire(resolve(process.env.MARKETING_E2E_BROWSER_DIR, 'package.json'));
  const { chromium } = browserRequire('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 860 } });
  const publicPage = await context.newPage();
  const adminPage = await context.newPage();
  publicPage.setDefaultTimeout(30000);
  adminPage.setDefaultTimeout(45000);
  t.after(() => browser.close());
  await context.route('**/*', route => {
    const allowed = [api, panel, site].includes(new URL(route.request().url()).origin);
    return allowed ? route.continue() : route.abort();
  });

  const marker = randomUUID().slice(0, 8);
  const contacts = {
    a: 'ebook-a-' + marker + '@example.test',
    b: 'ebook-b-' + marker + '@example.test',
    onlyEbook: 'ebook-only-' + marker + '@example.test',
    preview: 'ebook-preview-' + marker + '@example.test',
  };
  const title = 'Guia de homologação ' + marker;
  const prefix = '/api/admin/marketing';
  const publicPrefix = '/api/public/ebooks';
  const pdf = fixturePdf();
  const cover = await sharp({ create: { width: 500, height: 360, channels: 3, background: '#174267' } }).png().toBuffer();
  let token;
  let ebook;

  async function json(path, { method = 'GET', body, expected = 200, auth = true } = {}) {
    const multipart = body instanceof FormData;
    const response = await fetch(api + path, {
      method, redirect: 'manual',
      headers: {
        ...(auth && token ? { authorization: 'Bearer ' + token } : {}),
        ...(body && !multipart ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    assert.equal(response.status, expected, path + ' returned ' + response.status + ': ' + (payload.error || ''));
    return payload;
  }
  async function eventually(probe, label, timeout = 25000) {
    const until = Date.now() + timeout;
    do {
      const value = await probe();
      if (value) return value;
      await sleep(400);
    } while (Date.now() < until);
    assert.fail('Tempo esgotado esperando ' + label);
  }
  async function inbox() {
    const response = await fetch(mail + '/api/v1/messages?limit=100');
    assert.equal(response.status, 200);
    return (await response.json()).messages;
  }
  function isTo(message, address) {
    return message.To?.some(person => person.Address === address);
  }
  async function messageFor(address, subject, timeout = 25000) {
    const entry = await eventually(async () => (await inbox()).find(m => isTo(m, address) && m.Subject === subject), subject + ' na caixa de teste', timeout);
    const response = await fetch(mail + '/api/v1/message/' + encodeURIComponent(entry.ID));
    assert.equal(response.status, 200);
    return { ...entry, ...await response.json() };
  }
  function emailLink(message, action) {
    return (message.Text.match(/http:\/\/\S+/g) ?? []).find(link => {
      const target = new URL(link);
      return target.origin === api && target.pathname.startsWith(publicPrefix + '/' + action + '/');
    });
  }
  async function fillForm(address, consent) {
    await publicPage.goto(site + '/ebooks/' + ebook.slug);
    await publicPage.locator('input[name=email]').fill(address);
    await publicPage.locator('input[name=name]').fill('Pessoa de teste');
    const checkbox = publicPage.locator('input[name=marketingConsent]');
    assert.equal(await checkbox.isChecked(), false);
    if (consent) await checkbox.check();
    await publicPage.locator('form').getByRole('button', { name: /e-book/i }).click();
    await publicPage.getByRole('status').filter({ hasText: 'Solicitação recebida.' }).waitFor();
  }
  async function attach(kind, name, bytes, type) {
    const body = new FormData();
    body.append('file', new Blob([bytes], { type }), name);
    ebook = (await json(prefix + '/ebooks/' + ebook.id + '/' + kind + '?version=' + ebook.version, { method: 'POST', body })).ebook;
  }
  async function createCampaign(suffix) {
    return (await json(prefix + '/campaigns', {
      method: 'POST', expected: 201,
      body: { name: 'Campanha ' + suffix + ' ' + marker, subject: 'Ofertas ' + suffix + ' ' + marker, body: 'Teste de campanha em homologação.', ebookId: ebook.id },
    })).campaign;
  }
  const campaignAction = async (campaign, action, body = {}) => json(prefix + '/campaigns/' + campaign.id + '/' + action, {
    method: 'POST', body: { version: campaign.version, ...body },
  });
  const audience = async campaign => (await json(prefix + '/campaigns/' + campaign.id + '/audience')).eligible;

  try {
    ({ token } = await json('/api/auth/login', { method: 'POST', body: accounts.editor, auth: false }));
    assert.ok(token);
    assert.deepEqual(await json(prefix + '/access'), { allowed: true, deliveryReady: true, campaignReady: true });
    ebook = (await json(prefix + '/ebooks', { method: 'POST', expected: 201, body: { title, description: 'Um e-book de teste para verificar o cadastro e a entrega.' } })).ebook;
    await attach('cover', 'capa.png', cover, 'image/png');
    await attach('pdf', 'guia.pdf', pdf, 'application/pdf');
    ebook = (await json(prefix + '/ebooks/' + ebook.id + '/publish', { method: 'POST', body: { version: ebook.version } })).ebook;
    assert.equal(ebook.publicUrl, site + '/ebooks/' + ebook.slug);
    await publicPage.goto(site + '/ebooks');
    await publicPage.locator('a[href="/ebooks/' + ebook.slug + '"]').first().waitFor();
    await fillForm(contacts.a, true);
    await fillForm(contacts.a, true);
    await fillForm(contacts.b, true);
    await fillForm(contacts.onlyEbook, false);

    const deliverySubject = 'Seu e-book está pronto';
    const a = await messageFor(contacts.a, deliverySubject);
    const b = await messageFor(contacts.b, deliverySubject);
    const only = await messageFor(contacts.onlyEbook, deliverySubject);
    assert.equal((await inbox()).filter(m => isTo(m, contacts.a) && m.Subject === deliverySubject).length, 1);
    assert.equal(emailLink(only, 'confirm'), undefined);
    const download = emailLink(only, 'download');
    assert.ok(download);
    const pdfResponse = await fetch(download);
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get('content-disposition'), /^attachment/);
    assert.deepEqual(Buffer.from(await pdfResponse.arrayBuffer()), pdf);

    let manual = await createCampaign('manual');
    assert.equal(await audience(manual), 0);
    for (const delivery of [a, b]) {
      const confirm = emailLink(delivery, 'confirm');
      assert.ok(confirm);
      const page = await fetch(confirm);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Confirmar inscrição/);
    }
    assert.equal(await audience(manual), 0);
    for (const delivery of [a, b]) {
      const confirmation = await fetch(emailLink(delivery, 'confirm'), {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '',
      });
      assert.equal(confirmation.status, 200);
    }
    assert.equal(await audience(manual), 2);

    await adminPage.goto(panel);
    await adminPage.locator('input[type=email]').fill(accounts.editor.email);
    await adminPage.locator('input[type=password]').fill(accounts.editor.password);
    await adminPage.getByRole('button', { name: 'Entrar no Painel' }).click();
    await adminPage.getByRole('link', { name: 'Marketing', exact: true }).first().click();
    await adminPage.getByRole('link', { name: 'Campanhas', exact: true }).click();
    await adminPage.getByText(manual.name, { exact: true }).waitFor();

    await json(prefix + '/campaigns/' + manual.id + '/test', { method: 'POST', expected: 202, body: { email: contacts.preview, version: manual.version } });
    await messageFor(contacts.preview, '[Teste] ' + manual.subject);
    manual = (await campaignAction(manual, 'activate', { scheduledAt: null, expectedAudience: 2 })).campaign;
    const manualA = await messageFor(contacts.a, manual.subject);
    await messageFor(contacts.b, manual.subject);
    assert.ok(!(await inbox()).some(m => isTo(m, contacts.onlyEbook) && m.Subject === manual.subject));
    const unsubscribe = emailLink(manualA, 'unsubscribe');
    assert.ok(unsubscribe);

    let scheduled = await createCampaign('agendada');
    const when = new Date(Date.now() + 38000).toISOString();
    scheduled = (await campaignAction(scheduled, 'activate', { scheduledAt: when, expectedAudience: 2 })).campaign;
    assert.equal(scheduled.state, 'scheduled');
    scheduled = (await campaignAction(scheduled, 'pause')).campaign;
    assert.equal(scheduled.state, 'paused');
    assert.ok(!(await inbox()).some(m => m.Subject === scheduled.subject));
    assert.equal((await fetch(unsubscribe)).status, 200);
    assert.equal(await audience(scheduled), 2);
    const optedOut = await fetch(unsubscribe, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    });
    assert.equal(optedOut.status, 204);
    assert.equal(await audience(scheduled), 1);
    const replay = await fetch(emailLink(a, 'confirm'), { method: 'POST' });
    assert.equal(replay.status, 404);
    assert.equal(await audience(scheduled), 1);
    scheduled = (await campaignAction(scheduled, 'resume')).campaign;
    assert.equal(scheduled.state, 'scheduled');
    const sentLater = await messageFor(contacts.b, scheduled.subject, 55000);
    assert.ok(Date.parse(sentLater.Created) >= Date.parse(when) - 1000);
    assert.ok(!(await inbox()).some(m => isTo(m, contacts.a) && m.Subject === scheduled.subject));
    const completed = await eventually(async () => {
      const active = (await json(prefix + '/campaigns')).campaigns.find(item => item.id === scheduled.id);
      return active?.state === 'completed' ? active : null;
    }, 'conclusão da campanha');
    assert.equal(completed.accepted, 1);
    assert.equal(completed.skipped, 1);
    assert.equal(completed.delivered, 0);

    const eventKey = process.env.MARKETING_E2E_EVENT_KEY;
    if (eventKey) {
      const messageId = String(sentLater.MessageID);
      const jobId = /innerworks-marketing-([a-f0-9-]{36})@/.exec(messageId)?.[1];
      assert.ok(jobId);
      const event = { eventId: 'delivery-' + marker, kind: 'delivered', jobId };
      const signature = createHmac('sha256', eventKey).update([event.eventId, event.kind, jobId].join('\n')).digest('hex');
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(api + publicPrefix + '/events', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-marketing-event-signature': signature }, body: JSON.stringify(event),
        });
        assert.equal(response.status, 204);
      }
      assert.equal((await json(prefix + '/campaigns')).campaigns.find(item => item.id === scheduled.id).delivered, 1);
    }

    ebook = (await json(prefix + '/ebooks/' + ebook.id + '/unpublish', { method: 'POST', body: { version: ebook.version } })).ebook;
    assert.equal((await fetch(site + '/ebooks/' + ebook.slug)).status, 404);
    assert.equal((await fetch(download)).status, 404);
  } finally {
    if (ebook?.status === 'published') {
      await json(prefix + '/ebooks/' + ebook.id + '/unpublish', { method: 'POST', body: { version: ebook.version } });
    }
  }
});
