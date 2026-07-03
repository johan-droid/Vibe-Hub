import crypto from 'crypto';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_TTL_MS = 60 * 60 * 1000;

function csrfSecret() {
  return process.env.CSRF_SECRET || process.env.JWT_SECRET || 'dev-csrf-secret';
}

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

function sign(payload) {
  return crypto
    .createHmac('sha256', csrfSecret())
    .update(payload)
    .digest('base64url');
}

export function generateCsrfToken(userId) {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyCsrfToken(token, userId) {
  if (!token || !userId) return false;
  const parts = String(token).split('.');
  if (parts.length !== 4) return false;

  const [tokenUserId, issuedAtRaw, nonce, signature] = parts;
  if (tokenUserId !== String(userId)) return false;

  const issuedAt = Number.parseInt(issuedAtRaw, 10);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return false;

  const payload = `${tokenUserId}.${issuedAt}.${nonce}`;
  const expected = sign(payload);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function csrfTokenHandler(req, res) {
  const token = generateCsrfToken(req.user.id);
  const sameSite = process.env.CSRF_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
  const secure = (process.env.NODE_ENV === 'production' && String(process.env.UI_ORIGIN).startsWith('https://')) || sameSite === 'none';
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });
  res.json({ csrfToken: token, headerName: 'X-CSRF-Token', expiresInMs: TOKEN_TTL_MS });
}

export function csrfProtection(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();

  const headerToken = req.get(CSRF_HEADER);
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing or invalid.',
      requestId: req.id,
    });
  }

  if (!verifyCsrfToken(headerToken, req.user?.id)) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token expired or invalid.',
      requestId: req.id,
    });
  }

  next();
}
