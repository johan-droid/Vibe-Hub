export function normalizeAuthUserPayload(input = {}) {
  return {
    id: input.id || input.userId || input.user_id || null,
    email: input.email || null,
    name: input.name || null,
    avatarUrl: input.avatarUrl || input.avatar_url || null,
    provider: input.provider || null,
    roles: Array.isArray(input.roles) ? input.roles : undefined,
    permissions: Array.isArray(input.permissions) ? input.permissions : undefined,
    tenantId: input.tenantId || input.tenant_id || undefined,
  };
}

export function authPayloadFromRequest(req) {
  return normalizeAuthUserPayload(req.user || {});
}

export function authPayloadFromSession(session = {}) {
  return normalizeAuthUserPayload({
    id: session.userId || session.user_id || session.id,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl || session.avatar_url,
    provider: session.provider,
    roles: session.roles,
    permissions: session.permissions,
    tenantId: session.tenantId || session.tenant_id,
  });
}

export function buildAuthenticatedResponse({ user, sessionId = null, provider = null, extra = {} } = {}) {
  return {
    success: true,
    authenticated: true,
    user: normalizeAuthUserPayload(user),
    sessionId,
    ...(provider ? { provider } : {}),
    ...extra,
  };
}

export function buildUnauthenticatedResponse() {
  return {
    success: true,
    authenticated: false,
    user: null,
    sessionId: null,
  };
}
