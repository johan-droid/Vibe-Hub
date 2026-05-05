import jwt from 'jsonwebtoken';
import {
  validateAccessToken,
  validateSession,
  rotateRefreshToken,
  generateSecureToken,
  hashToken
} from './session.js';

const JWT_SECRET = process.env.JWT_SECRET;

function isSecureCookie() {
  return process.env.NODE_ENV === 'production' && String(process.env.UI_ORIGIN).startsWith('https://');
}

if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
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

/**
 * Read access token from Authorization header or cookies
 */
function readAccessToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return parseCookies(req.headers.cookie).selina_access_token;
}

/**
 * Read session token from HTTP-only cookie
 */
function readSessionToken(req) {
  return parseCookies(req.headers.cookie).selina_session;
}

/**
 * Read refresh token from HTTP-only cookie
 */
function readRefreshToken(req) {
  return parseCookies(req.headers.cookie).selina_refresh;
}

/**
 * Set authentication cookies with security flags
 */
export function setAuthCookies(res, { accessToken, refreshToken, sessionToken }) {
  const secure = isSecureCookie();
  const sameSite = secure ? 'none' : 'lax';

  // Access token (short-lived, accessible for API calls)
  res.cookie('selina_access_token', accessToken, {
    httpOnly: false, // Allow JS to read for API calls
    secure,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  // Session token (HTTP-only, for session validation)
  if (sessionToken) {
    res.cookie('selina_session', sessionToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  // Refresh token (HTTP-only, for token rotation)
  if (refreshToken) {
    res.cookie('selina_refresh', refreshToken, {
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
  const sameSite = secure ? 'none' : 'lax';

  res.clearCookie('selina_access_token', { path: '/', secure, sameSite });
  res.clearCookie('selina_session', { path: '/', secure, sameSite });
  res.clearCookie('selina_refresh', { path: '/api/auth/refresh', secure, sameSite });
}

/**
 * Express middleware: Verify access token or session and attach user to req
 * Supports both JWT Bearer tokens and HTTP-only session cookies
 */
export async function requireAuth(req, res, next) {
  // Try access token first (from Authorization header or cookie)
  const accessToken = readAccessToken(req);
  if (accessToken) {
    const decoded = validateAccessToken(accessToken);
    if (decoded) {
      req.user = { id: decoded.id };
      req.sessionId = decoded.sessionId;
      return next();
    }
  }

  // Try session cookie (HTTP-only)
  const sessionToken = readSessionToken(req);
  if (sessionToken) {
    const session = await validateSession(sessionToken);
    if (session) {
      req.user = {
        id: session.userId,
        email: session.email,
        name: session.name,
        avatar_url: session.avatarUrl,
        provider: session.provider
      };
      req.sessionId = session.sessionId;
      return next();
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
  // Try access token first
  const accessToken = readAccessToken(req);
  if (accessToken) {
    const decoded = validateAccessToken(accessToken);
    if (decoded) {
      req.user = { id: decoded.id };
      req.sessionId = decoded.sessionId;
      return next();
    }
  }

  // Try session cookie
  const sessionToken = readSessionToken(req);
  if (sessionToken) {
    const session = await validateSession(sessionToken);
    if (session) {
      req.user = {
        id: session.userId,
        email: session.email,
        name: session.name,
        avatar_url: session.avatarUrl,
        provider: session.provider
      };
      req.sessionId = session.sessionId;
      return next();
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
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken // Also return for non-cookie clients
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

/**
 * Legacy: Read token from request (header or cookie)
 */
function readToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return parseCookies(req.headers.cookie).selina_token || readAccessToken(req);
}
