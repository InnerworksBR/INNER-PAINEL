import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  marketingConfig, marketingLink, marketingRpc, type MarketingConfig, type MarketingMailConfig,
} from '../services/site-marketing';
import {
  marketingTransport, microsoftMarketingMail, type MicrosoftMarketingMail,
} from '../services/site-marketing-microsoft';

type Channel = 'delivery' | 'campaign';

interface MailJob {
  id: string;
  lease: string;
  kind: 'delivery' | 'campaign' | 'test';
  email: string;
  recipientName: string | null;
  requestId: string | null;
  contactId: string | null;
  ebookTitle: string | null;
  wantsMarketing: boolean;
  subject: string | null;
  body: string | null;
  attempts: number;
}

const instructions = {
  delivery: { intervalMs: 2000, batch: 4 },
  campaign: { intervalMs: 5000, batch: 3 },
};

const htmlCharacters: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => htmlCharacters[character]);
const link = (href: string, label: string) => '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + '</a>';
const paragraph = (value: string) => '<p>' + escapeHtml(value).replace(/\n/g, '<br>') + '</p>';

function campaignParagraph(value: string) {
  const text = value.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, index) => index % 2
    ? link(part, part)
    : escapeHtml(part).replace(/\n/g, '<br>')).join('');
  return '<p>' + text + '</p>';
}

function htmlEmail(title: string, content: string) {
  return '<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#172b42;background:#f3f6f9;padding:24px 12px">' +
    '<div style="max-width:620px;margin:auto;background:#fff;padding:24px;border:1px solid #e1e8ee;border-radius:12px">' +
    '<p style="font-weight:700">Innerworks</p><h1 style="font-size:22px">' + escapeHtml(title) + '</h1>' +
    content + '</div></body></html>';
}

