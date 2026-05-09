import logger from '../utils/detailed-logger.js';
import jwt from 'jsonwebtoken';
import {
  validateAccessTokenSession,
  validateSession,
  rotateRefreshToken,
} from './session.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : undefined);
const AUTH_COOKIES = {
  access: 'selina_access_token',
  session: 'selina_session',
  refresh: 'selina_refresh',
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
    { expiresIn: '7d' }
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

/**
 * Read refresh token from HTTP-only cookie
 */
function readRefreshToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIES.refresh];
}

function normalizeUser(session) {
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
    provider: session.provider
  };
}

export async function authenticateFromHeaders(headers = {}, explicitAccessToken = null) {
  const cookies = parseCookies(headers.cookie);
  const accessToken =
    explicitAccessToken ||
    readBearerToken(headers.authorization) ||
    cookies[AUTH_COOKIES.access];

  if (accessToken) {
    const session = await validateAccessTokenSession(accessToken);
    if (session) {
      return {
        user: normalizeUser(session),
        sessionId: session.sessionId
      };
    }
  }

  const sessionToken = cookies[AUTH_COOKIES.session];
  if (sessionToken) {
    const session = await validateSession(sessionToken);
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
export function setAuthCookies(res, { accessToken, refreshToken, sessionToken }) {
  const secure = isSecureCookie();
  const sameSite = 'strict';

  // Access token (short-lived, sent automatically with API calls)
  res.cookie(AUTH_COOKIES.access, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 minutes
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
      path: '/api/auth/refresh', // Only sent to refresh endpoint
    });
  }
}

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies(res) {
  const secure = isSecureCookie();
  const sameSite = 'strict';

  res.clearCookie(AUTH_COOKIES.access, { path: '/', secure, sameSite });
  res.clearCookie(AUTH_COOKIES.session, { path: '/', secure, sameSite });
  res.clearCookie(AUTH_COOKIES.refresh, { path: '/api/auth/refresh', secure, sameSite });
}

/**
 * Express middleware: Verify access token or session and attach user to req
 * Supports both JWT Bearer tokens and HTTP-only session cookies
 */
export async function requireAuth(req, res, next) {
  const auth = await authenticateFromHeaders(req.headers);
  if (auth) {
    req.user = auth.user;
    req.sessionId = auth.sessionId;
    return next();
  }

  // No valid auth found
  return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
}

/**
 * Middleware: Try to authenticate but don't fail if not authenticated
 * Useful for endpoints that work differently for authenticated users
 */
export async function optionalAuth(req, res, next) {
  const auth = await authenticateFromHeaders(req.headers);
  if (auth) {
    req.user = auth.user;
    req.sessionId = auth.sessionId;
    return next();
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

  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Refresh token required.', code: 'REFRESH_REQUIRED' });
  }

  try {
    const result = await rotateRefreshToken(refreshToken);

    // Set new cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
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
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

