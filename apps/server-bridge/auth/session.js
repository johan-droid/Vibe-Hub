import logger from '../utils/detailed-logger.js';
/**
 * SAAS-GRADE: Session Management Service
 * 
 * Provides secure session handling with:
 * - Device fingerprinting
 * - Refresh token rotation
 * - Concurrent session limits
 * - Session revocation
 * - Audit logging
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  createUserSession,
  getUserSessionById,
  getUserSessionByToken,
  updateSessionActivity,
  revokeUserSession,
  revokeAllUserSessions,
  listUserSessions,
  countActiveUserSessions,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  markRefreshTokenUsed,
  revokeOldestUserSession,
  logAuthEvent
} from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test-secret' : undefined);
const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '90', 10);
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10);
const DEVICE_COOKIE_NAME = 'selina_device_id';
export const ACCESS_TOKEN_TTL_SECONDS = Math.max(
  60,
  Math.min(parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '240', 10), 299),
);

if (!JWT_SECRET) {
  logger.error('Auth', 'FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const sessionCleanupRegistry = new Map(); // sessionId -> Set<cleanupCallback>

function issueAccessToken({ userId, sessionId }) {
  return jwt.sign(
    {
      id: userId,
      sessionId,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`, issuer: 'vibe-hub-auth' }
  );
}

export function registerSessionCleanup(sessionId, cleanupCallback) {
  if (!sessionId || typeof cleanupCallback !== 'function') return cleanupCallback;
  const callbacks = sessionCleanupRegistry.get(sessionId) || new Set();
  callbacks.add(cleanupCallback);
  sessionCleanupRegistry.set(sessionId, callbacks);
  return cleanupCallback;
}

export function unregisterSessionCleanup(sessionId, cleanupCallback = null) {
  if (!sessionId) return;

  if (!cleanupCallback) {
    sessionCleanupRegistry.delete(sessionId);
    return;
  }

  const callbacks = sessionCleanupRegistry.get(sessionId);
  if (!callbacks) return;

  callbacks.delete(cleanupCallback);
  if (callbacks.size === 0) {
    sessionCleanupRegistry.delete(sessionId);
  }
}

export function triggerFingerprintMismatchCleanup(sessionId) {
  const callbacks = sessionCleanupRegistry.get(sessionId);
  if (callbacks?.size) {
    for (const cleanup of callbacks) {
      try {
        cleanup();
      } catch (err) {
        console.error(`[Security] Failed running fingerprint mismatch cleanup for session ${sessionId}:`, err);
      }
    }
    sessionCleanupRegistry.delete(sessionId);
  }
}

function parseCookies(header = '') {
  try {
    return Object.fromEntries(
      String(header)
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const index = part.indexOf('=');
          if (index === -1) return [part, ''];
          return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
        })
    );
  } catch {
    return {};
  }
}

function readFingerprintDeviceId(req, { legacy = false, explicitDeviceId = null } = {}) {
  if (explicitDeviceId) return explicitDeviceId;

  const headerDeviceId = req?.headers?.['x-device-id'];
  if (headerDeviceId) return headerDeviceId;
  if (legacy) return 'no-device-id';

  const cookieDeviceId = req?.cookies?.[DEVICE_COOKIE_NAME]
    || parseCookies(req?.headers?.cookie || '')[DEVICE_COOKIE_NAME];

  return cookieDeviceId || 'no-device-id';
}

function normalizeLoopbackAddress(ip = '') {
  const normalized = String(ip || '').trim();
  if (!normalized) return '0.0.0.0';
  if (normalized === '::1' || normalized === '[::1]') return '127.0.0.1';
  if (normalized.startsWith('::ffff:')) return normalized.slice('::ffff:'.length);
  return normalized;
}

function bucketIpForFingerprint(ip, { legacy = false } = {}) {
  const rawIp = String(ip || '').trim() || '0.0.0.0';
  const normalized = legacy ? rawIp : normalizeLoopbackAddress(rawIp);

  if (legacy) {
    if (normalized.includes('.')) {
      return normalized.split('.').slice(0, 3).join('.');
    }
    if (normalized.includes(':')) {
      return normalized.split(':').slice(0, 4).join(':');
    }
    return '0.0.0.0';
  }

  if (normalized === '127.0.0.1' || normalized === 'localhost') {
    return 'loopback';
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const octets = normalized.split('.').map(part => Number.parseInt(part, 10));
    if (octets[0] === 169 && octets[1] === 254) return '169.254';
    return `${octets[0]}.${octets[1]}.${octets[2]}`;
  }

  if (normalized.includes(':')) {
    const compact = normalized.toLowerCase();
    if (compact === '::1') return 'loopback';
    if (compact.startsWith('fe80')) return 'fe80';
    return compact.split(':').slice(0, 4).join(':');
  }

  return '0.0.0.0';
}

function computeFingerprintVariant(req, { legacy = false, explicitDeviceId = null } = {}) {
  if (!req) return 'no-req-fingerprint';
  const ip = getClientIp(req);
  const ipRange = bucketIpForFingerprint(ip, { legacy });
  const ua = req.headers['user-agent'] || '';
  const deviceId = readFingerprintDeviceId(req, { legacy, explicitDeviceId });
  const hmacDeviceId = crypto.createHmac('sha256', JWT_SECRET).update(deviceId).digest('hex');
  const rawFingerprint = `${ipRange}|${ua}|${hmacDeviceId}`;
  return crypto.createHash('sha256').update(rawFingerprint).digest('hex');
}

export function computeCompoundFingerprint(req, explicitDeviceId = null) {
  return computeFingerprintVariant(req, { explicitDeviceId });
}

function computeLegacyCompoundFingerprint(req) {
  return computeFingerprintVariant(req, { legacy: true });
}

function fingerprintMatchesRequest(storedFingerprint, req) {
  if (!storedFingerprint || !req) return true;
  if (storedFingerprint === computeCompoundFingerprint(req)) return true;
  return storedFingerprint === computeLegacyCompoundFingerprint(req);
}

/**
 * Generate device fingerprint from request headers
 */
