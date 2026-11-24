import crypto from 'crypto';
import { config } from '../config/env';

const ENVELOPE_PREFIX = 'enc:v1:';
const ENVELOPE_REGEX = /^enc:v1:([0-9a-f]+):([0-9a-f]+):([0-9a-f]*)$/i;
const MASK_PREFIX = '••••';

function deriveAes256Key(rawSecret: string): Buffer {
  return crypto.createHash('sha256').update(rawSecret, 'utf8').digest();
}

export function isEncryptedSecret(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return ENVELOPE_REGEX.test(value.trim());
}

export function isMaskedSecretSentinel(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith(MASK_PREFIX) || trimmed.includes('••••••••');
}

export function encryptSecret(plaintext: string): string {
  const key = deriveAes256Key(config.dataEncryptionKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENVELOPE_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored || typeof stored !== 'string') {
    throw new Error('Encrypted secret payload is empty or invalid');
  }
  const match = stored.trim().match(ENVELOPE_REGEX);
  if (!match) {
    throw new Error('Invalid encrypted secret format (expected enc:v1:iv:tag:cipher)');
  }
  const [, ivHex, tagHex, cipherHex] = match;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const cipherBuf = Buffer.from(cipherHex, 'hex');

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Invalid AES-256-GCM IV or authentication tag length');
  }

  const candidateSecrets = [config.dataEncryptionKey, ...config.dataEncryptionPreviousKeys];
  let lastError: Error | null = null;

  for (const candidate of candidateSecrets) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', deriveAes256Key(candidate), iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(`Failed to decrypt or authenticate secret payload: ${lastError?.message || 'auth tag mismatch'}`);
}

export function maskSecretForApi(
  storedOrPlain: string | null | undefined,
  kind: 'webhook' | 'key' = 'key'
): string | null {
  if (!storedOrPlain || typeof storedOrPlain !== 'string' || !storedOrPlain.trim()) {
    return null;
  }

  let plain = storedOrPlain.trim();
  if (isEncryptedSecret(plain)) {
    plain = decryptSecret(plain);
  }

  const tail = plain.length > 4 ? plain.slice(-4) : '****';
  if (kind === 'webhook') {
    try {
      const parsed = new URL(plain);
      return `•••••••• (${parsed.host} ...${tail})`;
    } catch {
      return `${MASK_PREFIX}${tail}`;
    }
  }
  return `${MASK_PREFIX}${tail}`;
}
