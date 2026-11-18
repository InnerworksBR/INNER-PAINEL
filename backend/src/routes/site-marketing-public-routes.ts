import { isIP } from 'node:net';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { sendMarketingAsset } from '../services/site-marketing-assets';
import { marketingMailAvailability, microsoftMarketingMail } from '../services/site-marketing-microsoft';
import {
  MarketingError, equalSecret, markDigest, marketingConfig, marketingEmail, marketingError, marketingId,
  marketingObject, marketingPage, marketingRpc, marketingSlug, marketingText, marketingTokenId,
} from '../services/site-marketing';

type Slug = { Params: { slug: string } };
type Token = { Params: { token: string } };

function contactPage(reply: FastifyReply, title: string, description: string, label?: string) {
  reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  const form = label ? '<form method="post"><button type="submit">' + label + '</button></form>' : '';
  return reply.type('text/html; charset=utf-8').send(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + title + ' | Innerworks</title><style>body{font:1rem system-ui,sans-serif;color:#11213b;background:#f5f7fa;margin:0;padding:2rem}' +
    'main{max-width:36rem;margin:8vh auto;background:#fff;padding:1.75rem;border:1px solid #dce3ec;border-radius:1rem}' +
    'button{font:inherit;padding:.65rem 1rem;border:0;border-radius:.5rem;color:#fff;background:#174267;cursor:pointer}</style>' +
    '<main><h1>' + title + '</h1><p>' + description + '</p>' + form + '</main></html>',
  );
}

export default async function siteMarketingPublicRoutes(fastify: FastifyInstance) {
  const config = marketingConfig();
  const db = fastify.supabaseAdmin;
  const microsoft = microsoftMarketingMail(db, config);
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    reply.header('Referrer-Policy', 'no-referrer');
    const route = request.routeOptions.url ?? '';
    const honorsPreviousEmails = route.endsWith('/unsubscribe/:token') || route.endsWith('/events');
    if (!config.enabled && !honorsPreviousEmails) throw new MarketingError('Material indisponível.', 404);
  });
  fastify.setErrorHandler(marketingError);
  fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 1024 }, (_request, body, done) => done(null, body));

  fastify.get<{ Querystring: { page?: unknown } }>('/', async request => marketingRpc(db, 'public', 'list', {
    page: marketingPage(request.query.page),
  }));
  fastify.get<Slug>('/:slug', async request => marketingRpc(db, 'public', 'get', {
    slug: marketingSlug(request.params.slug),
  }));
  fastify.get<Slug>('/:slug/cover', async (request, reply) => {
    const asset = await marketingRpc<{ path: string }>(db, 'public', 'cover', {
      slug: marketingSlug(request.params.slug),
    });
    return sendMarketingAsset(db, reply, 'cover', asset);
  });

  fastify.post<Slug>('/:slug/requests', { bodyLimit: 8192 }, async (request, reply) => {
    if (!equalSecret(config.formKey, request.headers['x-marketing-form-key'])) {
      throw new MarketingError('Formulário indisponível.', 403);
    }
    if (!config.formKey || !(await marketingMailAvailability(config, microsoft)).deliveryReady) {
      throw new MarketingError('Entrega temporariamente indisponível.', 503);
    }
    const data = marketingObject(request.body);
    if (typeof data.website === 'string' && data.website.trim()) return reply.code(202).send({ accepted: true });
    if (typeof data.marketingConsent !== 'boolean') throw new MarketingError('Confira a sua preferência de recebimento.');
    const visitor = request.headers['x-marketing-client-ip'];
    const sourceKey = typeof visitor === 'string' && isIP(visitor)
      ? markDigest(config.formKey, visitor)
      : 'site:' + markDigest(config.formKey, 'proxy');
    await marketingRpc(db, 'public', 'capture', {
      slug: marketingSlug(request.params.slug),
      email: marketingEmail(data.email),
      name: data.name === undefined || data.name === null || data.name === '' ? null : marketingText(data.name, 'o nome', 120),
      consent: data.marketingConsent,
      sourceKey,
    });
    return reply.code(202).send({ accepted: true });
  });

  fastify.get<Token>('/download/:token', async (request, reply) => {
    const id = marketingTokenId(config, 'download', request.params.token);
    const asset = await marketingRpc<{ path: string; filename: string }>(db, 'public', 'download', { id });
    return sendMarketingAsset(db, reply, 'pdf', asset);
  });

  fastify.get<Token>('/confirm/:token', async (request, reply) => {
    marketingTokenId(config, 'confirm', request.params.token);
    return contactPage(reply, 'Confirmar inscrição', 'Confirme que deseja receber novidades, materiais e ofertas da Innerworks por e-mail.', 'Confirmar inscrição');
  });
  fastify.post<Token>('/confirm/:token', { bodyLimit: 1024 }, async (request, reply) => {
    const id = marketingTokenId(config, 'confirm', request.params.token);
    await marketingRpc(db, 'public', 'confirm', { id });
    return contactPage(reply, 'Inscrição confirmada', 'Você poderá descadastrar seu endereço a qualquer momento pelo link das campanhas.');
  });

  fastify.get<Token>('/unsubscribe/:token', async (request, reply) => {
    marketingTokenId(config, 'unsubscribe', request.params.token);
    return contactPage(reply, 'Descadastrar e-mail', 'Confirme para parar de receber campanhas da Innerworks neste endereço.', 'Confirmar descadastro');
  });
  fastify.post<Token>('/unsubscribe/:token', { bodyLimit: 1024 }, async (request, reply) => {
    const id = marketingTokenId(config, 'unsubscribe', request.params.token);
    await marketingRpc(db, 'public', 'unsubscribe', { id });
    if (!request.headers.accept?.includes('text/html')) return reply.code(204).send();
    return contactPage(reply, 'Descadastro confirmado', 'Seu endereço foi retirado da lista de campanhas.');
  });

  fastify.post('/events', { bodyLimit: 4096 }, async (request, reply) => {
    if (!config.eventsSecret) throw new MarketingError('Endpoint indisponível.', 404);
    const { eventId, kind, jobId } = marketingObject(request.body);
    if (typeof eventId !== 'string' || !/^[a-z0-9._:-]{1,160}$/i.test(eventId) ||
      (kind !== 'delivered' && kind !== 'bounce' && kind !== 'complaint')) {
      throw new MarketingError('Evento inválido.');
    }
    const id = marketingId(jobId);
    const expected = markDigest(config.eventsSecret, [eventId, kind, id].join('\n'));
    if (!equalSecret(expected, request.headers['x-marketing-event-signature'])) {
      throw new MarketingError('Evento não autorizado.', 403);
    }
    await marketingRpc(db, 'worker', 'event', { eventId, kind, jobId: id });
    return reply.code(204).send();
  });
}