export function generateDeviceFingerprint(req, explicitDeviceId = null) {
  return computeCompoundFingerprint(req, explicitDeviceId);
}

async function revokeSessionForFingerprintMismatch(session, req) {
  await revokeUserSession(session.id, session.user_id, 'fingerprint_changed');
  await revokeRefreshTokenFamily(session.id, 'fingerprint_changed');
  await logAuthEvent({
    userId: session.user_id,
    sessionId: session.id,
    eventType: 'failed',
    provider: session.provider,
    deviceInfo: extractDeviceInfo(req),
    ipAddress: getClientIp(req),
    details: { reason: 'fingerprint_changed' }
  });
  triggerFingerprintMismatchCleanup(session.id);
}

/**
 * Extract device info from request
 */
export function extractDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Simple device detection
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Unknown';
  
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet')) device = 'Tablet';
  else device = 'Desktop';
  
  return {
    browser,
    os,
    device,
    userAgent: userAgent.slice(0, 500) // Limit length
  };
}

/**
 * Get client IP address
 */
export function getClientIp(req) {
  return req.ip ||
         req.socket?.remoteAddress ||
         req.headers['x-real-ip'] ||
         '0.0.0.0';
}

/**
 * Create a new session for a user
 */
export async function createSession({ userId, provider, req, deviceFingerprint = null, deviceId = null }) {
  // Check concurrent session limit
  const activeSessions = await countActiveUserSessions(userId);
  if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
    const deviceInfo = extractDeviceInfo(req);
    const ipAddress = getClientIp(req);
    
    console.warn('[Session] MAX_SESSIONS_EXCEEDED for user:', userId, {
      activeCount: activeSessions,
      limit: MAX_CONCURRENT_SESSIONS,
      ip: ipAddress,
      device: deviceInfo.browser + ' on ' + deviceInfo.os
    });

    // In dev/prod, instead of blocking the user, we prune the oldest session
    // This is safer for UX than hard-locking the account.
    console.info('[Session] Auto-pruning oldest session for user:', userId);
    await revokeOldestUserSession(userId, 'limit_reached_auto_prune');
  }
  
  const sessionToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(sessionToken);
  
  const refreshToken = generateSecureToken(48);
  const refreshTokenHash = hashToken(refreshToken);
  
  const deviceInfo = extractDeviceInfo(req);
  const effectiveDeviceId = deviceId || readFingerprintDeviceId(req);
  const fingerprint = deviceFingerprint || generateDeviceFingerprint(req, effectiveDeviceId);
  const ipAddress = getClientIp(req);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);
  
  // Create user session in database
  const session = await createUserSession({
    userId,
    sessionToken: sessionTokenHash,
    provider,
    deviceFingerprint: fingerprint,
    deviceInfo,
    ipAddress,
    ipGeo: {}, // Could add geo lookup here
    expiresAt
  });
  
  // Create refresh token
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  
  await createRefreshToken({
    userId,
    sessionId: session.id,
    tokenHash: refreshTokenHash,
    previousTokenHash: null,
    expiresAt: refreshExpiresAt
  });
  
  // Log login event
  await logAuthEvent({
    userId,
    sessionId: session.id,
    eventType: 'login',
    provider,
    deviceInfo,
    ipAddress,
    details: { session_created: true }
  });
  
  // Generate JWT (short-lived access token)
  const accessToken = issueAccessToken({
    userId,
    sessionId: session.id
  });
  
  return {
    accessToken,
    refreshToken,
    sessionToken,
    deviceId: effectiveDeviceId,
    sessionId: session.id,
    expiresAt
  };
}

