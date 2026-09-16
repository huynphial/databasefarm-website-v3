import crypto from 'crypto';

const MASTER_KEY_ENV = process.env.AES_ENCRYPTION_KEY || 'default_master_dbfarm_aes256_key_32b!';
const KEY = crypto.createHash('sha256').update(MASTER_KEY_ENV).digest();

/**
 * Checks if a given string is a valid AES-256-CBC ciphertext decryptable by current key
 */
export function isCiphertextValid(cipherText: string | null | undefined): boolean {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:')) {
    return false;
  }
  const parts = cipherText.split(':');
  if (parts.length !== 3) return false;
  const ivHex = parts[1];
  const encHex = parts[2];
  if (ivHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(encHex) || encHex.length % 32 !== 0) {
    return false;
  }
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted.length >= 0;
  } catch {
    return false;
  }
}

/**
 * Encrypts a plain-text database password using standard AES-256-CBC encryption.
 * Encrypted strings are prefixed with 'enc:<iv_hex>:<ciphertext_hex>'.
 * If the input is already a valid, currently-decryptable AES ciphertext, it is
 * preserved untouched (this is the only case where the input is not encrypted).
 * Everything else - including a string that merely starts with 'enc:' or looks
 * hex/base64-like but does NOT actually decrypt with the current key - is treated
 * as literal plaintext and encrypted as-is. We deliberately do NOT try to
 * "repair" or decode such strings: guessing at a hidden payload risks silently
 * replacing the real password with garbage, which is worse than just encrypting
 * the literal input.
 */
export function encryptPassword(plainText: string | null | undefined): string | null {
  if (!plainText || typeof plainText !== 'string' || plainText.trim() === '') {
    return null;
  }

  const trimmed = plainText.trim();

  // If already a valid, decryptable AES-256-CBC ciphertext, keep it untouched
  if (isCiphertextValid(trimmed)) {
    return trimmed;
  }

  const textToEncrypt = trimmed;

  if (!textToEncrypt || textToEncrypt.trim() === '') {
    return null;
  }

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${iv.toString('hex')}:${encrypted}`;
  } catch (err: any) {
    console.error('Password encryption error:', err);
    return null;
  }
}

/**
 * Decrypts an AES-256-CBC encrypted database password.
 * Returns the plain text string or fallback without throwing unhandled unpadding errors.
 */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  if (!cipherText || typeof cipherText !== 'string') return null;
  if (!cipherText.startsWith('enc:')) return cipherText;

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return cipherText;
  }

  const ivHex = parts[1];
  const encHex = parts[2];

  if (ivHex.length === 32 && /^[0-9a-fA-F]+$/.test(encHex) && encHex.length % 32 === 0) {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      // Unpadding error or invalid key - do not crash, and do not guess at the
      // original value. Fall through and return the raw stored string so the
      // caller can tell decryption failed, instead of silently returning
      // fabricated/garbage text.
      console.warn('Password AES-256-CBC decryption unpadding warning:', err?.message || err);
    }
  }

  return cipherText;
}