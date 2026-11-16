import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../../hooks/auth-hook';
import {
  ArticleRequestError,
  readArticleTransition,
  readCreateArticle,
  readPage,
  readSaveArticle,
  readUuid,
  type ArticleContent,
} from '../../services/site-article-content';
import { readArticleImage } from '../../services/site-article-images';

const PAGE_SIZE = 20;
const PRIVATE_BUCKET = 'site-articles';
const DEFAULT_PUBLIC_ORIGIN = 'https://innerworks.com.br';
const DENIED = 'Você não tem acesso à edição de artigos.';
const MISSING_IMAGE = 'Imagem não encontrada.';
const RPC_ERRORS = new Map<string, [number, string]>([
  ['42501', [403, DENIED]],
  ['P0002', [404, 'Artigo ou revisão não encontrado.']],
  ['PT409', [409, 'O artigo foi alterado. Atualize a página e tente novamente.']],
  ['PT422', [422, 'Confira os dados do artigo e as imagens vinculadas.']],
]);

interface ArticleListRow {
  id: string;
  slug: string | null;
  version: number;
  title: string;
  status: 'draft' | 'published' | 'unpublished';
  publishedAt: string | null;
  updatedAt: string;
}

interface ArticleDetail extends ArticleListRow, ArticleContent {
  publishedRevisionId: string | null;
  hasDraftChanges: boolean;
  revisions: { id: string; title: string; publishedAt: string }[];
}

type ArticleParams = { Params: { id: string } };
type MediaParams = { Params: { id: string; mediaId: string } };

