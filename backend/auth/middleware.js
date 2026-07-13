import logger from '../utils/detailed-logger.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { setTraceUser } from '../utils/tracing.js';
import { verifyExternalJwt, isExternalJwtConfigured } from './external-jwt.js';
import { attachTenantContext, TenantContextError } from './tenant.js';
import { resolveJwtSecret } from './dev-secrets.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  validateAccessTokenSession,
  validateSession,
  rotateRefreshToken,
} from './session.js';

const JWT_SECRET = resolveJwtSecret();
const AUTH_COOKIES = {
  access: 'selina_access_token',
  session: 'selina_session',
  refresh: 'selina_refresh',
  device: 'selina_device_id',
};

function isSecureCookie() {
  return process.env.NODE_ENV === 'production';
}

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(String(value).trim()).origin;
  } catch {
    return null;
  }
}

function configuredUiOrigins() {
  return [process.env.UI_ORIGIN, process.env.UI_ALLOWED_ORIGINS, process.env.FRONTEND_ORIGINS]
    .filter(Boolean)
    .flatMap(value => String(value).split(','))
    .map(normalizeOrigin)
    .filter(Boolean);
}

function configuredApiOrigin() {
  return normalizeOrigin(process.env.API_ORIGIN || process.env.PUBLIC_API_ORIGIN || process.env.RENDER_EXTERNAL_URL);
}

function requiresCrossSiteCookies() {
  if (!isSecureCookie()) return false;
  const apiOrigin = configuredApiOrigin();
  const uiOrigins = configuredUiOrigins();
  if (!apiOrigin || uiOrigins.length === 0) return true;
  return uiOrigins.some(origin => origin !== apiOrigin);
}

function cookieSameSite() {
  const override = String(process.env.AUTH_COOKIE_SAME_SITE || process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  if (['strict', 'lax', 'none'].includes(override)) return override;
  return requiresCrossSiteCookies() ? 'none' : 'lax';
}

function authCookieOptions(maxAge) {
  const secure = isSecureCookie();
  const sameSite = cookieSameSite();
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge,
    path: '/',
  };
}

function clearCookieOptions() {
  return {
    path: '/',
    secure: isSecureCookie(),
    sameSite: cookieSameSite(),
  };
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
  const tenantId = session.tenantId || session.tenant_id;
  if (!tenantId) {
    // Fail hard — silently falling back to userId breaks RLS tenant isolation.
    const err = new Error('No tenantId resolved for session');
    err.code = 'TENANT_MISSING';
    throw err;
  }
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
    provider: session.provider,
    roles: Array.isArray(session.roles) ? session.roles : ['user'],
    permissions: Array.isArray(session.permissions) ? session.permissions : defaultLocalPermissions(),
    tenantId,
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
 * Set authentication cookies with security flags.
 *
 * Production split deployments such as Vercel UI -> Render API require
 * SameSite=None; Secure for credentialed cross-origin requests. Same-origin
 * deployments keep Lax by default. Override with AUTH_COOKIE_SAME_SITE when
 * the deployment topology is known.
 */
export function setAuthCookies(res, { accessToken, refreshToken, sessionToken, deviceId }) {
  res.cookie(AUTH_COOKIES.access, accessToken, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));

  if (sessionToken) {
    res.cookie(AUTH_COOKIES.session, sessionToken, authCookieOptions(30 * 24 * 60 * 60 * 1000));
  }

  if (refreshToken) {
    res.cookie(AUTH_COOKIES.refresh, refreshToken, authCookieOptions(90 * 24 * 60 * 60 * 1000));
  }

  if (deviceId) {
    res.cookie(AUTH_COOKIES.device, deviceId, authCookieOptions(365 * 24 * 60 * 60 * 1000));
  }
}

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies(res) {
  const options = clearCookieOptions();
  res.clearCookie(AUTH_COOKIES.access, options);
  res.clearCookie(AUTH_COOKIES.session, options);
  res.clearCookie(AUTH_COOKIES.refresh, options);
  res.clearCookie(AUTH_COOKIES.device, options);
}

export function ensureDeviceCookie(req, res) {
  const existingDeviceId = readDeviceCookie(req);
  if (existingDeviceId) return existingDeviceId;

  const deviceId = issueDeviceCookieValue();
  res.cookie(AUTH_COOKIES.device, deviceId, authCookieOptions(365 * 24 * 60 * 60 * 1000));
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
      if (error instanceof TenantContextError || error.code === 'TENANT_MISSING') {
        return res.status(403).json({
          error: error.message,
          code: error.code || 'TENANT_CONTEXT_FORBIDDEN',
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
      if (error instanceof TenantContextError || error.code === 'TENANT_MISSING') {
        return res.status(403).json({
          error: error.message,
          code: error.code || 'TENANT_CONTEXT_FORBIDDEN',
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
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'vibe-hub-auth' });
    // Reject legacy tokens that have no type field — they were issued by the deprecated
    // generateToken() function and bypass session-level revocation checks.
    if (decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}
