import crypto from 'crypto';

const MASTER_KEY_ENV = process.env.AES_ENCRYPTION_KEY || 'default_master_dbfarm_aes256_key_32b!';
const KEY = crypto.createHash('sha256').update(MASTER_KEY_ENV).digest();

/**
 * Encrypts a plain-text database password using AES-256-CBC encryption.
 * Encrypted strings are prefixed with 'enc:' for easy identification.
 */
export function encryptPassword(plainText: string | null | undefined): string | null {
  if (!plainText) return null;
  if (plainText.startsWith('enc:')) return plainText;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc:${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-CBC encrypted database password.
 * Returns the plain text string or fallback if not encrypted.
 */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  if (!cipherText.startsWith('enc:')) return cipherText;

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Password decryption failed:', err);
    return cipherText;
  }
}
