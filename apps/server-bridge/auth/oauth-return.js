const RETURN_ORIGIN_COOKIE = 'oauth_return_origin';

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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

function configuredOrigins() {
  return [
    process.env.UI_ORIGIN,
    process.env.UI_ALLOWED_ORIGINS,
    process.env.FRONTEND_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap(value => String(value).split(','))
    .map(value => normalizeOrigin(value.trim()))
    .filter(Boolean);
}

function isLoopbackOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      process.env.NODE_ENV !== 'production' &&
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

function isAllowedReturnOrigin(origin) {
  if (!origin) return false;
  return configuredOrigins().includes(origin) || isLoopbackOrigin(origin);
}

export function getFrontendUrl() {
  const origin = normalizeOrigin(process.env.UI_ORIGIN);
  if (!origin) {
    throw new Error('UI_ORIGIN environment variable is required');
  }
  return origin;
}

export function getOAuthRequestOrigin(req) {
  const candidates = [
    req.query?.returnOrigin,
    req.get?.('origin'),
    req.get?.('referer'),
    req.headers?.origin,
    req.headers?.referer,
  ];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (isAllowedReturnOrigin(origin)) return origin;
  }

  return getFrontendUrl();
}

export function setOAuthReturnOriginCookie(res, origin) {
  res.cookie(RETURN_ORIGIN_COOKIE, origin, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
}

export function getOAuthReturnOrigin(req) {
  const origin = req.cookies?.[RETURN_ORIGIN_COOKIE] || parseCookies(req.headers?.cookie)[RETURN_ORIGIN_COOKIE];
  if (isAllowedReturnOrigin(origin)) return origin;
  return getFrontendUrl();
}

export function clearOAuthReturnOriginCookie(res) {
  res.clearCookie(RETURN_ORIGIN_COOKIE, { path: '/' });
}

export function buildOAuthCallbackUrl(origin, error = null) {
  const callbackUrl = new URL('/auth/callback', origin);
  if (error) callbackUrl.searchParams.set('error', error);
  return callbackUrl.toString();
}
