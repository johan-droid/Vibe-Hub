const DEFAULT_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function cacheKey(req) {
  const key = req.get('Idempotency-Key');
  if (!key) return null;
  return `${req.user?.id || 'anonymous'}:${req.method}:${req.originalUrl}:${key}`;
}

function replay(res, entry) {
  res.set('Idempotency-Status', 'replayed');
  if (entry.contentType) res.type(entry.contentType);
  return res.status(entry.statusCode).send(entry.body);
}

export function idempotencyMiddleware(ttlMs = DEFAULT_TTL_MS) {
  return (req, res, next) => {
    const key = cacheKey(req);
    if (!key) return next();

    const existing = cache.get(key);
    if (existing?.state === 'complete') return replay(res, existing);

    if (existing?.state === 'pending') {
      existing.waiters.push({ res });
      return;
    }

    const entry = { state: 'pending', waiters: [] };
    cache.set(key, entry);

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (res.statusCode < 500) {
        entry.state = 'complete';
        entry.statusCode = res.statusCode;
        entry.contentType = res.get('content-type');
        entry.body = body;
        setTimeout(() => cache.delete(key), ttlMs).unref?.();
        for (const waiter of entry.waiters) replay(waiter.res, entry);
      } else {
        cache.delete(key);
        for (const waiter of entry.waiters) {
          waiter.res.status(503).json({ success: false, error: 'Original idempotent request failed.' });
        }
      }
      return originalSend(body);
    };

    next();
  };
}
