//ES-256-GCM Encryption for sensitive values (GitHub PATs)

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit authentication tag

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32 || !/^[0-9a-f]{64}$/i.test(raw)) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal string.');
    }
    return key;
  }

  // Keep the app usable with the existing deployment secret while allowing a dedicated key to be added later without changing the ciphertext format.
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret) {
    return createHash('sha256').update(`gitmaster-token-encryption:${sessionSecret}`).digest();
  }

  throw new Error(
    'Token encryption is not configured. Set ENCRYPTION_KEY or SESSION_SECRET before adding a GitHub account.',
  );
}

//Encrypt a plain-text string.
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

//Decrypt a value produced by encrypt().
export function decrypt(value: string): string {
  if (!value.startsWith('enc:')) {
    // Legacy plain-text token — return as-is (migration not yet run)
    return value;
  }

  const parts = value.split(':');
  // Format: "enc:<iv>:<tag>:<ciphertext>" — 4 parts when split on ':'
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted token: unexpected format.');
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  if (!/^[0-9a-f]{24}$/i.test(ivHex) || !/^[0-9a-f]{32}$/i.test(tagHex) || !/^[0-9a-f]+$/i.test(cipherHex)) {
    throw new Error('Malformed encrypted token: invalid ciphertext.');
  }
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

//Returns true if a value has already been encrypted by this module.
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}
