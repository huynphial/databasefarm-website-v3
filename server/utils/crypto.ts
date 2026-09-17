import 'dotenv/config';
import dotenv from 'dotenv';
try {
  dotenv.config();
} catch {}
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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
 * Timing-safe string comparison helper (prevents timing side-channel attacks)
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Adaptive Password Hashing using Bcrypt KDF (CWE-916 Mitigation)
 * Uses high computational cost (12 rounds) with cryptographically secure per-password salts
 */
export const DEFAULT_BCRYPT_ROUNDS = 12;
export const DUMMY_BCRYPT_HASH = '$2b$12$e7k2M3N4O5P6Q7R8S9T0UuV1W2X3Y4Z5a6b7c8d9e0f1g2h3i4j5k';

export async function hashPassword(password: string, rounds = DEFAULT_BCRYPT_ROUNDS): Promise<string> {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string.');
  }
  return bcrypt.hash(password, rounds);
}

export function hashPasswordSync(password: string, rounds = DEFAULT_BCRYPT_ROUNDS): string {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string.');
  }
  return bcrypt.hashSync(password, rounds);
}

/**
 * Constant-Time Password Verification using Adaptive KDF (CWE-916 & Timing Attack Mitigation)
 */
export async function verifyPassword(password: string, hashOrPlain: string): Promise<boolean> {
  if (typeof password !== 'string' || typeof hashOrPlain !== 'string') {
    await bcrypt.compare('dummy', DUMMY_BCRYPT_HASH);
    return false;
  }

  try {
    if (
      hashOrPlain.startsWith('$2') ||
      hashOrPlain.startsWith('$2a$') ||
      hashOrPlain.startsWith('$2b$') ||
      hashOrPlain.startsWith('$2y$')
    ) {
      return await bcrypt.compare(password, hashOrPlain);
    }
    // Fallback constant-time comparison for legacy non-bcrypt entries
    return constantTimeEqual(password, hashOrPlain);
  } catch {
    return constantTimeEqual(password, hashOrPlain);
  }
}

/**
 * Derives 256-bit AES key using PBKDF2 adaptive key derivation with fixed application salt
 */
export function getDerivedKeyInfo(): { masterKey: string; key: Buffer; keyHex: string } {
  const masterKey = getMasterKey();
  // Use PBKDF2 with 100,000 iterations for robust key derivation (CWE-916 defense)
  const key = crypto.pbkdf2Sync(masterKey, 'dbfarm_static_salt_v1', 100000, 32, 'sha256');
  return {
    masterKey,
    key,
    keyHex: key.toString('hex'),
  };
}

/**
 * Legacy key derivation fallback for decrypting ciphertexts generated prior to KDF upgrade
 */
export function getLegacyDerivedKeyInfo(): { masterKey: string; key: Buffer; keyHex: string } {
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
    try {
      const { key } = getLegacyDerivedKeyInfo();
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted.length >= 0;
    } catch {
      return false;
    }
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
      try {
        const { key } = getLegacyDerivedKeyInfo();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch {
        // Fallback on decryption failure
      }
    }
  }

  return cipherText;
}
