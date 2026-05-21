import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import logger from '../utils/detailed-logger.js';

const DEFAULT_ALLOWED_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384'];
const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

let jwksCache = {
  uri: null,
  fetchedAt: 0,
  keys: [],
};

function csv(value, fallback = []) {
  const parsed = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function readClaim(payload, claimName) {
  if (!claimName) return undefined;
  if (Object.prototype.hasOwnProperty.call(payload, claimName)) return payload[claimName];
  return String(claimName)
    .split('.')
    .reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), payload);
}

function arrayClaim(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function externalJwtConfig(env = process.env) {
  return {
    jwksUri: env.AUTH_JWKS_URI || env.OIDC_JWKS_URI || '',
    issuer: env.AUTH_ISSUER || env.OIDC_ISSUER || '',
    audience: env.AUTH_AUDIENCE || env.OIDC_AUDIENCE || '',
    algorithms: csv(env.AUTH_JWT_ALGORITHMS, DEFAULT_ALLOWED_ALGORITHMS),
    rolesClaim: env.AUTH_ROLES_CLAIM || 'roles',
    permissionsClaim: env.AUTH_PERMISSIONS_CLAIM || 'permissions',
    tenantClaim: env.AUTH_TENANT_CLAIM || 'tenant_id',
    maxTtlSeconds: Number.parseInt(env.AUTH_JWT_MAX_TTL_SECONDS || '300', 10),
    cacheTtlMs: Number.parseInt(env.AUTH_JWKS_CACHE_TTL_MS || `${DEFAULT_CACHE_TTL_MS}`, 10),
  };
}

export function isExternalJwtConfigured(env = process.env) {
  return Boolean(externalJwtConfig(env).jwksUri);
}

async function fetchJwks(config) {
  const now = Date.now();
  if (
    jwksCache.uri === config.jwksUri &&
    now - jwksCache.fetchedAt < config.cacheTtlMs &&
    jwksCache.keys.length
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(config.jwksUri, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`JWKS fetch failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  jwksCache = {
    uri: config.jwksUri,
    fetchedAt: now,
    keys: Array.isArray(body.keys) ? body.keys : [],
  };
  return jwksCache.keys;
}

function publicKeyFromJwk(jwk) {
  return crypto
    .createPublicKey({ key: jwk, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' });
}

function enforceShortLivedJwt(payload, maxTtlSeconds) {
  if (!payload.exp) {
    throw new Error('external JWT must include exp');
  }
  if (maxTtlSeconds > 0) {
    if (!payload.iat) {
      throw new Error('external JWT must include iat when max TTL enforcement is enabled');
    }
    if (payload.exp - payload.iat > maxTtlSeconds) {
      throw new Error(`external JWT lifetime exceeds ${maxTtlSeconds}s`);
    }
  }
}

function normalizeExternalUser(payload, config) {
  const subject = payload.sub || payload.user_id || payload.id;
  const roles = arrayClaim(readClaim(payload, config.rolesClaim));
  const permissions = arrayClaim(readClaim(payload, config.permissionsClaim));
  const tenantId = readClaim(payload, config.tenantClaim);

  return {
    id: String(subject),
    email: payload.email || null,
    name: payload.name || payload.nickname || payload.preferred_username || String(subject),
    avatarUrl: payload.picture || null,
    provider: 'external-jwt',
    roles,
    permissions,
    tenantId: tenantId ? String(tenantId) : null,
    authIssuer: payload.iss || null,
  };
}

export async function verifyExternalJwt(token, { env = process.env } = {}) {
  const config = externalJwtConfig(env);
  if (!config.jwksUri) return null;

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid || !decoded?.header?.alg) {
    throw new Error('external JWT header must include kid and alg');
  }
  if (!config.algorithms.includes(decoded.header.alg)) {
    throw new Error(`external JWT algorithm ${decoded.header.alg} is not allowed`);
  }

  const keys = await fetchJwks(config);
  const jwk = keys.find(item => item.kid === decoded.header.kid);
  if (!jwk) throw new Error(`JWKS key not found for kid ${decoded.header.kid}`);

  const verifyOptions = {
    algorithms: config.algorithms,
  };
  if (config.issuer) verifyOptions.issuer = config.issuer;
  if (config.audience) verifyOptions.audience = config.audience;

  const payload = jwt.verify(token, publicKeyFromJwk(jwk), verifyOptions);
  enforceShortLivedJwt(payload, config.maxTtlSeconds);
  const user = normalizeExternalUser(payload, config);
  if (!user.id || user.id === 'undefined') throw new Error('external JWT subject is missing');

  logger.debug('Auth', 'Validated external JWT', {
    issuer: payload.iss,
    audience: payload.aud,
    subject: user.id,
    tenantId: user.tenantId,
  });

  return {
    user,
    sessionId: `external:${payload.jti || payload.sub}`,
    tokenExpiresAt: payload.exp * 1000,
  };
}

export function resetExternalJwtCacheForTests() {
  jwksCache = { uri: null, fetchedAt: 0, keys: [] };
}
