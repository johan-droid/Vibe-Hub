import { useStore } from '../store/useStore';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD
  ? 'https://vibe-hub-bridge.onrender.com'
  : '');

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
    this.token = localStorage.getItem('selina_token') || null;
    this.csrfToken = null;
    this.csrfPromise = null;
  }

  getToken() {
    this.token = localStorage.getItem('selina_token') || this.token;
    return this.token;
  }

  hasToken() {
    return Boolean(this.getToken());
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('selina_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('selina_token');
  }

  get baseHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
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

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: await this.requestHeaders(),
      credentials: 'include',
    });
    if (res.status === 401) {
      this.clearToken();
      useStore.getState().logout();
    }
    if (!res.ok) throw new ApiError(await readError(res), res.status);
    return res.json();
  }

  async post(path, body, options = {}) {
    const headers = await this.requestHeaders({ csrf: true });
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      this.clearToken();
      useStore.getState().logout();
    }
    if (res.status === 403) this.csrfToken = null;
    if (!res.ok) throw new ApiError(await readError(res), res.status);
    return res.json();
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

  /** Get GitHub OAuth URL */
  getGithubAuthUrl() {
    return `${API_BASE}/api/auth/github`;
  }
}

export const api = new ApiClient();
