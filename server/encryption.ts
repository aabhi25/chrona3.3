import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    if (envKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }
    return crypto.scryptSync(envKey, 'salt', KEY_LENGTH);
  }
  
  const replId = process.env.REPL_ID || 'chrona-default-key';
  const ownerId = process.env.REPL_OWNER || 'default-owner';
  const passphrase = `${replId}-${ownerId}-chrona-secret-key`;
  
  return crypto.scryptSync(passphrase, 'chrona-encryption-salt', KEY_LENGTH);
}

export function encryptApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  const result = Buffer.concat([salt, iv, tag, encrypted]);
  
  return result.toString('base64');
}

export function decryptApiKey(encryptedData: string): string {
  if (!encryptedData || encryptedData.trim().length === 0) {
    throw new Error('Encrypted data cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const buffer = Buffer.from(encryptedData, 'base64');

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Failed to decrypt API key');
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return 'Invalid key';
  }
  
  const prefix = apiKey.substring(0, 3);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}...${suffix}`;
}

export function sanitizeErrorMessage(error: Error): string {
  let message = error.message;
  
  const apiKeyPattern = /sk-[a-zA-Z0-9]{20,}/g;
  message = message.replace(apiKeyPattern, 'sk-***');
  
  const authTokenPattern = /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g;
  message = message.replace(authTokenPattern, 'Bearer ***');
  
  return message;
}

export function logApiKeyUsage(
  schoolId: string,
  operation: string,
  keySource: 'school' | 'global',
  success: boolean,
  details?: string
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    schoolId,
    operation,
    keySource,
    success,
    details: details || 'N/A'
  };
  
  console.log(`[API_KEY_USAGE] ${JSON.stringify(logEntry)}`);
}
