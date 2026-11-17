import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { readArticleImage } from '../../services/site-article-images';
import { readEbookPdf, sendMarketingAsset } from '../../services/site-marketing-assets';
import {
  MARKETING_BUCKET, MarketingError, marketingConfig, marketingEmail, marketingError,
  marketingId, marketingObject, marketingPage, marketingRpc, marketingSchedule, marketingText, marketingVersion,
} from '../../services/site-marketing';

type ById = { Params: { id: string } };
type Upload = ById & { Querystring: { version?: unknown } };

interface Ebook {
  id: string;
  slug: string | null;
  status: 'draft' | 'published' | 'unpublished';
}

const entitlement = 'O módulo de Marketing está indisponível para esta conta.';
const contactsStatuses = ['not_subscribed', 'pending', 'subscribed', 'unsubscribed', 'suppressed'];

function contactDate(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
  }
  throw new MarketingError('Informe uma data de pedido válida.');
}

function ebookFields(body: unknown) {
  const fields = marketingObject(body);
  return {
    title: marketingText(fields.title, 'o título', 160),
    description: marketingText(fields.description, 'a descrição', 1000, true),
  };
}

function campaignFields(body: unknown) {
  const fields = marketingObject(body);
  return {
    name: marketingText(fields.name, 'o nome da campanha', 160),
    subject: marketingText(fields.subject, 'o assunto', 180),
    body: marketingText(fields.body, 'o texto do e-mail', 10000, true),
    ebookId: fields.ebookId === null ? null : marketingId(fields.ebookId),
  };
}

