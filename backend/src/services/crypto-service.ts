import crypto from 'crypto';

const PREFIX = 'enc:v1';
const IV_LENGTH = 12;

// Chave derivada de uma fonte estável (JWT_SECRET) caso INTEGRATION_SECRET_KEY
// não esteja definida. Isso evita 500 quando o deploy esquecer de configurar.
let _cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const rawKey =
    process.env.INTEGRATION_SECRET_KEY ||
    process.env.JWT_SECRET ||
    'inner-fallback-secret-key-32-bytes-min!';

  // Sempre materializa 32 bytes (AES-256) via SHA-256 do valor configurado.
  _cachedKey = crypto.createHash('sha256').update(rawKey).digest();

  if (!process.env.INTEGRATION_SECRET_KEY) {
    console.warn(
      '[crypto-service] INTEGRATION_SECRET_KEY não configurada — usando fallback derivado de JWT_SECRET. ' +
      'Configure INTEGRATION_SECRET_KEY no ambiente de produção para máxima segurança.'
    );
  }

  return _cachedKey;
}

export function isEncryptedSecret(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(value?: string | null): string | null {
  if (!value) return null;
  if (isEncryptedSecret(value)) return value;

  try {
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
  } catch (err) {
    console.error('[crypto-service] Erro ao criptografar secret:', err);
    throw err;
  }
}

export function decryptSecret(value?: string | null): string | null {
  if (!value) return null;
  if (!isEncryptedSecret(value)) return value;

  try {
    const parts = value.split(':');
    if (parts.length !== 5) {
      throw new Error('Secret criptografado em formato inválido.');
    }
    const [, , ivRaw, tagRaw, encryptedRaw] = parts;
    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new Error('Secret criptografado inválido.');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('[crypto-service] Erro ao descriptografar secret:', err);
    return null;
  }
}

export function hasConfiguredSecret(value?: string | null): boolean {
  return Boolean(value && String(value).trim().length > 0);
}