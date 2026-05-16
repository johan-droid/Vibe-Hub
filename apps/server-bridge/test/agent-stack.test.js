import { describe, expect, it, vi } from 'vitest';
import { listAgentCapabilities } from '../agent-stack/capability-manifest.js';
import { createMemoryProvider, Mem0MemoryProvider } from '../memory/memory-provider.js';
import { createVectorStore, QdrantVectorStore } from '../memory/vector-store.js';

describe('agent stack capability manifest', () => {
  it('documents the external stack as adapter-backed capabilities', () => {
    const manifest = listAgentCapabilities();

    expect(manifest.frontend.target).toBe('nextjs');
    expect(manifest.backend.target).toEqual(['fastapi', 'langgraph']);
    expect(manifest.agentRuntime.target).toEqual(['autogen', 'openhands-concepts']);
    expect(manifest.execution.active).toEqual(['docker-local', 'e2b-vibekit']);
    expect(manifest.retrieval).toMatchObject({ active: ['tree-sitter'], optional: ['qdrant'] });
    expect(manifest.verification.active).toEqual(['pytest', 'semgrep', 'ruff']);
    expect(manifest.memory.optional).toEqual(['mem0']);
  });
});

describe('Qdrant vector store seam', () => {
  it('keeps an in-memory vector store available by default', async () => {
    const store = createVectorStore();
    await store.upsert({
      collection: 'code',
      points: [{ id: 'a', vector: [1, 0], payload: { file: 'a.js' } }],
    });

    const results = await store.search({ collection: 'code', vector: [1, 0], limit: 1 });

    expect(results[0]).toMatchObject({ id: 'a', payload: { file: 'a.js' } });
    expect(results[0].score).toBeGreaterThan(0.99);
  });

  it('calls Qdrant using explicit URL and API key when configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: [{ id: 'point-1', score: 0.9 }] }),
    }));
    const store = new QdrantVectorStore({
      url: 'https://qdrant.example.com',
      apiKey: 'qdrant-key',
      fetchImpl,
    });

    const results = await store.search({ collection: 'code', vector: [1, 2, 3], limit: 1 });

    expect(results).toEqual([{ id: 'point-1', score: 0.9 }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://qdrant.example.com/collections/code/points/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'qdrant-key' }),
      })
    );
  });
});

describe('Mem0 memory provider seam', () => {
  it('keeps local memory available by default', async () => {
    const memory = createMemoryProvider();
    await memory.add({
      userId: 'u1',
      projectName: 'p1',
      messages: [{ role: 'user', content: 'Remember Qdrant setup' }],
    });

    const results = await memory.search({ userId: 'u1', projectName: 'p1', query: 'Qdrant' });

    expect(results).toHaveLength(1);
    expect(results[0].messages[0].content).toContain('Qdrant');
  });

  it('calls Mem0 with scoped user and project metadata when configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'mem-1' }),
    }));
    const memory = new Mem0MemoryProvider({
      apiKey: 'mem0-key',
      baseUrl: 'https://mem0.example.com/v1',
      fetchImpl,
    });

    const result = await memory.add({
      userId: 'u1',
      projectName: 'p1',
      messages: [{ role: 'user', content: 'Remember this' }],
    });

    expect(result).toEqual({ id: 'mem-1' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://mem0.example.com/v1/memories/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Token mem0-key' }),
      })
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      user_id: 'u1',
      metadata: { projectName: 'p1' },
    });
  });
});