export default async function siteMarketingRoutes(fastify: FastifyInstance) {
  const config = marketingConfig();
  const db = fastify.supabaseAdmin;

  function admin<T>(request: FastifyRequest, operation: string, input = {}) {
    return marketingRpc<T>(db, 'admin', operation, input, request.user.user.id);
  }

  function publicLink(ebook: Ebook) {
    return {
      ...ebook,
      publicUrl: ebook.status === 'published' && ebook.slug && config.siteOrigin
        ? config.siteOrigin + '/ebooks/' + encodeURIComponent(ebook.slug)
        : null,
    };
  }

  async function ebookAction(request: FastifyRequest, operation: string, input: Record<string, unknown>) {
    const { ebook } = await admin<{ ebook: Ebook }>(request, operation, input);
    return { ebook: publicLink(ebook) };
  }

  function requireDelivery() {
    if (!config.deliveryReady) throw new MarketingError('Configure o envio de e-books antes de publicar.', 503);
  }

  function requireCampaign() {
    if (!config.campaignReady) throw new MarketingError('Configure o envio de campanhas no servidor.', 503);
  }

  fastify.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
  });
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', verifyAdmin);
  fastify.setErrorHandler(marketingError);

  fastify.get('/access', async request => {
    const allowed = config.enabled && (await admin<{ allowed: boolean }>(request, 'access')).allowed;
    return { allowed, deliveryReady: allowed && config.deliveryReady, campaignReady: allowed && config.campaignReady };
  });

  await fastify.register(async routes => {
    routes.addHook('onRequest', async () => {
      if (!config.enabled) throw new MarketingError(entitlement, 403);
    });

    routes.get('/ebooks', async request => {
      const { ebooks } = await admin<{ ebooks: Ebook[] }>(request, 'ebooks');
      return { ebooks: ebooks.map(publicLink) };
    });

    routes.post('/ebooks', async (request, reply) => {
      const result = await ebookAction(request, 'createEbook', ebookFields(request.body));
      return reply.code(201).send(result);
    });

    routes.patch<ById>('/ebooks/:id', async request => ebookAction(request, 'editEbook', {
      ...ebookFields(request.body),
      id: marketingId(request.params.id),
      version: marketingVersion(marketingObject(request.body).version),
    }));

    routes.get<ById>('/ebooks/:id/cover', async (request, reply) => {
      const asset = await admin<{ path: string }>(request, 'ebookCover', { id: marketingId(request.params.id) });
      return sendMarketingAsset(db, reply, 'cover', asset);
    });

    for (const kind of ['cover', 'pdf'] as const) {
      routes.post<Upload>('/ebooks/:id/' + kind, { bodyLimit: 22 * 1024 * 1024 }, async request => {
        const id = marketingId(request.params.id);
        const version = marketingVersion(request.query.version);
        const { allowed } = await admin<{ allowed: boolean }>(request, 'access');
        if (!allowed) throw new MarketingError(entitlement, 403);
        const asset = kind === 'cover'
          ? { bytes: (await readArticleImage(request)).data, filename: null }
          : await readEbookPdf(request);
        const path = kind + '/' + randomUUID() + (kind === 'cover' ? '.webp' : '.pdf');
        const storage = db.storage.from(MARKETING_BUCKET);
        const uploaded = await storage.upload(path, asset.bytes, {
          upsert: false, cacheControl: '0',
          contentType: kind === 'cover' ? 'image/webp' : 'application/pdf',
          headers: { 'cache-control': 'private, no-store' },
        });
        if (uploaded.error) throw uploaded.error;
        try {
          return await ebookAction(request, 'attachEbook', { id, version, kind, path, filename: asset.filename });
        } catch (error) {
          // These SQL rejections confirm that the storage object's reference was never committed.
          if (['42501', 'P0002', '40001', '22023'].includes((error as { code?: string }).code ?? '')) {
            try {
              const removed = await storage.remove([path]);
              if (removed.error) throw removed.error;
            } catch {
              request.log.warn('Falha ao liberar um arquivo de e-book que rejeitou o vínculo');
            }
          }
          throw error;
        }
      });
    }

    routes.post<ById>('/ebooks/:id/publish', async request => {
      requireDelivery();
      return ebookAction(request, 'publishEbook', {
        id: marketingId(request.params.id), version: marketingVersion(marketingObject(request.body).version),
      });
    });
    routes.post<ById>('/ebooks/:id/unpublish', async request => ebookAction(request, 'unpublishEbook', {
      id: marketingId(request.params.id), version: marketingVersion(marketingObject(request.body).version),
    }));

    routes.get<{ Querystring: Record<string, unknown> }>('/contacts', async request => {
      const { ebookId, status, page, q } = request.query;
      const from = contactDate(request.query.from);
      const to = contactDate(request.query.to);
      if (from && to && from > to) throw new MarketingError('A data final deve ser igual ou posterior à data inicial.');
      if (status !== undefined && (typeof status !== 'string' || !contactsStatuses.includes(status))) {
        throw new MarketingError('Selecione um status de contato válido.');
      }
      return admin(request, 'contacts', {
        page: marketingPage(page), ebookId: ebookId === undefined ? undefined : marketingId(ebookId),
        status, from, to, q: q === undefined ? undefined : marketingText(q, 'a busca', 160),
      });
    });

    routes.get('/campaigns', async request => admin(request, 'campaigns'));
    routes.post('/campaigns', { bodyLimit: 48 * 1024 }, async (request, reply) => {
      const result = await admin(request, 'createCampaign', campaignFields(request.body));
      return reply.code(201).send(result);
    });
    routes.patch<ById>('/campaigns/:id', { bodyLimit: 48 * 1024 }, async request => admin(request, 'editCampaign', {
      ...campaignFields(request.body),
      id: marketingId(request.params.id), version: marketingVersion(marketingObject(request.body).version),
    }));
    routes.get<ById>('/campaigns/:id/audience', async request => admin(request, 'audience', { id: marketingId(request.params.id) }));
    routes.post<ById>('/campaigns/:id/test', async (request, reply) => {
      requireCampaign();
      const { version, email } = marketingObject(request.body);
      const result = await admin(request, 'testCampaign', {
        id: marketingId(request.params.id), version: marketingVersion(version), email: marketingEmail(email),
      });
      return reply.code(202).send(result);
    });
    routes.post<ById>('/campaigns/:id/activate', async request => {
      requireCampaign();
      const { version, scheduledAt, expectedAudience } = marketingObject(request.body);
      if (typeof expectedAudience !== 'number' || !Number.isInteger(expectedAudience) || expectedAudience < 1 || expectedAudience > 1000000) {
        throw new MarketingError('Confira a quantidade de destinatários antes de ativar.');
      }
      return admin(request, 'activateCampaign', {
        id: marketingId(request.params.id), version: marketingVersion(version),
        scheduledAt: marketingSchedule(scheduledAt), expectedAudience,
      });
    });
    routes.post<ById>('/campaigns/:id/pause', async request => admin(request, 'pauseCampaign', {
      id: marketingId(request.params.id), version: marketingVersion(marketingObject(request.body).version),
    }));
    routes.post<ById>('/campaigns/:id/resume', async request => {
      requireCampaign();
      return admin(request, 'resumeCampaign', {
        id: marketingId(request.params.id), version: marketingVersion(marketingObject(request.body).version),
      });
    });
  });
}
