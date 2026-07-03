import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { idempotencyMiddleware } from '../utils/idempotency.js';
import { configureCache } from '../utils/cache.js';

describe('Distributed Idempotency Middleware', () => {
  let app;
  let callCount;

  beforeEach(() => {
    // Reset cache configuration to use standard memory cache for testing
    configureCache({ redis: null });
    callCount = 0;

    app = express();
    app.use(express.json());

    // Mock authenticated user on the request
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id' };
      next();
    });

    app.use(idempotencyMiddleware(60));

    // Dynamic endpoint that increments callCount and returns a response
    app.post('/test-idempotent', (req, res) => {
      callCount++;
      const { status = 200, message = 'Success' } = req.body;
      res.status(status).json({
        callCount,
        message,
        timestamp: Date.now(),
      });
    });
  });

  it('bypasses idempotency checks when Idempotency-Key header is missing', async () => {
    const res1 = await request(app)
      .post('/test-idempotent')
      .send({ message: 'No key' });

    const res2 = await request(app)
      .post('/test-idempotent')
      .send({ message: 'No key' });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.callCount).toBe(1);
    expect(res2.body.callCount).toBe(2);
    expect(res1.headers['idempotency-status']).toBeUndefined();
    expect(res2.headers['idempotency-status']).toBeUndefined();
  });

  it('replays response and sets header when identical Idempotency-Key is provided', async () => {
    const key = 'test-key-123';

    const res1 = await request(app)
      .post('/test-idempotent')
      .set('Idempotency-Key', key)
      .send({ message: 'Hello' });

    const res2 = await request(app)
      .post('/test-idempotent')
      .set('Idempotency-Key', key)
      .send({ message: 'Hello' });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.callCount).toBe(1);
    expect(res2.body.callCount).toBe(1);
    expect(res1.headers['idempotency-status']).toBeUndefined();
    expect(res2.headers['idempotency-status']).toBe('replayed');
    expect(res1.body.timestamp).toBe(res2.body.timestamp);
  });

  it('evicts cache and allows retry when original request fails with 5xx error', async () => {
    const key = 'test-key-fail';

    // First request fails with 500
    const res1 = await request(app)
      .post('/test-idempotent')
      .set('Idempotency-Key', key)
      .send({ status: 500, message: 'Server error' });

    expect(res1.status).toBe(500);

    // Second request is sent and should be processed because first one failed
    const res2 = await request(app)
      .post('/test-idempotent')
      .set('Idempotency-Key', key)
      .send({ status: 200, message: 'Succeeded now' });

    expect(res2.status).toBe(200);
    expect(res2.body.callCount).toBe(2); // Ran handler again
    expect(res2.headers['idempotency-status']).toBeUndefined();
  });

  it('serializes and waits for in-flight pending concurrent requests', async () => {
    const key = 'concurrent-key';
    
    // Set up a slower test route
    app.post('/test-slow', (req, res) => {
      callCount++;
      setTimeout(() => {
        res.status(200).json({ callCount, message: 'Slow complete' });
      }, 500);
    });

    // Fire first request (takes 500ms)
    const p1 = request(app)
      .post('/test-slow')
      .set('Idempotency-Key', key)
      .send();

    // Fire second concurrent request shortly after (should poll and wait)
    const p2 = new Promise((resolve) => {
      setTimeout(async () => {
        const res = await request(app)
          .post('/test-slow')
          .set('Idempotency-Key', key)
          .send();
        resolve(res);
      }, 100);
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.callCount).toBe(1);
    expect(res2.body.callCount).toBe(1);
    expect(res2.headers['idempotency-status']).toBe('replayed');
  });
});
