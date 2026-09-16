import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDirectory(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[CryptoLogger] Failed to create logs directory:', err);
  }
}

function getCryptoLogFilePath(): string {
  ensureLogsDirectory();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return path.join(LOGS_DIR, `crypto-${year}-${month}-${day}.log`);
}

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Append step-by-step crypto trace log to crypto log file and console
 */
export function logCryptoStep(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', stepName: string, details: Record<string, any> | string): void {
  try {
    const timeStr = formatTimestamp();
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    const logLine = `[${timeStr}] [${level}] [${stepName}] ${detailsStr}\n`;

    // Append to file
    const logPath = getCryptoLogFilePath();
    fs.appendFile(logPath, logLine, 'utf8', (err) => {
      if (err) {
        console.error('[CryptoLogger] Error writing to log file:', err);
      }
    });

    // Also output to console in development / server logs for immediate visibility
    if (level === 'ERROR') {
      console.error(`[CRYPTO] [${stepName}]`, details);
    } else if (level === 'WARN') {
      console.warn(`[CRYPTO] [${stepName}]`, details);
    } else {
      console.log(`[CRYPTO] [${stepName}]`, details);
    }
  } catch (err) {
    console.error('[CryptoLogger] Logging failure:', err);
  }
}

const MASTER_KEY_ENV = process.env.AES_ENCRYPTION_KEY || 'default_master_dbfarm_aes256_key_32b!';
const KEY = crypto.createHash('sha256').update(MASTER_KEY_ENV).digest();

// Log master key initialization detail on startup
logCryptoStep('INFO', 'INIT_MASTER_KEY', {
  source: process.env.AES_ENCRYPTION_KEY ? 'process.env.AES_ENCRYPTION_KEY' : 'DEFAULT_FALLBACK',
  rawKeyLength: MASTER_KEY_ENV.length,
  derivedKeyAlgorithm: 'sha256',
  derivedKeyBytes: KEY.length,
  derivedKeyFingerprintHex: KEY.toString('hex').substring(0, 16) + '...' + KEY.toString('hex').substring(48),
});

/**
 * Checks if a given string is a valid AES-256-CBC ciphertext decryptable by current key
 */
export function isCiphertextValid(cipherText: string | null | undefined): boolean {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:')) {
    return false;
  }
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    logCryptoStep('DEBUG', 'VALIDATE_CIPHERTEXT_CHECK', {
      status: 'INVALID',
      reason: `Expected 3 parts separated by colons (enc:iv:cipher), found ${parts.length}`,
      samplePreview: cipherText.substring(0, 20) + '...',
    });
    return false;
  }
  const ivHex = parts[1];
  const encHex = parts[2];
  if (ivHex.length !== 32) {
    logCryptoStep('DEBUG', 'VALIDATE_CIPHERTEXT_CHECK', {
      status: 'INVALID',
      reason: `IV length is ${ivHex.length} chars (expected 32 hex chars for 16 bytes)`,
      ivHex,
    });
    return false;
  }
  if (!/^[0-9a-fA-F]+$/.test(encHex) || encHex.length % 32 !== 0) {
    logCryptoStep('DEBUG', 'VALIDATE_CIPHERTEXT_CHECK', {
      status: 'INVALID',
      reason: `Encrypted text length (${encHex.length}) is not a multiple of 32 (16 bytes AES block size in hex) or contains non-hex chars`,
    });
    return false;
  }
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const valid = decrypted.length >= 0;
    logCryptoStep('DEBUG', 'VALIDATE_CIPHERTEXT_CHECK', {
      status: valid ? 'VALID_DECRYPTABLE' : 'INVALID',
      ivHex,
      ciphertextLength: encHex.length,
      decryptedLen: decrypted.length,
    });
    return valid;
  } catch (err: any) {
    logCryptoStep('DEBUG', 'VALIDATE_CIPHERTEXT_CHECK', {
      status: 'DECRYPTION_FAILED',
      error: err?.message || String(err),
      ivHex,
      ciphertextLength: encHex.length,
    });
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
  logCryptoStep('DEBUG', 'ENCRYPT_STEP_1_INPUT_RECEIVED', {
    inputType: typeof plainText,
    isNullOrUndefined: plainText === null || plainText === undefined,
    inputLength: plainText ? plainText.length : 0,
    startsWithEncPrefix: typeof plainText === 'string' && plainText.startsWith('enc:'),
  });

  if (!plainText || typeof plainText !== 'string' || plainText.trim() === '') {
    logCryptoStep('DEBUG', 'ENCRYPT_STEP_1_ABORT_EMPTY', {
      reason: 'Empty or non-string input received, returning null',
    });
    return null;
  }

  const trimmed = plainText.trim();

  // Step 2: Check if already a valid, decryptable AES-256-CBC ciphertext
  const isValidCipher = isCiphertextValid(trimmed);
  logCryptoStep('DEBUG', 'ENCRYPT_STEP_2_VALIDATE_EXISTING', {
    inputTrimmedLength: trimmed.length,
    isValidDecipherableCiphertext: isValidCipher,
  });

  if (isValidCipher) {
    logCryptoStep('INFO', 'ENCRYPT_STEP_2_PRESERVE_EXISTING', {
      message: 'Input is already a valid decryptable AES-256-CBC ciphertext. Preserving untouched.',
      cipherPrefix: trimmed.substring(0, 20) + '...',
      totalLength: trimmed.length,
    });
    return trimmed;
  }

  const textToEncrypt = trimmed;

  if (!textToEncrypt || textToEncrypt.trim() === '') {
    logCryptoStep('WARN', 'ENCRYPT_STEP_2_ABORT_BLANK', {
      reason: 'textToEncrypt is blank after trimming, returning null',
    });
    return null;
  }

  try {
    // Step 3: Generate 16-byte random Initialization Vector (IV)
    const iv = crypto.randomBytes(16);
    const ivHex = iv.toString('hex');
    logCryptoStep('DEBUG', 'ENCRYPT_STEP_3_GENERATE_IV', {
      ivByteLength: iv.length,
      ivHex,
    });

    // Step 4: Initialize AES-256-CBC cipher with derived KEY and IV
    logCryptoStep('DEBUG', 'ENCRYPT_STEP_4_INIT_CIPHER', {
      algorithm: 'aes-256-cbc',
      keyBytes: KEY.length,
      ivBytes: iv.length,
    });
    const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);

    // Step 5: Encrypt plaintext bytes to hex
    let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    logCryptoStep('DEBUG', 'ENCRYPT_STEP_5_TRANSFORM_CIPHERTEXT', {
      plainTextLength: textToEncrypt.length,
      cipherTextHexLength: encrypted.length,
      cipherBlocks: encrypted.length / 32,
    });

    // Step 6: Construct formatted encrypted string
    const result = `enc:${ivHex}:${encrypted}`;
    logCryptoStep('INFO', 'ENCRYPT_STEP_6_SUCCESS', {
      outputFormat: 'enc:<iv_hex>:<ciphertext_hex>',
      outputLength: result.length,
      ivHex,
      ciphertextHexPreview: encrypted.substring(0, 16) + '...' + encrypted.substring(Math.max(0, encrypted.length - 16)),
    });

    return result;
  } catch (err: any) {
    logCryptoStep('ERROR', 'ENCRYPT_FAILED', {
      errorMessage: err?.message || String(err),
      errorStack: err?.stack,
    });
    console.error('Password encryption error:', err);
    return null;
  }
}

