const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD
  ? 'https://vibe-hub-bridge.onrender.com'
  : '');

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

  get headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers });
    if (res.status === 401) this.clearToken();
    if (!res.ok) throw new Error(await readError(res));
    return res.json();
  }

  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (res.status === 401) this.clearToken();
    if (!res.ok) throw new Error(await readError(res));
    return res.json();
  }

  /** Check backend health */
  async health() {
    return this.get('/health');
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
