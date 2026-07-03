import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../auth/middleware.js';
import authRoutes from '../auth/routes.js';
import { createOAuthHandoff } from '../auth/oauth-store.js';

vi.mock('jsonwebtoken');

describe('verifyToken', () => {
  it('should return decoded payload for a valid token', () => {
    const mockPayload = { id: 'user-123', email: 'test@example.com' };
    const token = 'valid.jwt.token';

    // Mock jwt.verify to return the payload
    jwt.verify = (t, s) => {
        if (t === token) return mockPayload;
        throw new Error('Invalid token');
    };

    const result = verifyToken(token);
    expect(result).toEqual(mockPayload);
  });

  it('should return null when jwt.verify throws (invalid token)', () => {
    jwt.verify = () => { throw new Error('invalid signature'); };

    const result = verifyToken('invalid-token');
    expect(result).toBeNull();
  });

  it('should return null when jwt.verify throws (expired token)', () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    jwt.verify = () => { throw expiredError; };

    const result = verifyToken('expired-token');
    expect(result).toBeNull();
  });

  it('should return null for empty or null token', () => {
    jwt.verify = () => { throw new Error('jwt must be provided'); };

    expect(verifyToken(null)).toBeNull();
    expect(verifyToken('')).toBeNull();
  });
});

describe('OAuth handoff', () => {
  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    return app;
  }

  it('should reject invalid or expired handoff codes', async () => {
    const response = await request(createApp())
      .post('/api/auth/handoff')
      .send({ code: 'missing-code' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      code: 'INVALID_HANDOFF'
    });
  });

  it('should exchange a valid handoff once and set session cookies', async () => {
    const session = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      sessionToken: 'session-token',
      sessionId: 'session-id'
    };
    const user = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: null,
      provider: 'google'
    };
    const code = await createOAuthHandoff({ provider: 'google', session, user });

    const response = await request(createApp())
      .post('/api/auth/handoff')
      .send({ code });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toMatchObject({
      success: true,
      authenticated: true,
      sessionId: 'session-id',
      provider: 'google',
      user
    });
    expect(response.body.accessToken).toBeUndefined();
    expect(response.headers['set-cookie'].some(cookie => cookie.startsWith('selina_access_token='))).toBe(true);
    expect(response.headers['set-cookie'].some(cookie => cookie.startsWith('selina_session='))).toBe(true);
    expect(response.headers['set-cookie'].some(cookie => cookie.startsWith('selina_refresh='))).toBe(true);

    const replay = await request(createApp())
      .post('/api/auth/handoff')
      .send({ code });

    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('INVALID_HANDOFF');
  });
});
