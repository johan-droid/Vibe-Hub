import { describe, expect, it, beforeEach, vi } from 'vitest';
import ApiClient from './api.js';

describe('ApiClient cookie auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('does not persist access, refresh, or session tokens to localStorage', () => {
    const client = new ApiClient();

    client.setAuthTokens({
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      sessionToken: 'session-secret',
    });

    expect(localStorage.getItem('selina_access_token')).toBeNull();
    expect(localStorage.getItem('selina_refresh_token')).toBeNull();
    expect(localStorage.getItem('selina_session_token')).toBeNull();
    expect(client.baseHeaders.Authorization).toBeUndefined();
  });

  it('refreshes through cookies without sending a refresh token body', async () => {
    const client = new ApiClient();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await client.refreshAccessToken();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/refresh'), expect.objectContaining({
      credentials: 'include',
      body: JSON.stringify({}),
    }));
  });

  it('treats auth status 401 as unauthenticated instead of forcing logout', async () => {
    const client = new ApiClient();
    const fetchMock = vi.fn(async () => ({
      status: 401,
      ok: false,
      json: async () => ({ error: 'Authentication required' }),
      text: async () => 'Authentication required',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await client.authStatus();

    expect(status).toMatchObject({
      success: true,
      authenticated: false,
      user: null,
      sessionId: null,
    });
  });

  it('can recover bootstrap auth by refreshing before giving up', async () => {
    const client = new ApiClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ error: 'Authentication required' }),
        text: async () => 'Authentication required',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          authenticated: true,
          user: { id: 'user-1', email: 'dev@example.com' },
          sessionId: 'session-1',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const status = await client.resolveSession();

    expect(status.authenticated).toBe(true);
    expect(status.user.id).toBe('user-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
