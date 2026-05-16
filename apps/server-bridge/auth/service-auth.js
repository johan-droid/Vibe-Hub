import crypto from 'node:crypto';
import { authenticateFromHeaders } from './middleware.js';

function configuredServiceTokens(env = process.env) {
  const raw = env.SELINA_SERVICE_API_KEY || env.SELINA_SERVICE_API_KEYS || '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function serviceTokenFromRequest(req) {
  return req.get('x-api-key') || req.get('x-service-token') || null;
}

function actingUserIdFromRequest(req) {
  return (
    req.get('x-acting-user-id')
    || req.body?.userId
    || req.query?.userId
    || null
  );
}

export async function requireIntegrationAuth(req, res, next) {
  const serviceToken = serviceTokenFromRequest(req);
  const validServiceToken = configuredServiceTokens().find((candidate) => safeEqual(candidate, serviceToken));

  if (serviceToken && validServiceToken) {
    req.authMode = 'service';
    req.serviceAuth = {
      label: req.get('x-service-name') || 'external-service',
    };
    return next();
  }

  const authorization = req.get('authorization');
  const explicitAccessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (explicitAccessToken) {
    const auth = await authenticateFromHeaders(req.headers, explicitAccessToken);
    if (auth) {
      req.authMode = 'bearer';
      req.user = auth.user;
      req.sessionId = auth.sessionId;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Integration authentication required. Use Authorization: Bearer <token> or X-API-Key.',
    code: 'INTEGRATION_AUTH_REQUIRED',
  });
}

export function requireScopedIntegrationUser(req, res, next) {
  if (req.user?.id) return next();

  const actingUserId = actingUserIdFromRequest(req);
  if (!actingUserId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required for service-authenticated requests. Provide X-Acting-User-Id or include userId in the request.',
      code: 'ACTING_USER_REQUIRED',
    });
  }

  req.user = {
    id: actingUserId,
    email: null,
    name: req.serviceAuth?.label || 'Service Integration',
    provider: 'service',
  };
  return next();
}

export function integrationAuthSummary() {
  return {
    supported: ['bearer', 'x-api-key'],
    serviceTokenHeader: 'X-API-Key',
    actingUserHeader: 'X-Acting-User-Id',
    notes: [
      'Bearer authentication expects a Selina access token.',
      'Service authentication expects SELINA_SERVICE_API_KEY or SELINA_SERVICE_API_KEYS to be configured on the server.',
      'User-scoped service requests must include X-Acting-User-Id or userId in the payload.',
    ],
  };
}
