import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../auth/middleware.js';

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
