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
  getUserSessionByToken,
  getUserSessionById,
  updateSessionActivity,
  revokeUserSession,
  revokeAllUserSessions,
  listUserSessions,
  countActiveUserSessions,
  createRefreshToken,
  getRefreshTokenByHash,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  markRefreshTokenUsed,
  logAuthEvent
} from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test-secret' : undefined);
const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '90', 10);
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '10', 10);

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
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

/**
 * Generate device fingerprint from request headers
 */
export function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || ''
  ];
  return hashToken(components.join('|')).slice(0, 32);
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
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         req.ip ||
         '0.0.0.0';
}

/**
 * Create a new session for a user
 */
export async function createSession({ userId, provider, req, deviceFingerprint = null }) {
  // Check concurrent session limit
  const activeSessions = await countActiveUserSessions(userId);
  if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
    throw new Error('MAX_SESSIONS_EXCEEDED');
  }
  
  const sessionToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(sessionToken);
  
  const refreshToken = generateSecureToken(48);
  const refreshTokenHash = hashToken(refreshToken);
  
  const deviceInfo = extractDeviceInfo(req);
  const fingerprint = deviceFingerprint || generateDeviceFingerprint(req);
  const ipAddress = getClientIp(req);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);
  
  // Create user session in database
  const session = await createUserSession({
    userId,
    sessionToken: sessionTokenHash,
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
  const accessToken = jwt.sign(
    {
      id: userId,
      sessionId: session.id,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  return {
    accessToken,
    refreshToken,
    sessionToken,
    sessionId: session.id,
    expiresAt
  };
}

/**
 * Validate an access token and return the decoded payload
 */
export function validateAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
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
export async function validateAccessTokenSession(token) {
  const decoded = validateAccessToken(token);
  if (!decoded?.id || !decoded?.sessionId || decoded.type !== 'access') return null;

  const session = await getUserSessionById(decoded.sessionId);
  if (!session || String(session.user_id) !== String(decoded.id)) return null;

  await updateSessionActivity(session.id);
  return normalizeSession(session);
}

/**
 * Exchange refresh token for new access token (token rotation)
 */
export async function rotateRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  
  const existingToken = await getRefreshTokenByHash(tokenHash);
  if (!existingToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
  
  // Generate new tokens
  const newAccessToken = jwt.sign(
    {
      id: existingToken.user_id,
      sessionId: existingToken.session_id,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
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
export async function validateSession(sessionToken) {
  if (!sessionToken) return null;
  
  const session = await getUserSessionByToken(hashToken(sessionToken));
  if (!session) return null;
  
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
