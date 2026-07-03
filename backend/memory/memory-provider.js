export class LocalMemoryProvider {
  constructor() {
    this.items = new Map();
  }

  async add({ userId = 'anonymous', projectName = 'default', messages = [], metadata = {} } = {}) {
    const key = memoryKey(userId, projectName);
    const existing = this.items.get(key) || [];
    const entry = {
      id: `${key}:${existing.length + 1}`,
      messages,
      metadata,
      createdAt: new Date().toISOString(),
    };
    existing.push(entry);
    this.items.set(key, existing);
    return { success: true, provider: 'local', id: entry.id };
  }

  async search({ userId = 'anonymous', projectName = 'default', query = '', limit = 5 } = {}) {
    const key = memoryKey(userId, projectName);
    const all = this.items.get(key) || [];
    const q = String(query || '').toLowerCase();
    return all
      .filter(item => JSON.stringify(item).toLowerCase().includes(q))
      .slice(-limit)
      .reverse();
  }
}

export class Mem0MemoryProvider {
  constructor({ apiKey = process.env.MEM0_API_KEY, baseUrl = process.env.MEM0_BASE_URL || 'https://api.mem0.ai/v1', fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = apiKey || null;
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async add({ userId = 'anonymous', projectName = 'default', messages = [], metadata = {} } = {}) {
    this.assertConfigured();
    return this.request('/memories/', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        messages,
        metadata: { projectName, ...metadata },
      }),
    });
  }

  async search({ userId = 'anonymous', projectName = 'default', query = '', limit = 5 } = {}) {
    this.assertConfigured();
    return this.request('/memories/search/', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        query,
        limit,
        filters: { projectName },
      }),
    });
  }

  async request(route, options = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${route}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`Mem0 request failed with ${response.status}: ${data?.error || text}`);
    }
    return data;
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error('Mem0 memory provider requires MEM0_API_KEY.');
    }
  }
}

export function createMemoryProvider({ provider = process.env.SELINA_MEMORY_PROVIDER || 'local', ...options } = {}) {
  const normalized = String(provider || 'local').toLowerCase();
  if (normalized === 'mem0') return new Mem0MemoryProvider(options);
  return new LocalMemoryProvider();
}

function memoryKey(userId, projectName) {
  return `${userId}:${projectName}`;
}
