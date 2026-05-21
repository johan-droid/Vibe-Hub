import logger from '../utils/detailed-logger.js';

function csv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export class EnvSecretProvider {
  constructor(env = process.env) {
    this.env = env;
  }

  async getSecret(name) {
    return this.env[name] || null;
  }
}

export class VaultSecretProvider {
  constructor(env = process.env) {
    this.env = env;
    this.addr = env.VAULT_ADDR || '';
    this.token = env.VAULT_TOKEN || '';
    this.namespace = env.VAULT_NAMESPACE || '';
    this.mount = env.VAULT_KV_MOUNT || 'secret';
    this.prefix = env.VAULT_SECRET_PREFIX || 'selina';
    this.cache = new Map();
    this.cacheTtlMs = Number.parseInt(env.VAULT_SECRET_CACHE_TTL_MS || '300000', 10);
  }

  enabled() {
    return Boolean(this.addr && this.token);
  }

  async getSecret(name) {
    if (!this.enabled()) return null;
    const now = Date.now();
    const cached = this.cache.get(name);
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) return cached.value;

    const value = await this.fetchSecret(name);
    this.cache.set(name, { value, fetchedAt: now });
    return value;
  }

  async fetchSecret(name) {
    const path = `${this.prefix}/${name}`.replace(/^\/+/, '');
    const url = new URL(`/v1/${this.mount}/data/${path}`, this.addr);
    const headers = {
      accept: 'application/json',
      'x-vault-token': this.token,
    };
    if (this.namespace) headers['x-vault-namespace'] = this.namespace;

    const response = await fetch(url, { headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Vault secret ${name} fetch failed with HTTP ${response.status}`);
    }

    const body = await response.json();
    const data = body?.data?.data || body?.data || {};
    return data[name] || data.value || null;
  }
}

export function createSecretProvider(env = process.env) {
  const providers = csv(env.SELINA_SECRET_PROVIDER || env.SECRET_PROVIDER || 'env');
  const chain = providers.map(provider => provider.toLowerCase());
  const envProvider = new EnvSecretProvider(env);
  const vaultProvider = new VaultSecretProvider(env);

  return {
    async getSecret(name) {
      for (const provider of chain) {
        try {
          if (provider === 'vault') {
            const value = await vaultProvider.getSecret(name);
            if (value) return value;
          }
          if (provider === 'env') {
            const value = await envProvider.getSecret(name);
            if (value) return value;
          }
        } catch (error) {
          logger.warn('Secrets', `Secret provider ${provider} failed for ${name}`, { error: error.message });
        }
      }
      return null;
    },
    async getFirstAvailable(names = []) {
      for (const name of names) {
        const value = await this.getSecret(name);
        if (value) return { name, value };
      }
      return null;
    },
  };
}
