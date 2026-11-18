import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {
  MarketingError, marketingEmail, marketingObject, marketingRpc, type MarketingConfig, type MarketingMailConfig,
} from './site-marketing';

const scope = 'https://outlook.office.com/SMTP.Send offline_access';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type EmailStatus = { connected: boolean; mailbox: string | null; username: string | null };
type Grant = { accessToken: string; refreshToken: string; expiresAt: number };
type Connection = { id: string; mailbox: string; username?: string; encryptedGrant: string };
type SmtpConnection = Connection & { smtp: MarketingMailConfig };
type Pending = { id: string; mailbox: string; username?: string; verifier: string };

function digest(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function exchangeSmtp(mailbox: string, token: string, username = mailbox): MarketingMailConfig {
  return {
    host: 'smtp.office365.com', port: 587, from: mailbox, secure: false, requireTLS: true,
    auth: { type: 'OAuth2', user: username, accessToken: token },
  };
}

export function marketingTransport(smtp: MarketingMailConfig) {
  const { from: _from, ...options } = smtp;
  return nodemailer.createTransport({
    ...options, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true,
  });
}

class MicrosoftGrantError extends MarketingError {
  constructor(readonly needsConsent: boolean) {
    super(needsConsent ? 'A autorização da Microsoft expirou ou foi revogada. Conecte sua conta novamente.'
      : 'A Microsoft está indisponível ou a configuração do aplicativo precisa ser conferida.', needsConsent ? 422 : 503);
  }
}

export class MicrosoftMarketingMail {
  private readonly oauthUrl: string;

  constructor(
    private readonly db: SupabaseClient,
    tenant: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly key: Buffer,
  ) {
    this.oauthUrl = 'https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0';
  }

  private rpc<T>(operation: string, fields: Record<string, unknown> = {}) {
    return marketingRpc<T>(this.db, 'microsoft_mail', operation, fields);
  }

  private seal(grant: Grant, mailbox: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from([this.oauthUrl, this.clientId, mailbox].join('\n')));
    const body = Buffer.concat([cipher.update(JSON.stringify(grant), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  private unseal(connection: Connection): Grant {
    const data = Buffer.from(connection.encryptedGrant, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', this.key, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(12, 28));
    cipher.setAAD(Buffer.from([this.oauthUrl, this.clientId, connection.mailbox].join('\n')));
    return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8')) as Grant;
  }

  private async exchange(fields: Record<string, string>, previousToken?: string): Promise<Grant> {
    let response: Response;
    let data: Record<string, unknown>;
    try {
      response = await fetch(this.oauthUrl + '/token', {
        method: 'POST', signal: AbortSignal.timeout(12000), redirect: 'error',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields, client_id: this.clientId, client_secret: this.clientSecret, scope }),
      });
      data = await response.json() as Record<string, unknown>;
    } catch {
      throw new MicrosoftGrantError(false);
    }
    if (!response.ok) throw new MicrosoftGrantError(data?.error === 'invalid_grant' || data?.error === 'interaction_required');
    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token ?? previousToken;
    const expiresIn = Number(data?.expires_in);
    if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken ||
        !Number.isFinite(expiresIn) || expiresIn < 1) throw new MicrosoftGrantError(false);
    return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
  }

  async status() {
    return { configured: true, ...await this.rpc<EmailStatus>('status') };
  }

  async start(actor: string, input: unknown) {
    const fields = marketingObject(input);
    const mailbox = marketingEmail(fields.mailbox);
    const username = fields.username === undefined ? mailbox : marketingEmail(fields.username);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    await this.rpc('begin', { actor, mailbox, username, stateHash: digest(state), verifier });
    const url = new URL(this.oauthUrl + '/authorize');
    url.search = new URLSearchParams({
      client_id: this.clientId, redirect_uri: this.redirectUri, response_type: 'code', response_mode: 'query',
      scope, state, code_challenge: digest(verifier), code_challenge_method: 'S256',
      login_hint: username, prompt: 'select_account',
    }).toString();
    return { authorizationUrl: url.toString() };
  }

  async complete(actor: string, input: unknown) {
    const { code, state } = marketingObject(input);
    const restart = 'Inicie a conexão com a Microsoft novamente.';
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) ||
        typeof code !== 'string' || !code || code.length > 12000) throw new MarketingError(restart);
    const pending = await this.rpc<Pending | null>('take', { actor, stateHash: digest(state) });
    if (!pending) throw new MarketingError(restart);
    const grant = await this.exchange({
      grant_type: 'authorization_code', redirect_uri: this.redirectUri, code, code_verifier: pending.verifier,
    });
    const username = pending.username ?? pending.mailbox;
    const transport = marketingTransport(exchangeSmtp(pending.mailbox, grant.accessToken, username));
    try {
      await transport.verify();
    } catch {
      throw new MarketingError('A Microsoft não aceitou o SMTP para essa caixa. Confira o e-mail e a permissão SMTP autenticado.', 422);
    } finally {
      transport.close();
    }
    const connected = await this.rpc<boolean>('connect', {
      id: pending.id, mailbox: pending.mailbox, username, encryptedGrant: this.seal(grant, pending.mailbox),
    });
    if (!connected) throw new MarketingError(restart);
    return this.status();
  }

  async disconnect() {
    await this.rpc('disconnect');
  }

  async credentials(): Promise<SmtpConnection | null> {
    const connection = await this.rpc<Connection | null>('credentials');
    if (!connection) return null;
    let grant: Grant;
    try {
      grant = this.unseal(connection);
    } catch {
      await this.invalidate(connection);
      return null;
    }
    if (grant.expiresAt <= Date.now() + 120000) {
      const previous = connection.encryptedGrant;
      try {
        grant = await this.exchange({ grant_type: 'refresh_token', refresh_token: grant.refreshToken }, grant.refreshToken);
      } catch (error) {
        if (error instanceof MicrosoftGrantError && error.needsConsent) {
          await this.invalidate(connection);
          return null;
        }
        await this.defer(connection, 60);
        throw error;
      }
      connection.encryptedGrant = this.seal(grant, connection.mailbox);
      const updated = await this.rpc<boolean>('renew', { ...connection, previous });
      if (!updated) return null;
    }
    return { ...connection, smtp: exchangeSmtp(connection.mailbox, grant.accessToken, connection.username) };
  }

  capacity(connection: Connection) {
    return this.rpc<boolean>('reserve', { id: connection.id });
  }

  defer(connection: Connection, seconds: number) {
    return this.rpc('defer', { id: connection.id, seconds });
  }

  invalidate(connection: Connection) {
    return this.rpc('invalidate', { id: connection.id, encryptedGrant: connection.encryptedGrant });
  }
}

export function microsoftMarketingMail(db: SupabaseClient, config: MarketingConfig, env = process.env) {
  const tenant = env.SITE_MARKETING_MICROSOFT_TENANT_ID?.trim();
  const client = env.SITE_MARKETING_MICROSOFT_CLIENT_ID?.trim();
  const secret = env.SITE_MARKETING_MICROSOFT_CLIENT_SECRET;
  if (!config.enabled || !tenant || !uuid.test(tenant) || !client || !uuid.test(client) || !secret ||
      !config.panelOrigin || !config.tokenSecret) return null;
  const key = createHmac('sha256', config.tokenSecret).update('site-marketing-microsoft-mail').digest();
  return new MicrosoftMarketingMail(db, tenant, client, secret, config.panelOrigin + '/admin/marketing/email', key);
}

export async function marketingMailAvailability(config: MarketingConfig, microsoft: MicrosoftMarketingMail | null) {
  if (!microsoft) return { deliveryReady: config.deliveryReady, campaignReady: config.campaignReady };
  const connected = config.linksReady && (await microsoft.status()).connected;
  return { deliveryReady: connected && Boolean(config.formKey), campaignReady: connected };
}
