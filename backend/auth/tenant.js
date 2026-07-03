export class TenantContextError extends Error {
  constructor(message, code = 'TENANT_CONTEXT_INVALID') {
    super(message);
    this.name = 'TenantContextError';
    this.code = code;
  }
}

const TENANT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

function firstPresent(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeTenantId(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const tenantId = String(value).trim();
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new TenantContextError('tenant_id is malformed');
  }
  return tenantId;
}

function hasCrossTenantPermission(user = {}) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return (
    roles.includes('admin') ||
    roles.includes('owner') ||
    permissions.includes('*') ||
    permissions.includes('tenant:*') ||
    permissions.includes('tenant:admin')
  );
}

export function resolveTenantContext(req, { fallbackToUser = true } = {}) {
  const requestedTenantId = normalizeTenantId(firstPresent(
    req.get?.('x-tenant-id'),
    req.body?.tenantId,
    req.query?.tenantId,
  ));
  const tokenTenantId = normalizeTenantId(req.user?.tenantId);
  const fallbackTenantId = fallbackToUser && req.user?.id ? normalizeTenantId(req.user.id) : null;
  const tenantId = requestedTenantId || tokenTenantId || fallbackTenantId;

  if (!tenantId) {
    throw new TenantContextError('tenant context is required', 'TENANT_CONTEXT_REQUIRED');
  }

  if (
    requestedTenantId &&
    tokenTenantId &&
    requestedTenantId !== tokenTenantId &&
    !hasCrossTenantPermission(req.user)
  ) {
    throw new TenantContextError('requested tenant does not match authenticated tenant', 'TENANT_CONTEXT_FORBIDDEN');
  }

  return {
    tenantId,
    requestedTenantId,
    tokenTenantId,
    source: requestedTenantId ? 'request' : tokenTenantId ? 'token' : 'user',
  };
}

export function attachTenantContext(req, options = {}) {
  const context = resolveTenantContext(req, options);
  req.tenantId = context.tenantId;
  req.tenantContext = context;
  if (req.user) req.user.tenantId = req.user.tenantId || context.tenantId;
  return context;
}

export function tenantContextMiddleware(options = {}) {
  return (req, res, next) => {
    try {
      attachTenantContext(req, options);
      next();
    } catch (error) {
      if (error instanceof TenantContextError) {
        return res.status(error.code === 'TENANT_CONTEXT_FORBIDDEN' ? 403 : 400).json({
          success: false,
          code: error.code,
          error: error.message,
          requestId: req.id,
        });
      }
      return next(error);
    }
  };
}