/**
 * Decrypts an AES-256-CBC encrypted database password.
 * Returns the plain text string or fallback without throwing unhandled unpadding errors.
 */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  logCryptoStep('DEBUG', 'DECRYPT_STEP_1_INPUT_RECEIVED', {
    inputType: typeof cipherText,
    isNullOrUndefined: cipherText === null || cipherText === undefined,
    inputLength: cipherText ? cipherText.length : 0,
    startsWithEncPrefix: typeof cipherText === 'string' && cipherText.startsWith('enc:'),
  });

  if (!cipherText || typeof cipherText !== 'string') return null;
  if (!cipherText.startsWith('enc:')) {
    logCryptoStep('DEBUG', 'DECRYPT_PASSTHROUGH_NOT_ENCRYPTED', {
      message: 'String does not start with "enc:" prefix, returning raw string as plain text',
    });
    return cipherText;
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    logCryptoStep('WARN', 'DECRYPT_INVALID_PARTS', {
      message: `Expected 3 parts separated by colons, found ${parts.length}. Returning raw string.`,
    });
    return cipherText;
  }

  const ivHex = parts[1];
  const encHex = parts[2];

  if (ivHex.length === 32 && /^[0-9a-fA-F]+$/.test(encHex) && encHex.length % 32 === 0) {
    try {
      logCryptoStep('DEBUG', 'DECRYPT_STEP_2_INIT_DECIPHER', {
        algorithm: 'aes-256-cbc',
        ivHex,
        ciphertextHexLength: encHex.length,
      });
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
      let decrypted = decipher.update(encHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logCryptoStep('INFO', 'DECRYPT_STEP_3_SUCCESS', {
        ivHex,
        decryptedLength: decrypted.length,
      });

      return decrypted;
    } catch (err: any) {
      logCryptoStep('WARN', 'DECRYPT_UNPADDING_OR_KEY_MISMATCH', {
        errorMessage: err?.message || String(err),
        ivHex,
        ciphertextHexLength: encHex.length,
        note: 'Decryption failed (e.g. invalid padding byte or key mismatch). Returning stored raw string.',
      });
      console.warn('Password AES-256-CBC decryption unpadding warning:', err?.message || err);
    }
  } else {
    logCryptoStep('WARN', 'DECRYPT_INVALID_HEX_FORMAT', {
      ivHexLength: ivHex.length,
      encHexLength: encHex.length,
      isHexChars: /^[0-9a-fA-F]+$/.test(encHex),
      isBlockAligned: encHex.length % 32 === 0,
    });
  }

  return cipherText;
}