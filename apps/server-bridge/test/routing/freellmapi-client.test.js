import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { callFreeLLMAPI } from '../../orchestrator/routing/freellmapi-client.js';

describe('FreeLLMAPI Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FREELLMAPI_API_KEY = 'test-key';

    global.fetch = vi.fn();

    // Polyfill AbortController for Node 14 if needed, but modern Node has it
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should normalize URL missing /v1', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://freellmapi-test.onrender.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('should normalize URL with /v1', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://freellmapi-test.onrender.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('should avoid producing /v1/v1/chat/completions', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1/chat/completions';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://freellmapi-test.onrender.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('should send Authorization header', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    const options = global.fetch.mock.calls[0][1];
    expect(options.headers['Authorization']).toBe('Bearer test-key');
  });

  it('should use default model auto', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('auto');
  });

  it('should respect SELINA_FORCE_MODEL', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1';
    process.env.SELINA_FORCE_MODEL = 'forced-model';
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: new Headers()
    });

    await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('forced-model');
  });

  it('should parse x-routed-via and x-fallback-attempts headers', async () => {
    process.env.FREELLMAPI_BASE_URL = 'https://freellmapi-test.onrender.com/v1';
    const mockHeaders = new Headers();
    mockHeaders.set('x-routed-via', 'openai/gpt-4o');
    mockHeaders.set('x-fallback-attempts', '2');

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      headers: mockHeaders
    });

    const result = await callFreeLLMAPI({
      capability: 'fast',
      messages: [],
      profile: { timeoutMs: 1000, temperature: 0.5, maxTokens: 100 }
    });

    expect(result.routedVia).toBe('openai/gpt-4o');
    expect(result.fallbackAttempts).toBe(2);
  });
});
