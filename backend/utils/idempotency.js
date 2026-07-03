import { getJson, setJson, deleteKey } from './cache.js';

const DEFAULT_TTL_SECONDS = 10 * 60; // 10 minutes

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

export function idempotencyMiddleware(ttlSeconds = DEFAULT_TTL_SECONDS) {
  return async (req, res, next) => {
    const key = cacheKey(req);
    if (!key) return next();

    const cacheKeyString = `idempotency:${key}`;

    try {
      let existing = await getJson(cacheKeyString);
      if (existing?.state === 'complete') {
        return replay(res, existing);
      }

      if (existing?.state === 'pending') {
        // Polling loop for active execution
        for (let attempt = 0; attempt < 120; attempt++) { // poll for up to 12s
          await new Promise(resolve => setTimeout(resolve, 100));
          existing = await getJson(cacheKeyString);
          if (existing?.state === 'complete') {
            return replay(res, existing);
          }
          if (!existing) {
            // The other request failed and deleted the key, we can proceed to run it ourselves
            break;
          }
        }
      }

      // Mark request as pending
      await setJson(cacheKeyString, { state: 'pending' }, ttlSeconds);

      const originalSend = res.send.bind(res);
      res.send = (body) => {
        // Express res.send can be called synchronously, so we perform async cache update in background
        if (res.statusCode < 500) {
          const entry = {
            state: 'complete',
            statusCode: res.statusCode,
            contentType: res.get('content-type') || 'application/json',
            body: typeof body === 'string' ? body : JSON.stringify(body),
          };
          setJson(cacheKeyString, entry, ttlSeconds).catch(err => {
            console.error('[Idempotency] Failed to finalize cache entry:', err.message);
          });
        } else {
          deleteKey(cacheKeyString).catch(err => {
            console.error('[Idempotency] Failed to delete cache entry:', err.message);
          });
        }
        return originalSend(body);
      };

      next();
    } catch (error) {
      // If cache lookup errors out, gracefully fall back to executing request without blocking
      console.error('[Idempotency] Middleware execution error:', error.message);
      next();
    }
  };
}