export default async function siteArticleRoutes(fastify: FastifyInstance) {
  const db = fastify.supabaseAdmin;
  const enabled = process.env.SITE_ARTICLES_ENABLED === 'true';
  const publicOrigin = enabled ? getPublicOrigin(fastify) : DEFAULT_PUBLIC_ORIGIN;
  const withPublicUrl = <T extends ArticleListRow>(article: T) => ({
    ...article,
    publicUrl: article.status === 'published' && article.slug
      ? publicOrigin + '/artigos/' + encodeURIComponent(article.slug)
      : null,
  });

  async function allowed(request: FastifyRequest): Promise<boolean> {
    return enabled && await rpc<boolean>(db, 'site_article_allowed', { p_actor_id: request.user.user.id }) === true;
  }

  fastify.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
  });
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', verifyAdmin);
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ArticleRequestError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    const properties = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const code = typeof properties.code === 'string' ? properties.code : '';
    const status = typeof properties.statusCode === 'number' ? properties.statusCode : 500;
    const mapped = RPC_ERRORS.get(code);
    if (mapped) return reply.code(mapped[0]).send({ error: mapped[1] });
    if (status === 413) {
      return reply.code(413).send({ error: 'O conteúdo do artigo deve ter até 256 KiB.' });
    }
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'Requisição inválida.' });
    }
    request.log.error({ errorCode: code }, 'Falha na operação editorial');
    return reply.code(500).send({ error: 'Não foi possível concluir a operação. Tente novamente.' });
  });

  fastify.get('/access', async request => ({ allowed: await allowed(request) }));

  await fastify.register(async routes => {
    routes.addHook('onRequest', async request => {
      if (!await allowed(request)) throw new ArticleRequestError(DENIED, 403);
    });

    routes.get<{ Querystring: { page?: unknown } }>('/', async request => {
      const articles = await rpc<ArticleListRow[]>(db, 'site_article_list', {
        p_actor_id: request.user.user.id,
        p_page: readPage(request.query.page),
      });
      return { articles: articles.slice(0, PAGE_SIZE).map(withPublicUrl), hasMore: articles.length > PAGE_SIZE };
    });

    routes.post('/', async (request, reply) => {
      const article = await rpc<ArticleDetail>(db, 'site_article_create', {
        p_actor_id: request.user.user.id,
        p_article_id: readCreateArticle(request.body),
      });
      return reply.code(201).send({ article: withPublicUrl(article) });
    });

    routes.get<ArticleParams>('/:id', async request => {
      const article = await rpc<ArticleDetail>(db, 'site_article_get', {
        p_actor_id: request.user.user.id,
        p_article_id: readUuid(request.params.id),
      });
      return { article: withPublicUrl(article) };
    });

    routes.patch<ArticleParams>('/:id', { bodyLimit: 256 * 1024 }, async request => {
      const id = readUuid(request.params.id);
      const { version, title, summary, cover, blocks } = readSaveArticle(request.body);
      const article = await rpc<ArticleDetail>(db, 'site_article_save', {
        p_actor_id: request.user.user.id,
        p_article_id: id,
        p_version: version,
        p_title: title,
        p_summary: summary,
        p_cover: cover,
        p_blocks: blocks,
      });
      return { article: withPublicUrl(article) };
    });

    routes.post<ArticleParams>('/:id/media', async (request, reply) => {
      const id = readUuid(request.params.id);
      const { data, info: { width, height } } = await readArticleImage(request);
      const mediaId = randomUUID();
      const key = mediaId + '.webp';
      const storage = db.storage.from(PRIVATE_BUCKET);
      const uploaded = await storage.upload(key, data, {
        upsert: false,
        contentType: 'image/webp',
        cacheControl: '0',
        headers: { 'cache-control': 'private, no-store' },
      });
      if (uploaded.error) throw uploaded.error;

      const { error } = await db.rpc('site_article_add_media', {
        p_actor_id: request.user.user.id,
        p_article_id: id,
        p_media_id: mediaId,
        p_width: width,
        p_height: height,
      });
      if (error) {
        // These explicit SQL errors confirm the registration transaction rolled back.
        if (error.code === '42501' || error.code === 'P0002' || error.code === 'PT422') {
          try {
            const cleanup = await storage.remove([key]);
            if (cleanup.error) throw cleanup.error;
          } catch {
            request.log.warn({ mediaId }, 'Falha ao remover imagem sem registro editorial');
          }
        }
        throw error;
      }
      return reply.code(201).send({ mediaId, width, height });
    });

    routes.get<MediaParams>('/:id/media/:mediaId', async (request, reply) => {
      const mediaId = readUuid(request.params.mediaId);
      const exists = await rpc<boolean>(db, 'site_article_get_media', {
        p_actor_id: request.user.user.id,
        p_article_id: readUuid(request.params.id),
        p_media_id: mediaId,
      });
      if (exists !== true) throw new ArticleRequestError(MISSING_IMAGE, 404);

      const { data, error } = await db.storage.from(PRIVATE_BUCKET).download(mediaId + '.webp');
      if (error) {
        if ('status' in error && Number(error.status) === 404) throw new ArticleRequestError(MISSING_IMAGE, 404);
        throw error;
      }
      return reply
        .type('image/webp')
        .header('X-Content-Type-Options', 'nosniff')
        .send(Buffer.from(await data.arrayBuffer()));
    });

    for (const action of ['publish', 'unpublish', 'restore'] as const) {
      routes.post<ArticleParams>('/:id/' + action, async request => {
        const id = readUuid(request.params.id);
        const { version, requestId, revisionId } = readArticleTransition(request.body, action === 'restore');
        const actor = request.user.user;
        const article = await rpc<ArticleDetail>(db, 'site_article_transition', {
          p_actor_id: actor.id,
          p_actor_email: actor.email,
          p_article_id: id,
          p_version: version,
          p_request_id: requestId,
          p_action: action,
          p_revision_id: revisionId,
          p_ip: request.ip,
          p_user_agent: request.headers['user-agent'] || '',
        });
        return { article: withPublicUrl(article) };
      });
    }
  });
}

async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}

function getPublicOrigin(fastify: FastifyInstance): string {
  const configured = process.env.SITE_ARTICLES_PUBLIC_ORIGIN;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Fall back if the optional origin is invalid.
    }
    fastify.log.warn('SITE_ARTICLES_PUBLIC_ORIGIN inválida. Usando o domínio público padrão.');
  }
  return DEFAULT_PUBLIC_ORIGIN;
}
