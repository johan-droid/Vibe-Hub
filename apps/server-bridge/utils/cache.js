import crypto from 'crypto';

const memoryCache = new Map();
let redisClient = null;

export function configureCache({ redis = null } = {}) {
  redisClient = redis;
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export async function getJson(key) {
  if (redisClient) {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function setJson(key, value, ttlSeconds) {
  if (redisClient) {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
  return value;
}

export async function withJsonCache(key, ttlSeconds, compute) {
  const cached = await getJson(key);
  if (cached !== null) return { value: cached, hit: true };

  const value = await compute();
  await setJson(key, value, ttlSeconds);
  return { value, hit: false };
}
