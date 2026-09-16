import 'dotenv/config';
import dotenv from 'dotenv';
try {
  dotenv.config();
} catch {}
import crypto from 'crypto';

/**
 * Dynamically resolves master key from environment in both production and development
 */
export function getMasterKey(): string {
  if (!process.env.AES_ENCRYPTION_KEY) {
    try {
      dotenv.config();
    } catch {}
  }
  return process.env.AES_ENCRYPTION_KEY || 'default_master_dbfarm_aes256_key_32b!';
}

/**
 * Derives 256-bit AES key using SHA-256
 */
export function getDerivedKeyInfo(): { masterKey: string; key: Buffer; keyHex: string } {
  const masterKey = getMasterKey();
  const key = crypto.createHash('sha256').update(masterKey).digest();
  return {
    masterKey,
    key,
    keyHex: key.toString('hex'),
  };
}

/**
 * Checks if a given string is a valid AES-256-CBC ciphertext decryptable by current key
 */
export function isCiphertextValid(cipherText: string | null | undefined): boolean {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:')) {
    return false;
  }
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return false;
  }
  const ivHex = parts[1];
  const encHex = parts[2];
  if (ivHex.length !== 32) {
    return false;
  }
  if (!/^[0-9a-fA-F]+$/.test(encHex) || encHex.length % 32 !== 0) {
    return false;
  }
  try {
    const { key } = getDerivedKeyInfo();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
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
 * preserved untouched.
 */
export function encryptPassword(plainText: string | null | undefined): string | null {
  if (!plainText || typeof plainText !== 'string' || plainText.trim() === '') {
    return null;
  }

  const trimmed = plainText.trim();

  // If already a valid, decryptable AES-256-CBC ciphertext, preserve untouched
  if (trimmed.startsWith('enc:') && isCiphertextValid(trimmed)) {
    return trimmed;
  }

  const textToEncrypt = trimmed;
  if (!textToEncrypt || textToEncrypt.trim() === '') {
    return null;
  }

  try {
    const { key } = getDerivedKeyInfo();
    const iv = crypto.randomBytes(16);
    const ivHex = iv.toString('hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `enc:${ivHex}:${encrypted}`;
  } catch {
    return null;
  }
}

/**
 * Decrypts an AES-256-CBC encrypted database password.
 * Returns the plain text string or fallback without throwing unhandled unpadding errors.
 */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  if (!cipherText || typeof cipherText !== 'string') return null;
  if (!cipherText.startsWith('enc:')) {
    return cipherText;
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return cipherText;
  }

  const ivHex = parts[1];
  const encHex = parts[2];

  if (ivHex.length === 32 && /^[0-9a-fA-F]+$/.test(encHex) && encHex.length % 32 === 0) {
    try {
      const { key } = getDerivedKeyInfo();
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Fallback on decryption failure
    }
  }

  return cipherText;
}
