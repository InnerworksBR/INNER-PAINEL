import crypto from 'crypto';

const PREFIX = 'enc:v1';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const rawKey = process.env.INTEGRATION_SECRET_KEY;
  if (!rawKey) {
    throw new Error('INTEGRATION_SECRET_KEY não configurada no backend.');
  }

  return crypto.createHash('sha256').update(rawKey).digest();
}

export function isEncryptedSecret(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(value?: string | null): string | null {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptSecret(value?: string | null): string | null {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;

  const [, , ivRaw, tagRaw, encryptedRaw] = value.split(':');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Secret criptografado inválido.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function hasConfiguredSecret(value?: string | null): boolean {
  return Boolean(value && String(value).trim().length > 0);
}
