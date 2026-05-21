import logger from '../utils/detailed-logger.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { setTraceUser } from '../utils/tracing.js';
import { verifyExternalJwt, isExternalJwtConfigured } from './external-jwt.js';
import { attachTenantContext, TenantContextError } from './tenant.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  validateAccessTokenSession,
  validateSession,
  rotateRefreshToken,
} from './session.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'test-secret' : undefined);
const AUTH_COOKIES = {
  access: 'selina_access_token',
  session: 'selina_session',
  refresh: 'selina_refresh',
  device: 'selina_device_id',
};

function isSecureCookie() {
  return process.env.NODE_ENV === 'production';
}

if (!JWT_SECRET) {
  logger.error('Auth', 'FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

/**
 * Generate a legacy JWT for a user (deprecated - use createSession instead)
 * Kept for backwards compatibility during migration
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`, issuer: 'vibe-hub-auth' }
  );
}

/**
 * Parse cookies from request header
 */
function parseCookies(header = '') {
  try {
    return Object.fromEntries(
      header
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

function readBearerToken(header) {
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
}

function csv(value, fallback = []) {
  const parsed = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function defaultLocalPermissions() {
  return csv(process.env.AUTH_DEFAULT_USER_PERMISSIONS, [
    'tool:read',
    'tool:write',
    'tool:execute',
    'tool:github',
    'tool:browser',
    'tool:mcp',
    'tool:memory',
  ]);
}

/**
 * Read refresh token from HTTP-only cookie
 */
function readRefreshToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIES.refresh];
}

function readDeviceCookie(req) {
  const cookies = req?.cookies || parseCookies(req?.headers?.cookie || '');
  return cookies[AUTH_COOKIES.device] || null;
}

function issueDeviceCookieValue() {
  return crypto.randomBytes(24).toString('base64url');
}

function normalizeUser(session) {
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
    provider: session.provider,
    roles: Array.isArray(session.roles) ? session.roles : ['user'],
    permissions: Array.isArray(session.permissions) ? session.permissions : defaultLocalPermissions(),
    tenantId: session.tenantId || session.tenant_id || session.userId,
  };
}

export async function authenticateFromHeaders(headers = {}, explicitAccessToken = null, req = null) {
  const cookies = parseCookies(headers.cookie);
  const accessToken =
    explicitAccessToken ||
    readBearerToken(headers.authorization) ||
    cookies[AUTH_COOKIES.access];

  if (accessToken) {
    const session = await validateAccessTokenSession(accessToken, req);
    if (session) {
      return {
        user: normalizeUser(session),
        sessionId: session.sessionId
      };
    }

    if (isExternalJwtConfigured()) {
      try {
        return await verifyExternalJwt(accessToken);
      } catch (error) {
        logger.warn('Auth', 'External JWT validation failed', { error: error.message });
      }
    }
  }

  const sessionToken = cookies[AUTH_COOKIES.session];
  if (sessionToken) {
    const session = await validateSession(sessionToken, req);
    if (session) {
      return {
        user: normalizeUser(session),
        sessionId: session.sessionId
      };
    }
  }

  return null;
}

/**
 * Set authentication cookies with security flags
 */
export function setAuthCookies(res, { accessToken, refreshToken, sessionToken, deviceId }) {
  const secure = isSecureCookie();
  // Use 'lax' for development to allow OAuth callback cookies
  // In production with proper domain setup, 'strict' can be used
  const sameSite = process.env.NODE_ENV === 'production' ? 'strict' : 'lax';

  // Access token (short-lived, sent automatically with API calls)
  res.cookie(AUTH_COOKIES.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });

  // Session token (HTTP-only, for session validation)
  if (sessionToken) {
    res.cookie(AUTH_COOKIES.session, sessionToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  // Refresh token (HTTP-only, for token rotation)
  if (refreshToken) {
    res.cookie(AUTH_COOKIES.refresh, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      // This route is mounted under both /api/auth and /api/v6/auth.
      path: '/',
    });
  }

  if (deviceId) {
    res.cookie(AUTH_COOKIES.device, deviceId, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies(res) {
  const secure = isSecureCookie();
  // Use 'lax' for development to match setAuthCookies
  const sameSite = process.env.NODE_ENV === 'production' ? 'strict' : 'lax';

  res.clearCookie(AUTH_COOKIES.access, { path: '/', secure, sameSite });
  res.clearCookie(AUTH_COOKIES.session, { path: '/', secure, sameSite });
  res.clearCookie(AUTH_COOKIES.refresh, { path: '/', secure, sameSite });
}

export function ensureDeviceCookie(req, res) {
  const existingDeviceId = readDeviceCookie(req);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = issueDeviceCookieValue();
  res.cookie(AUTH_COOKIES.device, deviceId, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'strict',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return deviceId;
}

/**
 * Express middleware: Verify access token or session and attach user to req
 * Supports both JWT Bearer tokens and HTTP-only session cookies
 */
export async function requireAuth(req, res, next) {
  const auth = await authenticateFromHeaders(req.headers, null, req);
  if (auth) {
    req.user = auth.user;
    req.sessionId = auth.sessionId;
    try {
      attachTenantContext(req);
      setTraceUser(auth.user.id);
      return next();
    } catch (error) {
      if (error instanceof TenantContextError) {
        return res.status(error.code === 'TENANT_CONTEXT_FORBIDDEN' ? 403 : 400).json({
          error: error.message,
          code: error.code,
          requestId: req.id,
        });
      }
      return next(error);
    }
  }

  // No valid auth found
  return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
}

/**
 * Middleware: Try to authenticate but don't fail if not authenticated
 * Useful for endpoints that work differently for authenticated users
 */
export async function optionalAuth(req, res, next) {
  const auth = await authenticateFromHeaders(req.headers, null, req);
  if (auth) {
    req.user = auth.user;
    req.sessionId = auth.sessionId;
    try {
      attachTenantContext(req);
      setTraceUser(auth.user.id);
      return next();
    } catch (error) {
      if (error instanceof TenantContextError) {
        return res.status(error.code === 'TENANT_CONTEXT_FORBIDDEN' ? 403 : 400).json({
          error: error.message,
          code: error.code,
          requestId: req.id,
        });
      }
      return next(error);
    }
  }

  // No auth - continue without user
  req.user = null;
  next();
}

/**
 * Handle token refresh request
 */
export async function handleRefreshToken(req, res) {
  const refreshToken = readRefreshToken(req) || req.body?.refreshToken;
  const deviceId = readDeviceCookie(req);

  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Refresh token required.', code: 'REFRESH_REQUIRED' });
  }

  try {
    const result = await rotateRefreshToken(refreshToken);

    // Set new cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      deviceId,
    });

    return res.json({
      success: true
    });
  } catch (err) {
    clearAuthCookies(res);
    const code = err.message === 'SUSPICIOUS_ACTIVITY' ? 'SUSPICIOUS_ACTIVITY' : 'INVALID_REFRESH_TOKEN';
    return res.status(401).json({ error: 'Invalid or expired refresh token.', code });
  }
}

/**
 * Verify a JWT and return the decoded payload (for WebSocket auth)
 * Legacy support - use session validation for new code
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'vibe-hub-auth' });
  } catch {
    return null;
  }
}
