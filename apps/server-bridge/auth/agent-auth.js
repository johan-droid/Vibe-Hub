const PROVIDER_CREDENTIALS = Object.freeze({
  gemini: ['GEMINI_API_KEY', 'LLM_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  qwen: ['QWEN_API_KEY'],
  nim: ['NIM_API_KEY', 'NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  ui_variant: ['UI_VARIANT_API_KEY', 'OPENAI_API_KEY'],
});

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

function cloneSnapshot(snapshot) {
  return globalThis.structuredClone
    ? structuredClone(snapshot)
    : JSON.parse(JSON.stringify(snapshot));
}

function decodeJwtExpiry(accessToken) {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return Date.now() + 15 * 60_000;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return parsed.exp ? parsed.exp * 1000 : Date.now() + 15 * 60_000;
  } catch {
    return Date.now() + 15 * 60_000;
  }
}

function normalizeProvider(provider) {
  return String(provider || '').toLowerCase();
}

export class AgentAuthManager {
  constructor({
    env = process.env,
    forcedLoginMethod = env.SELINA_FORCED_LOGIN_METHOD || null,
    refreshOAuth,
  } = {}) {
    this.env = env;
    this.forcedLoginMethod = forcedLoginMethod;
    this.refreshOAuth = refreshOAuth;
    this.state = new Map();
    this.refreshPromises = new Map();
    this.listeners = new Set();
    this.loadFromEnv(env);
  }

  loadFromEnv(env = this.env) {
    for (const [provider, envNames] of Object.entries(PROVIDER_CREDENTIALS)) {
      const value = envNames.map(name => env[name]).find(Boolean);
      if (value) this.loadApiKey(provider, value);
    }
  }

  loadApiKey(provider, value) {
    if (!value) return;
    this.setSnapshot(provider, {
      type: 'api-key',
      value,
      expiresAt: null,
    });
  }

  loadOAuth(provider, { accessToken, refreshToken, expiresAt }) {
    if (!accessToken || !refreshToken) {
      throw new AuthError('OAuth credentials require accessToken and refreshToken.');
    }
    this.setSnapshot(provider, {
      type: 'oauth',
      accessToken,
      refreshToken,
      expiresAt: expiresAt || decodeJwtExpiry(accessToken),
    });
  }

  setSnapshot(provider, snapshot) {
    this.enforceRestrictions(snapshot);
    this.state.set(normalizeProvider(provider), snapshot);
    this.notifyListeners();
  }

  enforceRestrictions(snapshot) {
    if (this.forcedLoginMethod && snapshot.type !== this.forcedLoginMethod) {
      throw new AuthError(`login method must be ${this.forcedLoginMethod}`);
    }
  }

  hasProvider(provider) {
    return this.state.has(normalizeProvider(provider));
  }

  hasAnyProvider(providers = Object.keys(PROVIDER_CREDENTIALS)) {
    return providers.some(provider => this.hasProvider(provider));
  }

  peek(provider) {
    const snapshot = this.state.get(normalizeProvider(provider));
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  getBearerToken(provider) {
    const snapshot = this.state.get(normalizeProvider(provider));
    if (!snapshot) return null;
    return snapshot.type === 'api-key' ? snapshot.value : snapshot.accessToken;
  }

  async auth(provider) {
    const normalized = normalizeProvider(provider);
    await this.ensureFresh(normalized);
    const snapshot = this.state.get(normalized);
    if (!snapshot) throw new AuthError(`${normalized || 'provider'} is not authenticated`);
    return cloneSnapshot(snapshot);
  }

  async ensureFresh(provider) {
    const snapshot = this.state.get(normalizeProvider(provider));
    if (!snapshot || snapshot.type === 'api-key') return;

    const bufferMs = 60_000;
    if (Date.now() < snapshot.expiresAt - bufferMs) return;
    await this.forceRefresh(provider);
  }

  async forceRefresh(provider) {
    const normalized = normalizeProvider(provider);
    const snapshot = this.state.get(normalized);
    if (!snapshot || snapshot.type !== 'oauth') {
      throw new AuthError(`${normalized || 'provider'} credentials cannot be refreshed`);
    }

    if (this.refreshPromises.has(normalized)) return this.refreshPromises.get(normalized);

    const refreshPromise = this.doRefresh(normalized, snapshot)
      .finally(() => this.refreshPromises.delete(normalized));
    this.refreshPromises.set(normalized, refreshPromise);
    return refreshPromise;
  }

  async doRefresh(provider, snapshot) {
    if (!this.refreshOAuth) {
      this.state.delete(provider);
      this.notifyListeners();
      throw new AuthError('token refresh failed - no refresh handler configured');
    }

    const updated = await this.refreshOAuth(provider, cloneSnapshot(snapshot));
    this.loadOAuth(provider, {
      accessToken: updated.accessToken,
      refreshToken: updated.refreshToken || snapshot.refreshToken,
      expiresAt: updated.expiresAt || Date.now() + Number(updated.expiresIn || 900) * 1000,
    });
  }

  onAuthChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    for (const listener of this.listeners) listener();
  }
}

export async function callWithAuthRetry(authManager, provider, fn) {
  let sawUnauthorized = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const auth = await authManager.auth(provider);
    const response = await fn(auth, attempt);
    if (response.status !== 401) return response;

    if (sawUnauthorized) break;
    sawUnauthorized = true;

    try {
      await authManager.forceRefresh(provider);
    } catch {
      throw new AuthError('session expired - please re-authenticate');
    }
  }

  throw new AuthError('authentication failed after refresh');
}

export function authToken(authSnapshot) {
  if (!authSnapshot) return null;
  return authSnapshot.type === 'api-key' ? authSnapshot.value : authSnapshot.accessToken;
}

export const agentAuthManager = new AgentAuthManager();