function messageFor(job: MailJob, config: MarketingConfig, smtp: MarketingMailConfig) {
  const common = {
    from: { name: 'Innerworks', address: smtp.from },
    to: job.email,
    messageId: '<innerworks-marketing-' + job.id + '@' + smtp.from.split('@')[1] + '>',
  };
  const headers = { 'X-Innerworks-Job': job.id };
  if (job.kind === 'delivery') {
    if (!job.requestId || !job.ebookTitle) throw new Error('Incomplete ebook delivery');
    const subject = 'Seu e-book está pronto';
    const greeting = 'Olá!';
    const notice = 'Você solicitou o e-book "' + job.ebookTitle + '". O link de download funciona por até 7 dias.';
    const download = marketingLink(config, 'download', job.requestId);
    const confirm = job.wantsMarketing ? marketingLink(config, 'confirm', job.requestId) : null;
    return {
      ...common, subject, headers,
      text: [greeting, notice, 'Baixar e-book: ' + download,
        ...(confirm ? ['Confirme separadamente o interesse em receber ofertas: ' + confirm] : []),
      ].join('\n\n'),
      html: htmlEmail(subject, paragraph(greeting) + paragraph(notice) + '<p>' + link(download, 'Baixar e-book') + '</p>' +
        (confirm ? '<p>' + link(confirm, 'Confirmar interesse em receber ofertas') + '</p>' : '')),
    };
  }

  if (!job.subject || !job.body) throw new Error('Incomplete campaign');
  const preview = job.kind === 'test';
  const subject = preview ? '[Teste] ' + job.subject : job.subject;
  if (!preview && !job.contactId) throw new Error('Incomplete subscriber');
  const unsubscribe = preview ? null : marketingLink(config, 'unsubscribe', job.contactId!);
  const body = job.body.split(/\n\s*\n/).map(campaignParagraph).join('');
  const footer = unsubscribe
    ? '<p style="font-size:14px">Você confirmou sua inscrição para receber ofertas da Innerworks. ' +
      link(unsubscribe, 'Descadastrar e-mail') + '</p>'
    : paragraph('Prévia interna da campanha.');
  return {
    ...common, subject,
    text: job.body + (unsubscribe ? '\n\nDescadastrar e-mail: ' + unsubscribe : '\n\nPrévia interna da campanha.'),
    html: htmlEmail(subject, body + footer),
    headers: unsubscribe ? {
      ...headers,
      'List-ID': 'Ofertas da Innerworks <ofertas.innerworks.com.br>',
      'List-Unsubscribe': '<' + unsubscribe + '>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    } : headers,
  };
}

type Failure = { state: 'retry' | 'failed' | 'uncertain'; nextAttemptAt?: string; reason: string };

function deliveryFailure(error: unknown, attempts: number): Failure {
  const failure = error as { responseCode?: number; command?: string };
  const code = Number(failure?.responseCode);
  if (code >= 500 && code <= 599) return { state: 'failed', reason: 'smtp_rejected:' + code };
  const knownPreDelivery = ['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH'].includes(failure?.command ?? '');
  if ((code >= 400 && code < 500) || knownPreDelivery) {
    if (attempts >= 6) return { state: 'failed', reason: 'smtp_retry_limit' };
    const retryMinutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
    return {
      state: 'retry', nextAttemptAt: new Date(Date.now() + retryMinutes * 60000).toISOString(),
      reason: 'smtp_transient',
    };
  }
  return { state: 'uncertain', reason: 'smtp_uncertain' };
}

async function sendBatch(
  db: SupabaseClient, log: FastifyBaseLogger, config: MarketingConfig, channel: Channel,
  transport: ReturnType<typeof marketingTransport>, smtp: MarketingMailConfig, active: () => boolean,
  limit = instructions[channel].batch, recover?: (error: unknown) => Promise<Failure | null>,
) {
  const { jobs } = await marketingRpc<{ jobs: MailJob[] }>(db, 'worker', 'claim', {
    channels: [channel], limit, leaseSeconds: 300,
  });
  for (const job of jobs) {
    if (!active()) return;
    const identity = { id: job.id, lease: job.lease };
    try {
      const { allowed } = await marketingRpc<{ allowed: boolean }>(db, 'worker', 'authorize', identity);
      if (!allowed) continue;
      let outcome: { state: 'accepted' } | Failure;
      try {
        const message = await transport.sendMail(messageFor(job, config, smtp));
        outcome = message.accepted?.length
          ? { state: 'accepted' }
          : { state: 'failed', reason: 'smtp_recipient_rejected' };
      } catch (error) {
        outcome = (await recover?.(error)) ?? deliveryFailure(error, job.attempts);
      }
      await marketingRpc(db, 'worker', 'finish', { ...identity, ...outcome });
    } catch {
      log.warn({ jobId: job.id, channel }, 'Falha ao registrar processamento de e-mail');
    }
  }
  return jobs.length > 0;
}

function poll(fastify: FastifyInstance, channel: Channel | 'microsoft', intervalMs: number,
  run: (active: () => boolean) => Promise<unknown>) {
  let busy = false;
  let running = true;
  async function tick() {
    if (busy || !running) return;
    busy = true;
    try {
      await run(() => running);
    } catch {
      fastify.log.warn({ channel }, 'Fila de Marketing temporariamente indisponível');
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref();
  void tick();
  return () => {
    running = false;
    clearInterval(timer);
  };
}

function createWorker(fastify: FastifyInstance, config: MarketingConfig, channel: Channel, smtp: MarketingMailConfig) {
  const transport = marketingTransport(smtp);
  const stop = poll(fastify, channel, instructions[channel].intervalMs, active =>
    sendBatch(fastify.supabaseAdmin, fastify.log, config, channel, transport, smtp, active));
  return () => { stop(); transport.close(); };
}

function microsoftWorker(fastify: FastifyInstance, config: MarketingConfig, microsoft: MicrosoftMarketingMail) {
  return poll(fastify, 'microsoft', 2300, async active => {
    const connection = await microsoft.credentials();
    if (!connection || !active() || !await microsoft.capacity(connection)) return;
    const transport = marketingTransport(connection.smtp);
    const recover = async (error: unknown): Promise<Failure | null> => {
      const failure = error as { responseCode?: number; response?: string };
      const code = Number(failure?.responseCode);
      const tenantLimit = code === 550 && /\b5\.7\.233\b/.test(failure?.response ?? '');
      if (code !== 535 && code !== 432 && code !== 454 && !tenantLimit) return null;
      const delay = tenantLimit ? 3600 : 60;
      if (code === 535) await microsoft.invalidate(connection);
      else await microsoft.defer(connection, delay);
      return {
        state: 'retry', nextAttemptAt: new Date(Date.now() + delay * 1000).toISOString(),
        reason: code === 535 ? 'smtp_microsoft_reconnect' : 'smtp_microsoft_throttled',
      };
    };
    const deliver = (channel: Channel) => sendBatch(fastify.supabaseAdmin, fastify.log, config, channel,
      transport, connection.smtp, active, 1, recover);
    try {
      const delivered = config.formKey && await deliver('delivery');
      if (!delivered && active()) await deliver('campaign');
    } finally {
      transport.close();
    }
  });
}

export function startSiteMarketingMail(fastify: FastifyInstance) {
  const config = marketingConfig();
  const microsoft = microsoftMarketingMail(fastify.supabaseAdmin, config);
  if (microsoft && config.linksReady) return microsoftWorker(fastify, config, microsoft);
  const stops: (() => void)[] = [];
  if (config.deliveryReady && config.delivery) stops.push(createWorker(fastify, config, 'delivery', config.delivery));
  if (config.campaignReady && config.campaign) stops.push(createWorker(fastify, config, 'campaign', config.campaign));
  return () => stops.forEach(stop => stop());
}
