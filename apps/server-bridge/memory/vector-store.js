export class InMemoryVectorStore {
  constructor() {
    this.collections = new Map();
  }

  async upsert({ collection = 'default', points = [] } = {}) {
    const existing = this.collections.get(collection) || new Map();
    for (const point of points) {
      existing.set(point.id, {
        id: point.id,
        vector: point.vector || [],
        payload: point.payload || {},
      });
    }
    this.collections.set(collection, existing);
    return { success: true, provider: 'memory', upserted: points.length };
  }

  async search({ collection = 'default', vector = [], limit = 5 } = {}) {
    const existing = [...(this.collections.get(collection)?.values() || [])];
    return existing
      .map(point => ({
        ...point,
        score: cosineSimilarity(vector, point.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export class QdrantVectorStore {
  constructor({ url = process.env.QDRANT_URL, apiKey = process.env.QDRANT_API_KEY, fetchImpl = globalThis.fetch } = {}) {
    this.url = String(url || '').replace(/\/$/, '');
    this.apiKey = apiKey || null;
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.url);
  }

  async upsert({ collection = 'default', points = [] } = {}) {
    this.assertConfigured();
    const response = await this.request(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    });
    return { success: true, provider: 'qdrant', response };
  }

  async search({ collection = 'default', vector = [], limit = 5, filter = null } = {}) {
    this.assertConfigured();
    const response = await this.request(`/collections/${encodeURIComponent(collection)}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        vector,
        limit,
        ...(filter ? { filter } : {}),
        with_payload: true,
      }),
    });
    return response.result || [];
  }

  async request(route, options = {}) {
    const response = await this.fetchImpl(`${this.url}${route}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`Qdrant request failed with ${response.status}: ${data?.status?.error || text}`);
    }
    return data;
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error('Qdrant vector store requires QDRANT_URL.');
    }
  }
}

export function createVectorStore({ provider = process.env.SELINA_VECTOR_STORE || 'memory', ...options } = {}) {
  const normalized = String(provider || 'memory').toLowerCase();
  if (normalized === 'qdrant') return new QdrantVectorStore(options);
  return new InMemoryVectorStore();
}

function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
