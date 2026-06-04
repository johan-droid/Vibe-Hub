export function getRequestId(req) {
  return req?.id || req?.requestId || req?.headers?.['x-request-id'] || null;
}

export function errorCodeFromStatus(status = 500) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

export function buildErrorEnvelope({
  code,
  message,
  status = 500,
  requestId = null,
  details = undefined,
  stack = undefined,
} = {}) {
  return {
    success: false,
    error: {
      code: code || errorCodeFromStatus(status),
      message: message || 'Internal server error',
      requestId,
      ...(details !== undefined ? { details } : {}),
      ...(stack ? { stack } : {}),
    },
  };
}

export function sendError(res, req, {
  status = 500,
  code,
  message,
  details,
  expose = false,
  stack,
} = {}) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const safeMessage = expose || isDevelopment || status < 500
    ? message
    : 'Internal server error';

  return res.status(status).json(buildErrorEnvelope({
    status,
    code,
    message: safeMessage,
    requestId: getRequestId(req),
    details,
    stack: isDevelopment ? stack : undefined,
  }));
}
