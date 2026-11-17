import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MARKETING_BUCKET = 'site-marketing';
export const EBOOK_PDF_BYTES = 20 * 1024 * 1024;

export class MarketingError extends Error {
  constructor(message: string, readonly statusCode = 422, readonly code?: string) {
    super(message);
  }
}

export interface MarketingMailConfig {
  host: string;
  port: number;
  from: string;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
}

type MarketingChannel = 'delivery' | 'campaign';
type LinkPurpose = 'download' | 'confirm' | 'unsubscribe';

const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern = /^[a-z0-9!#$%&'*+/=?^_{}|~-]+(?:\.[a-z0-9!#$%&'*+/=?^_{}|~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const malformedText = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF]/u;

function secret(value?: string) {
  return value && value.length >= 32 && !/\s/.test(value) ? value : null;
}

function origin(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const validProtocol = url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    if (validProtocol && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return url.origin;
    }
  } catch {
    // Incomplete configuration leaves the respective action unavailable.
  }
  return null;
}

function mailConfig(env: NodeJS.ProcessEnv, channel: MarketingChannel): MarketingMailConfig | null {
  const prefix = 'SITE_MARKETING_' + channel.toUpperCase() + '_SMTP_';
  const host = env[prefix + 'HOST']?.trim();
  const port = Number(env[prefix + 'PORT']);
  const from = env[prefix + 'FROM']?.trim();
  const user = env[prefix + 'USER'];
  const pass = env[prefix + 'PASSWORD'];
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from || !emailPattern.test(from)) return null;
  if (!/^[a-z0-9.-]+$/i.test(host) && !isIP(host)) return null;
  const local = ['127.0.0.1', '::1', 'localhost'].includes(host.toLowerCase());
  if ((!local && (!user || !pass)) || Boolean(user) !== Boolean(pass)) return null;
  return {
    host, port, from, secure: port === 465, requireTLS: port !== 465 && !local,
    ...(user && pass ? { auth: { user, pass } } : {}),
  };
}

export function marketingConfig(env = process.env) {
  const enabled = env.SITE_MARKETING_ENABLED === 'true';
  const formKey = secret(env.SITE_MARKETING_FORM_KEY);
  const tokenSecret = secret(env.SITE_MARKETING_TOKEN_SECRET);
  const eventsSecret = secret(env.SITE_MARKETING_EVENTS_SECRET);
  const siteOrigin = origin(env.SITE_MARKETING_SITE_ORIGIN ?? 'https://innerworks.com.br');
  const apiOrigin = origin(env.SITE_MARKETING_PUBLIC_API_ORIGIN);
  const delivery = mailConfig(env, 'delivery');
  const campaign = mailConfig(env, 'campaign');
  const linksReady = enabled && Boolean(siteOrigin && apiOrigin && tokenSecret);
  return {
    enabled, formKey, tokenSecret, eventsSecret, siteOrigin, apiOrigin,
    delivery, campaign,
    deliveryReady: linksReady && Boolean(delivery && formKey),
    campaignReady: linksReady && Boolean(campaign && campaign.from.toLowerCase() !== delivery?.from.toLowerCase()),
  };
}
export type MarketingConfig = ReturnType<typeof marketingConfig>;

export function marketingObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MarketingError('Confira os dados enviados.');
  return value as Record<string, unknown>;
}

export function marketingText(value: unknown, field: string, limit: number, multiline = false): string {
  if (typeof value !== 'string') throw new MarketingError('Informe ' + field + '.');
  const clean = value.trim().replace(/\r\n?/g, '\n');
  if (!clean || malformedText.test(clean) || [...clean].length > limit || (!multiline && /[\t\n]/.test(clean))) {
    throw new MarketingError('Informe ' + field + ' com até ' + limit + ' caracteres.');
  }
  return clean;
}

export function marketingEmail(value: unknown): string {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (address.length > 254 || address.split('@')[0].length > 64 || !emailPattern.test(address)) {
    throw new MarketingError('Informe um e-mail válido.');
  }
  return address;
}

