import { useStore } from '../store/useStore';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD
  ? 'https://vibe-hub-bridge.onrender.com'
  : `http://${window.location.hostname}:3001`);

// Token storage keys
const ACCESS_TOKEN_KEY = 'selina_access_token';
const REFRESH_TOKEN_KEY = 'selina_refresh_token';
const SESSION_TOKEN_KEY = 'selina_session_token';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readError(res) {
  try {
    const data = await res.json();
    return data.error || data.message || res.statusText;
  } catch {
    return res.statusText || 'Request failed';
  }
}

/**
 * Centralized API client for all REST calls to the backend.
 */
class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || null;
    this.sessionToken = localStorage.getItem(SESSION_TOKEN_KEY) || null;
    this.csrfToken = null;
    this.csrfPromise = null;
    this.refreshPromise = null;
  }

  getToken() {
    // Legacy support
    const legacy = localStorage.getItem('selina_token');
    if (legacy) {
      this.accessToken = legacy;
      localStorage.removeItem('selina_token');
      localStorage.setItem(ACCESS_TOKEN_KEY, legacy);
    }
    return this.accessToken;
  }

  hasToken() {
    return Boolean(this.getToken() || this.sessionToken);
  }

  setToken(token) {
    // Legacy support
    this.setAccessToken(token);
  }

  setAccessToken(token) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }

  setRefreshToken(token) {
    this.refreshToken = token;
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  setSessionToken(token) {
    this.sessionToken = token;
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }

  setAuthTokens({ accessToken, refreshToken, sessionToken }) {
    this.setAccessToken(accessToken);
    if (refreshToken) this.setRefreshToken(refreshToken);
    if (sessionToken) this.setSessionToken(sessionToken);
  }

  clearToken() {
    this.clearAllTokens();
  }

  clearAllTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.sessionToken = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem('selina_token'); // legacy
  }

  get baseHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken() || this.accessToken;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  /**
   * Attempt to refresh the access token using refresh token
   */
  async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (!res.ok) {
          throw new Error('Refresh failed');
        }

        const data = await res.json();
        if (data.success) {
          this.setAuthTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
          });
          return data.accessToken;
        }
        throw new Error('Invalid refresh response');
      } catch (err) {
        this.clearAllTokens();
        useStore.getState().logout();
        throw err;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async fetchCsrfToken() {
    if (this.csrfToken) return this.csrfToken;
    if (this.csrfPromise) return this.csrfPromise;

    this.csrfPromise = fetch(`${API_BASE}/api/csrf-token`, {
      headers: this.baseHeaders,
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401) {
          this.clearToken();
          useStore.getState().logout();
        }
        if (!res.ok) throw new ApiError(await readError(res), res.status);
        const data = await res.json();
        this.csrfToken = data.csrfToken;
        return this.csrfToken;
      })
      .finally(() => {
        this.csrfPromise = null;
      });

    return this.csrfPromise;
  }

  async requestHeaders({ csrf = false } = {}) {
    const headers = this.baseHeaders;
    if (csrf) headers['X-CSRF-Token'] = await this.fetchCsrfToken();
    return headers;
  }

  async get(path, options = {}) {
    const makeRequest = async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: await this.requestHeaders(),
        credentials: 'include',
      });

      // Handle token expiration with auto-refresh
      if (res.status === 401 && !options.skipRefresh && this.refreshToken) {
        await this.refreshAccessToken();
        // Retry with new token
        const retryRes = await fetch(`${API_BASE}${path}`, {
          headers: await this.requestHeaders(),
          credentials: 'include',
        });
        if (retryRes.status === 401) {
          this.clearAllTokens();
          useStore.getState().logout();
          throw new ApiError('Session expired. Please log in again.', 401);
        }
        if (!retryRes.ok) throw new ApiError(await readError(retryRes), retryRes.status);
        return retryRes.json();
      }

      if (res.status === 401) {
        this.clearAllTokens();
        useStore.getState().logout();
        throw new ApiError('Authentication required', 401);
      }

      if (!res.ok) throw new ApiError(await readError(res), res.status);
      return res.json();
    };

    return makeRequest();
  }

  async post(path, body, options = {}) {
    const makeRequest = async () => {
      const headers = await this.requestHeaders({ csrf: !options.skipCsrf });
      if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });

      // Handle token expiration with auto-refresh
      if (res.status === 401 && !options.skipRefresh && this.refreshToken) {
        await this.refreshAccessToken();
        // Retry with new token
        const retryHeaders = await this.requestHeaders({ csrf: !options.skipCsrf });
        if (options.idempotencyKey) retryHeaders['Idempotency-Key'] = options.idempotencyKey;

        const retryRes = await fetch(`${API_BASE}${path}`, {
          method: 'POST',
          headers: retryHeaders,
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (retryRes.status === 401) {
          this.clearAllTokens();
          useStore.getState().logout();
          throw new ApiError('Session expired. Please log in again.', 401);
        }
        if (retryRes.status === 403) this.csrfToken = null;
        if (!retryRes.ok) throw new ApiError(await readError(retryRes), retryRes.status);
        return retryRes.json();
      }

      if (res.status === 401) {
        this.clearAllTokens();
        useStore.getState().logout();
        throw new ApiError('Authentication required', 401);
      }

      if (res.status === 403) this.csrfToken = null;
      if (!res.ok) throw new ApiError(await readError(res), res.status);
      return res.json();
    };

    return makeRequest();
  }

  /** Check backend health */
  async health() {
    return this.get('/health');
  }

  /** Get runtime diagnostics for the model gateway */
  async runtimeDiagnostics() {
    return this.get('/api/runtime/diagnostics');
  }

  /** Get the live skill graph and routing topology */
  async runtimeSkills() {
    return this.get('/api/runtime/skills');
  }

  /** Get current user profile */
  async me() {
    return this.get('/api/me');
  }

  /** Get Google OAuth URL */
  getGoogleAuthUrl() {
    return `${API_BASE}/api/auth/google`;
  }

  /** Get Google Config */
  async getGoogleConfig() {
    return this.get('/api/auth/config');
  }

  /** Verify Google Token (Popup/One-Tap) */
  async verifyGoogleToken(token) {
    return this.post('/api/auth/google/verify-token', { token });
  }

  // --- REPOSITORY MANAGEMENT (V6) ---
  async linkRepo(url) {
    return this.post('/api/v6/repos/link', { url });
  }

  async listRepos() {
    return this.get('/api/v6/repos/list');
  }

  // --- MCP ORCHESTRATION (V6) ---
  async listMcpTools() {
    return this.get('/api/v6/mcp/tools');
  }

  async listMcpServers() {
    return this.get('/api/v6/mcp/servers');
  }

  async callMcpTool(toolId, args) {
    return this.post('/api/v6/mcp/call', { toolId, arguments: args });
  }

  // --- CHAT HISTORY (V6) ---
  async getChatSessions() {
    return this.get('/api/v6/chat/sessions');
  }

  async createChatSession(title) {
    return this.post('/api/v6/chat/sessions', { title });
  }

  async getChatMessages(sessionId) {
    return this.get(`/api/v6/chat/sessions/${sessionId}/messages`);
  }

  async addChatMessage(sessionId, role, content, thoughts = []) {
    return this.post(`/api/v6/chat/sessions/${sessionId}/messages`, { role, content, thoughts });
  }

  /** Get GitHub OAuth URL */
  getGithubAuthUrl() {
    return `${API_BASE}/api/auth/github`;
  }

  // --- SAAS-GRADE AUTH MANAGEMENT ---

  /** Logout current session */
  async logout() {
    try {
      await this.post('/api/auth/logout', {}, { skipCsrf: true });
    } finally {
      this.clearAllTokens();
    }
  }

  /** Logout all sessions */
  async logoutAll() {
    try {
      await this.post('/api/auth/logout-all', {}, { skipCsrf: true });
    } finally {
      this.clearAllTokens();
    }
  }

  /** Get list of active sessions */
  async getSessions() {
    return this.get('/api/auth/sessions');
  }

  /** Revoke a specific session */
  async revokeSession(sessionId) {
    return this.post(`/api/auth/sessions/${sessionId}/revoke`, {});
  }

  /** Get login audit history */
  async getAuthHistory(limit = 50) {
    return this.get(`/api/auth/history?limit=${limit}`);
  }

  /** Validate session token */
  async validateSession(sessionToken) {
    return this.post('/api/auth/validate-session', { sessionToken }, { skipCsrf: true, skipRefresh: true });
  }
}

export const api = new ApiClient();
export default ApiClient;
