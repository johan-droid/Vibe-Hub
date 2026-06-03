import { describe, expect, it, afterEach, vi } from 'vitest';
import { callFreeLLMAPI } from '../../orchestrator/routing/freellmapi-client.js';

describe('freellmapi-client', () => {
  it('builds URL correctly for https://freellmapi-uqzq.onrender.com/v1', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-uqzq.onrender.com/v1';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('https://freellmapi-uqzq.onrender.com/v1/chat/completions');
  });

  it('builds URL correctly for https://freellmapi-uqzq.onrender.com', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-uqzq.onrender.com';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('https://freellmapi-uqzq.onrender.com/v1/chat/completions');
  });

  it('builds URL correctly for https://freellmapi-uqzq.onrender.com/v1/chat/completions', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-uqzq.onrender.com/v1/chat/completions';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('https://freellmapi-uqzq.onrender.com/v1/chat/completions');
  });

  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('builds URL correctly for http://localhost:3001', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://localhost:3001';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ choices: [{ message: { content: 'ok' } }] })
      };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('http://localhost:3001/v1/chat/completions');
  });

  it('builds URL correctly for http://localhost:3001/v1', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://localhost:3001/v1';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('http://localhost:3001/v1/chat/completions');
  });

  it('sends Authorization Bearer header', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'secret-key';

    let capturedHeaders = null;
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedHeaders = options.headers;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedHeaders.Authorization).toBe('Bearer secret-key');
  });

  it('parses x-routed-via and x-fallback-attempts', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'key';

    globalThis.fetch = vi.fn(async () => {
      const headers = new Headers();
      headers.set('x-routed-via', 'openai');
      headers.set('x-fallback-attempts', '2');
      return {
        ok: true,
        status: 200,
        headers,
        json: async () => ({ choices: [{ message: { content: 'hello' } }] })
      };
    });

    const result = await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(result.routedVia).toBe('openai');
    expect(result.fallbackAttempts).toBe(2);
  });

  it('non-OK response throws sanitized error', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'key';

    globalThis.fetch = vi.fn(async () => {
      const headers = new Headers();
      headers.set('x-routed-via', 'groq');
      return {
        ok: false,
        status: 429,
        headers,
        text: async () => 'Rate limited'
      };
    });

    try {
      await callFreeLLMAPI({ mode: 'test', messages: [], profile: { timeoutMs: 1000 } });
      expect.unreachable();
    } catch (error) {
      expect(error.message).toContain('FreeLLMAPI error 429');
      expect(error.status).toBe(429);
      expect(error.routedVia).toBe('groq');
      // Secret should not be in the message
      expect(error.message).not.toContain('key');
    }
  });
});