/**
 * Validate an access token and return the decoded payload
 */
export function validateAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'vibe-hub-auth' });
  } catch {
    return null;
  }
}

function normalizeSession(session) {
  return {
    userId: session.user_id,
    sessionId: session.id,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatar_url,
    provider: session.provider,
    expiresAt: session.expires_at
  };
}

/**
 * Validate a signed access token against its backing DB session.
 * A JWT alone is not enough: revoked or expired sessions must stop working
 * immediately instead of waiting for access-token expiry.
 */
export async function validateAccessTokenSession(token, req) {
  const decoded = validateAccessToken(token);
  if (!decoded?.id || !decoded?.sessionId || decoded.type !== 'access') return null;

  const session = await getUserSessionById(decoded.sessionId);
  if (!session || String(session.user_id) !== String(decoded.id)) return null;

  // Enforce fingerprint verification if req is provided
  if (req && session.device_fingerprint) {
    if (!fingerprintMatchesRequest(session.device_fingerprint, req)) {
      console.warn(`[Security] Session fingerprint mismatch for user ${session.user_id}, session ${session.id}. Revoking session.`);
      await revokeSessionForFingerprintMismatch(session, req);
      return null;
    }
  }

  await updateSessionActivity(session.id);
  return normalizeSession(session);
}

export async function assertSessionStillValid(sessionId, userId = null) {
  if (!sessionId) return null;
  const session = await getUserSessionById(sessionId);
  if (!session) return null;
  if (userId && String(session.user_id) !== String(userId)) return null;
  await updateSessionActivity(session.id);
  return normalizeSession(session);
}

/**
 * Exchange refresh token for new access token (token rotation)
 */
