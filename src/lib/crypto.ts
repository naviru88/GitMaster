/* ============================================================
   AES-256-GCM Encryption for sensitive values (GitHub PATs)
   ============================================================
   Uses Node's built-in `crypto` module — no extra dependencies.

   Format of ciphertext stored in DB:
     "enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>"

   The "enc:" prefix lets the migration script and decrypt() distinguish
   already-encrypted values from legacy plain-text tokens so the
   transition is safe and idempotent.
   ============================================================ */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit authentication tag

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${key.length} bytes.`,
    );
  }
  return key;
}

/**
 * Encrypt a plain-text string.
 * Returns a prefixed string safe to store in a VARCHAR/TEXT column.
 */
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt().
 * Passes through plain-text values (no "enc:" prefix) so legacy rows
 * continue to work until the migration script re-encrypts them.
 */
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
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Returns true if a value has already been encrypted by this module.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}
