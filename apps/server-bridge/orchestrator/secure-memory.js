import crypto from 'crypto';

const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
const ENCRYPTION_ALGO = 'aes-256-gcm';

export function createSecureHistoryStore({
  retentionMs = Number.parseInt(process.env.SELINA_MEMORY_RETENTION_MS || `${DEFAULT_RETENTION_MS}`, 10),
  now = () => Date.now(),
} = {}) {
  const encryptedRecords = [];

  const materialize = () => {
    purgeExpired(encryptedRecords, retentionMs, now());
    return encryptedRecords.map(record => decryptRecord(record)).filter(Boolean);
  };

  return new Proxy(encryptedRecords, {
    get(target, prop) {
      if (prop === 'push') {
        return (...messages) => {
          purgeExpired(target, retentionMs, now());
          target.push(...messages.map(message => encryptRecord(message, now())));
          return target.length;
        };
      }
      if (prop === 'splice') {
        return (start, deleteCount, ...items) => {
          const decrypted = materialize();
          const removed = decrypted.splice(start, deleteCount, ...items);
          target.splice(0, target.length, ...decrypted.map(message => encryptRecord(message, now())));
          return removed;
        };
      }
      if (prop === 'slice') return (...args) => materialize().slice(...args);
      if (prop === 'map') return callback => materialize().map(callback);
      if (prop === 'filter') return callback => materialize().filter(callback);
      if (prop === 'findIndex') return callback => materialize().findIndex(callback);
      if (prop === 'findLastIndex') return callback => materialize().findLastIndex(callback);
      if (prop === 'toJSON') return () => materialize();
      if (prop === Symbol.iterator) return materialize()[Symbol.iterator].bind(materialize());
      if (prop === 'length') return materialize().length;
      if (isArrayIndex(prop)) return materialize()[Number(prop)];
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (isArrayIndex(prop)) {
        target[Number(prop)] = encryptRecord(value, now());
        return true;
      }
      if (prop === 'length') {
        target.length = value;
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });
}

export function encryptRecord(message, createdAt = Date.now()) {
  const plaintext = JSON.stringify(message ?? {});
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, memoryKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    createdAt,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptRecord(record) {
  if (!record?.encrypted) return record;
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGO,
    memoryKey(),
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

export function purgeExpired(records = [], retentionMs = DEFAULT_RETENTION_MS, now = Date.now()) {
  const cutoff = now - Math.max(1, retentionMs);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if ((records[index]?.createdAt || now) < cutoff) records.splice(index, 1);
  }
  return records;
}

export function sanitizeCompletionForRetention(text, maxChars = Number.parseInt(process.env.SELINA_MEMORY_COMPLETION_MAX_CHARS || '4000', 10)) {
  const normalized = String(text ?? '');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n[completion truncated for retention policy]`;
}

export function getEncryptedRecordCount(historyStore) {
  return Array.isArray(historyStore) ? historyStore.length : 0;
}

function memoryKey() {
  const source = process.env.SELINA_MEMORY_ENCRYPTION_KEY || process.env.VIBE_MASTER_KEY || 'development-only-memory-key';
  if (process.env.NODE_ENV === 'production' && source === 'development-only-memory-key') {
    throw new Error('SELINA_MEMORY_ENCRYPTION_KEY or VIBE_MASTER_KEY is required in production.');
  }
  if (/^[a-f0-9]{64}$/i.test(source)) return Buffer.from(source, 'hex');
  return crypto.createHash('sha256').update(source).digest();
}

function isArrayIndex(prop) {
  if (typeof prop === 'symbol') return false;
  const index = Number(prop);
  return Number.isInteger(index) && index >= 0 && String(index) === String(prop);
}