export async function rotateRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);

  const existingToken = await findRefreshTokenByHash(tokenHash);
  if (!existingToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const refreshExpired = new Date(existingToken.expires_at).getTime() <= Date.now();
  const sessionExpired = !existingToken.session_expires_at || new Date(existingToken.session_expires_at).getTime() <= Date.now();
  const sessionInactive = existingToken.session_active === false;
  const refreshAlreadyUsed = Boolean(existingToken.used_at);
  const refreshRevoked = Boolean(existingToken.is_revoked);

  if (refreshExpired || sessionExpired || sessionInactive) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (refreshAlreadyUsed || refreshRevoked) {
    if (existingToken.session_id && existingToken.user_id) {
      await revokeRefreshTokenFamily(existingToken.session_id, 'refresh_token_reuse_detected');
      await revokeUserSession(existingToken.session_id, existingToken.user_id, 'refresh_token_reuse_detected');
      await logAuthEvent({
        userId: existingToken.user_id,
        sessionId: existingToken.session_id,
        eventType: 'failed',
        provider: existingToken.provider,
        details: { reason: 'refresh_token_reuse_detected' }
      });
      triggerFingerprintMismatchCleanup(existingToken.session_id);
    }
    throw new Error('SUSPICIOUS_ACTIVITY');
  }

  await markRefreshTokenUsed(tokenHash);

  // Generate new tokens
  const newAccessToken = issueAccessToken({
    userId: existingToken.user_id,
    sessionId: existingToken.session_id
  });
  
  const newRefreshToken = generateSecureToken(48);
  const newRefreshTokenHash = hashToken(newRefreshToken);
  
  // Create new refresh token with rotation
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  
  await createRefreshToken({
    userId: existingToken.user_id,
    sessionId: existingToken.session_id,
    tokenHash: newRefreshTokenHash,
    previousTokenHash: tokenHash,
    expiresAt: refreshExpiresAt
  });
  
  // Revoke old refresh token
  await revokeRefreshToken(tokenHash, 'rotated');
  
  // Update session activity
  await updateSessionActivity(existingToken.session_id);
  
  // Log refresh event
  await logAuthEvent({
    userId: existingToken.user_id,
    sessionId: existingToken.session_id,
    eventType: 'refresh',
    provider: existingToken.provider,
    details: { rotated: true }
  });
  
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    userId: existingToken.user_id
  };
}

/**
 * Validate a session token from cookie
 */
export async function validateSession(sessionToken, req) {
  if (!sessionToken) return null;
  
  const session = await getUserSessionByToken(hashToken(sessionToken));
  if (!session) return null;
  
  // Enforce fingerprint verification if req is provided
  if (req && session.device_fingerprint) {
    if (!fingerprintMatchesRequest(session.device_fingerprint, req)) {
      console.warn(`[Security] Session fingerprint mismatch for session ${session.id}. Revoking session.`);
      await revokeSessionForFingerprintMismatch(session, req);
      return null;
    }
  }

  // Update last activity
  await updateSessionActivity(session.id);
  
  return normalizeSession(session);
}

/**
 * Logout a specific session
 */
export async function logoutSession(userId, sessionId, reason = 'user_logout') {
  await revokeUserSession(sessionId, userId, reason);
  
  await logAuthEvent({
    userId,
    sessionId,
    eventType: 'logout',
    provider: null,
    details: { reason }
  });
}

/**
 * Logout all sessions for a user except current
 */
export async function logoutAllSessions(userId, exceptSessionId, reason = 'logout_all') {
  await revokeAllUserSessions(userId, exceptSessionId, reason);
  
  await logAuthEvent({
    userId,
    sessionId: exceptSessionId,
    eventType: 'logout',
    provider: null,
    details: { reason: 'logout_all_except_current', excluded_session: exceptSessionId }
  });
}

/**
 * Get active sessions for a user
 */
export async function getUserActiveSessions(userId) {
  return await listUserSessions(userId);
}

/**
 * Clean up expired sessions and tokens
 * Note: Uses direct SQL queries that don't need db.js helpers
 */
export async function cleanupExpiredSessions(dbPool) {
  if (!dbPool) return;
  
  // Mark expired sessions as inactive
  await dbPool.query(
    `UPDATE user_sessions
     SET is_active = false, revoked_at = NOW(), revoked_reason = 'expired'
     WHERE is_active = true AND expires_at < NOW()`
  );
  
  // Mark expired refresh tokens as revoked
  await dbPool.query(
    `UPDATE refresh_tokens
     SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'expired'
     WHERE is_revoked = false AND expires_at < NOW()`
  );
  
  // Delete old records (keep for 30 days for audit)
  const deleteCutoff = new Date();
  deleteCutoff.setDate(deleteCutoff.getDate() - 30);
  
  await dbPool.query('DELETE FROM refresh_tokens WHERE is_revoked = true AND revoked_at < $1', [deleteCutoff]);
  await dbPool.query('DELETE FROM user_sessions WHERE is_active = false AND revoked_at < $1', [deleteCutoff]);
}
