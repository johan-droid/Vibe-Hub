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

  async search({ collection = 'default', vector = [], limit = 5, filter = null } = {}) {
    enforceTenantFilter(filter);
    const existing = [...(this.collections.get(collection)?.values() || [])];
    return existing
      .filter(point => payloadMatchesFilter(point.payload, filter))
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
    enforceTenantFilter(filter);
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

export function buildVectorCollectionName({
  tenantId = 'shared',
  namespace = 'default',
  projectName = 'default',
  indexVersion = 'live',
} = {}) {
  return [tenantId, namespace, projectName, indexVersion]
    .map(normalizeCollectionPart)
    .join('__');
}

export class TenantIsolationError extends Error {
  constructor(message = 'Vector search requires a tenant_id filter at the storage driver boundary.') {
    super(message);
    this.name = 'TenantIsolationError';
    this.code = 'TENANT_FILTER_REQUIRED';
  }
}

export function enforceTenantFilter(filter = null) {
  const tenantCondition = findTenantFilterCondition(filter);
  const tenantId = tenantCondition?.match?.value;
  if (!tenantId || typeof tenantId !== 'string') {
    throw new TenantIsolationError();
  }
  return tenantId;
}

function normalizeCollectionPart(value) {
  return String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'default';
}

function payloadMatchesFilter(payload = {}, filter = null) {
  if (!filter?.must?.length) return true;

  return filter.must.every(condition => {
    if (!condition?.key || !condition?.match) return true;
    return payload[condition.key] === condition.match.value;
  });
}

function findTenantFilterCondition(filter = null) {
  const clauses = Array.isArray(filter?.must) ? filter.must : [];
  return clauses.find(condition => condition?.key === 'tenant_id' && condition?.match);
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
