import { describe, expect, it, beforeEach, vi } from 'vitest';
import ApiClient from './api.js';

describe('ApiClient cookie auth', () => {
  beforeEach(() => {
    localStorage.clear();
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
    vi.unstubAllGlobals();
  });
});
