import { logger } from './logger.js';

let sentry = null;

export async function initSentry(app) {
  if (!process.env.SENTRY_DSN) return null;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    });
    sentry = Sentry;
    app?.use?.(Sentry.Handlers.requestHandler());
    logger.info('Sentry initialized');
    return Sentry;
  } catch (err) {
    logger.warn('Sentry requested but @sentry/node is unavailable', { error: err.message });
    return null;
  }
}

export function captureException(error, context = {}) {
  if (sentry) {
    sentry.captureException(error, { extra: context });
    return;
  }
  logger.error('Captured exception', {
    message: error?.message || String(error),
    stack: error?.stack,
    ...context,
  });
}

export function sentryErrorHandler() {
  return (err, req, _res, next) => {
    captureException(err, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
    });
    next(err);
  };
}
