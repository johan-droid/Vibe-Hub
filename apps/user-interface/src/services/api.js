import { useStore } from '../store/useStore';

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (import.meta.env.PROD) return configured || `http://${window.location.hostname}:3001`;

  if (!configured) return `http://${window.location.hostname}:3001`;

  try {
    const configuredUrl = new URL(configured);
    if (isLoopbackHost(configuredUrl.hostname) && isLoopbackHost(window.location.hostname)) {
      configuredUrl.hostname = window.location.hostname;
      return configuredUrl.origin;
    }
    return configuredUrl.origin;
  } catch {
    return `http://${window.location.hostname}:3001`;
  }
}

const API_BASE = resolveApiBase();

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
    this.accessToken = null;
    this.csrfToken = null;
    this.csrfPromise = null;
    this.refreshPromise = null;
    this.googleConfigPromise = null;
  }

  getToken() {
    return null;
  }

  hasToken() {
    return Boolean(this.getToken());
  }

  setToken(token) {
    // Legacy support
    this.setAccessToken(token);
  }

  setAccessToken(token, { persist = true } = {}) {
    this.accessToken = persist ? null : token || null;
  }

  setRefreshToken(token) {
    this.refreshToken = null;
  }

  setSessionToken(token) {
    this.sessionToken = null;
  }

  setAuthTokens({ accessToken, refreshToken, sessionToken }) {
    this.setAccessToken(accessToken || null);
    this.setRefreshToken(refreshToken || null);
    this.setSessionToken(sessionToken || null);
  }

  clearToken() {
    this.clearAllTokens();
  }

  clearAllTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.sessionToken = null;
    localStorage.removeItem('selina_access_token');
    localStorage.removeItem('selina_refresh_token');
    localStorage.removeItem('selina_session_token');
    localStorage.removeItem('selina_token');
  }

  get baseHeaders() {
    return { 'Content-Type': 'application/json' };
  }

  /**
   * Attempt to refresh the access token using refresh token
   */
  async refreshAccessToken({ suppressLogout = false } = {}) {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          throw new ApiError(await readError(res), res.status);
        }

        const data = await res.json();
        if (data.success) {
          return true;
        }
        throw new Error('Invalid refresh response');
      } catch (err) {
        const shouldLogout = !suppressLogout && (
          (err instanceof ApiError && err.status === 401)
          || err?.message === 'Invalid refresh response'
        );

        if (shouldLogout) {
          this.clearAllTokens();
          useStore.getState().logout();
        }
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
      if (res.status === 401 && !options.skipRefresh) {
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
      if (res.status === 401 && !options.skipRefresh) {
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

  /** Get public Selina runtime brand metadata */
  async runtimeBrand() {
    return this.get('/api/runtime/brand');
  }

  /** Get current user profile */
  async me() {
    return this.get('/api/me');
  }

  /** Probe current auth state without causing an expected 401 on app startup */
  async authStatus({ attemptRefresh = false } = {}) {
    const fetchStatus = async () => {
      const res = await fetch(`${API_BASE}/api/auth/status`, {
        headers: await this.requestHeaders(),
        credentials: 'include',
      });

      if (res.status === 401) {
        return {
          success: true,
          authenticated: false,
          user: null,
          sessionId: null,
        };
      }

      if (!res.ok) {
        throw new ApiError(await readError(res), res.status);
      }

      return res.json();
    };

    const status = await fetchStatus();
    if (status.authenticated || !attemptRefresh) {
      return status;
    }

    try {
      await this.refreshAccessToken({ suppressLogout: true });
    } catch {
      return status;
    }

    return fetchStatus();
  }

  async resolveSession() {
    return this.authStatus({ attemptRefresh: true });
  }

  /** Exchange opaque OAuth callback code for HTTP-only cookies on the API host */
  async exchangeOAuthHandoff(code) {
    return this.post('/api/auth/handoff', { code }, { skipCsrf: true, skipRefresh: true });
  }

  /** Get Google OAuth URL */
  getGoogleAuthUrl() {
    const url = new URL(`${API_BASE}/api/auth/google`);
    url.searchParams.set('returnOrigin', window.location.origin);
    return url.toString();
  }

  /** Get Google Config */
  async getGoogleConfig() {
    if (!this.googleConfigPromise) {
      this.googleConfigPromise = this.get('/api/auth/config');
    }
    return this.googleConfigPromise;
  }

  /** Verify Google Token (Popup/One-Tap) */
  async verifyGoogleToken(tokenOrPayload) {
    const body = typeof tokenOrPayload === 'object' && tokenOrPayload !== null
      ? {
          credential: tokenOrPayload.credential,
          access_token: tokenOrPayload.accessToken || tokenOrPayload.access_token,
        }
      : { credential: tokenOrPayload };

    return this.post('/api/auth/google/verify-token', body, { skipCsrf: true });
  }

  // --- REPOSITORY MANAGEMENT (V6) ---
  async linkRepo(url) {
    return this.post('/api/v6/repos/link', { url });
  }

  async listRepos() {
    return this.get('/api/v6/repos/list');
  }

  async harnessContent(payload) {
    return this.post('/api/v6/content/harness', payload);
  }

  // --- MCP ORCHESTRATION (V6) ---
  async listMcpTools() {
    return this.get('/api/v6/mcp/tools');
  }

  async listMcpServers() {
    return this.get('/api/v6/mcp/servers');
  }

  async mcpDiagnostics() {
    return this.get('/api/v6/mcp/diagnostics');
  }

  async registerMcpServer(name, command, args = []) {
    return this.post('/api/v6/mcp/register', { name, command, args });
  }

  async callMcpTool(toolId, args) {
    return this.post('/api/v6/mcp/call', { toolId, arguments: args });
  }

  async runtimeExperts() {
    return this.get('/api/v6/runtime/experts');
  }

  async getRun(runId) {
    return this.get(`/api/v6/orchestrator/runs/${encodeURIComponent(runId)}`);
  }

  async getRunEvents(runId) {
    return this.get(`/api/v6/orchestrator/runs/${encodeURIComponent(runId)}/events`);
  }

  async getRunArtifacts(runId) {
    return this.get(`/api/v6/orchestrator/runs/${encodeURIComponent(runId)}/artifacts`);
  }

  async createApprovalGrant({ runId, toolName, paramsHash, decision, reason }) {
    return this.post('/api/v6/approvals/grants', { runId, toolName, paramsHash, decision, reason });
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

  // --- USER PREFERENCES (V6) ---
  async getPreferences() {
    return this.get('/api/v6/preferences');
  }

  async updatePreference(preferenceType, content) {
    return this.post('/api/v6/preferences', { preferenceType, content });
  }

  async bulkUpdatePreferences(preferences) {
    return this.post('/api/v6/preferences/bulk', { preferences });
  }

  /** Get GitHub OAuth URL */
  getGithubAuthUrl() {
    const url = new URL(`${API_BASE}/api/auth/github`);
    url.searchParams.set('returnOrigin', window.location.origin);
    return url.toString();
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