export function marketingId(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new MarketingError('Identificador inválido.');
  return value.toLowerCase();
}

export function marketingSlug(value: unknown): string {
  if (typeof value !== 'string' || value.length > 160 || !slugPattern.test(value)) throw new MarketingError('Material indisponível.', 404);
  return value;
}

export function marketingPage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,3}$/.test(value)) throw new MarketingError('Página inválida.');
  return Number(value);
}

export function marketingVersion(value: unknown): number {
  if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)) value = Number(value);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new MarketingError('Versão inválida. Recarregue a página.');
  }
  return value;
}

export function marketingSchedule(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new MarketingError('Informe a data e o horário do agendamento.');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= Date.now() || time - Date.now() > 366 * 86400000) {
    throw new MarketingError('Agende para uma data futura dentro de um ano.');
  }
  return new Date(time).toISOString();
}

export function markDigest(key: string, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function equalSecret(expected: string | null, provided: unknown) {
  if (!expected || typeof provided !== 'string' || provided.length !== expected.length) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function linkProof(secret: string, purpose: LinkPurpose, id: string) {
  return createHmac('sha256', secret).update(purpose + '\n' + id).digest('base64url');
}

export function marketingLink(config: MarketingConfig, purpose: LinkPurpose, id: string) {
  if (!config.apiOrigin || !config.tokenSecret) throw new Error('Marketing link settings absent');
  const signature = linkProof(config.tokenSecret, purpose, id);
  return config.apiOrigin + '/api/public/ebooks/' + purpose + '/' + id + '.' + signature;
}

export function marketingTokenId(config: MarketingConfig, purpose: LinkPurpose, token: string) {
  const [id, proof, extra] = token.split('.');
  if (!config.tokenSecret || !uuidPattern.test(id ?? '') || extra !== undefined ||
    !equalSecret(linkProof(config.tokenSecret, purpose, id), proof)) {
    throw new MarketingError('Este link é inválido ou expirou.', 404);
  }
  return id;
}

export async function marketingRpc<T>(
  db: SupabaseClient,
  scope: 'admin' | 'public' | 'worker',
  operation: string,
  input: Record<string, unknown> = {},
  actor?: string,
): Promise<T> {
  const args = { p_operation: operation, p_data: input, ...(actor ? { p_actor: actor } : {}) };
  const { data, error } = await db.rpc('site_marketing_' + scope, args);
  if (error) throw error;
  return data as T;
}

const errors = new Map<string, [number, string, string?]>([
  ['42501', [403, 'Acesso ao Marketing indisponível.']],
  ['P0002', [404, 'Registro indisponível ou link expirado.']],
  ['40001', [409, 'Os dados mudaram. Atualize a página e confira antes de tentar novamente.', 'conflict']],
  ['22023', [422, 'Confira os dados e as condições da operação.']],
  ['54000', [429, 'Muitos pedidos neste momento. Tente novamente em alguns minutos.']],
]);

export function marketingError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof MarketingError) {
    return reply.code(error.statusCode).send({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  const problem = error as { code?: string; statusCode?: number; status?: number };
  const code = typeof problem?.code === 'string' ? problem.code : '';
  const mapped = errors.get(code);
  if (mapped) {
    const [status, message, publicCode] = mapped;
    return reply.code(status).send({ error: message, ...(publicCode ? { code: publicCode } : {}) });
  }
  const status = problem?.statusCode ?? Number(problem?.status);
  if (status >= 400 && status < 500) {
    return reply.code(status).send({ error: status === 413 ? 'Arquivo ou conteúdo acima do limite.' : 'Confira os dados enviados.' });
  }
  request.log.error({ errorCode: /^[A-Z0-9_]{1,40}$/.test(code) ? code : undefined }, 'Erro na operação de Marketing');
  return reply.code(503).send({ error: 'Serviço temporariamente indisponível. Tente novamente.' });
}
