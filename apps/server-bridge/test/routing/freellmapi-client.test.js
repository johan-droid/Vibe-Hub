import { describe, expect, it, afterEach, vi } from 'vitest';
import { callFreeLLMAPI } from '../../orchestrator/routing/freellmapi-client.js';

describe('freellmapi-client', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('builds URL correctly for https://freellmapi-uqzq.onrender.com/v1', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-uqzq.onrender.com/v1';
    process.env.FREELLMAPI_API_KEY = 'test-key';

    let capturedUrl = null;
    globalThis.fetch = vi.fn(async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ capability: 'test', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedUrl).toBe('https://freellmapi-uqzq.onrender.com/v1/chat/completions');
  });

  it('still calls model auto by default', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'key';

    let capturedBody = null;
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ capability: 'fast', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedBody.model).toBe('auto');
  });

  it('supports SELINA_FORCE_MODEL override', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'key';
    process.env.SELINA_FORCE_MODEL = 'forced-model';

    let capturedBody = null;
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ capability: 'fast', messages: [], profile: { timeoutMs: 1000 } });
    expect(capturedBody.model).toBe('forced-model');
  });

  it('uses per-capability max_tokens and temperature', async () => {
    process.env.FREELLMAPI_BASE_URL = 'http://api.com/v1';
    process.env.FREELLMAPI_API_KEY = 'key';

    let capturedBody = null;
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await callFreeLLMAPI({ capability: 'coding', messages: [], profile: { maxTokens: 4000, temperature: 0.15, timeoutMs: 1000 } });
    expect(capturedBody.max_tokens).toBe(4000);
    expect(capturedBody.temperature).toBe(0.15);
  });
});
