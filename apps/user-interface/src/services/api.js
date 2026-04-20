const API_BASE = import.meta.env.PROD
  ? 'https://vibe-hub-bridge.onrender.com'
  : '';

/**
 * Centralized API client for all REST calls to the backend.
 */
class ApiClient {
  constructor() {
    this.token = localStorage.getItem('vibe_token') || null;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('vibe_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('vibe_token');
  }

  get headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async get(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  }

  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
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
