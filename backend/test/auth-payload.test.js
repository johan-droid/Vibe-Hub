import { describe, expect, it } from 'vitest';
import {
  authPayloadFromSession,
  buildAuthenticatedResponse,
  buildUnauthenticatedResponse,
  normalizeAuthUserPayload,
} from '../auth/payload.js';

describe('auth payload normalization', () => {
  it('normalizes snake_case and camelCase avatar fields', () => {
    expect(normalizeAuthUserPayload({
      id: 'u1',
      email: 'a@example.com',
      name: 'Ashutosh',
      avatar_url: 'https://img.example.com/a.png',
      provider: 'google',
    })).toMatchObject({
      id: 'u1',
      avatarUrl: 'https://img.example.com/a.png',
      provider: 'google',
    });
  });

  it('normalizes session objects into user payloads', () => {
    expect(authPayloadFromSession({
      userId: 'u2',
      email: 'b@example.com',
      name: 'User B',
      avatarUrl: 'https://img.example.com/b.png',
      provider: 'github',
      tenantId: 'tenant-1',
    })).toMatchObject({
      id: 'u2',
      email: 'b@example.com',
      tenantId: 'tenant-1',
    });
  });

  it('builds authenticated response envelope', () => {
    expect(buildAuthenticatedResponse({
      user: { id: 'u3', email: 'c@example.com' },
      sessionId: 's1',
      provider: 'google',
    })).toEqual({
      success: true,
      authenticated: true,
      user: {
        id: 'u3',
        email: 'c@example.com',
        name: null,
        avatarUrl: null,
        provider: null,
        roles: undefined,
        permissions: undefined,
        tenantId: undefined,
      },
      sessionId: 's1',
      provider: 'google',
    });
  });

  it('builds unauthenticated response envelope', () => {
    expect(buildUnauthenticatedResponse()).toEqual({
      success: true,
      authenticated: false,
      user: null,
      sessionId: null,
    });
  });
});
