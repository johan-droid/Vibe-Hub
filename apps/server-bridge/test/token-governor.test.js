import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenGovernor, callRoutedTextModel } from '../orchestrator/token-governor.js';

const MANAGED_ENV_KEYS = [
  'GROQ_KEYS',
  'GROQ_API_KEY',
  'NVIDIA_NIM_KEYS',
  'NIM_API_KEY',
  'NVIDIA_NIM_API_KEY',
  'NVIDIA_API_KEY',
  'GEMINI_KEYS',
  'GEMINI_API_KEY'
];

const originalEnv = Object.fromEntries(MANAGED_ENV_KEYS.map(key => [key, process.env[key]]));

function resetManagedEnv() {
  for (const key of MANAGED_ENV_KEYS) {
    delete process.env[key];
  }
}

function restoreManagedEnv() {
  resetManagedEnv();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

describe('TokenGovernor', () => {
  beforeEach(() => {
    resetManagedEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreManagedEnv();
  });

  it('routes worker compute through the callback with Groq 70B', async () => {
    process.env.GROQ_KEYS = 'groq-key';
    const governor = new TokenGovernor();

    const result = await governor.getCompute('low', 'worker', async (key, model, provider) => ({
      key,
      model,
      provider
    }));

    expect(result).toEqual({
      key: 'groq-key',
      model: 'llama3-70b',
      provider: 'groq'
    });
  });

  it('rotates keys when the callback reports quota exhaustion', async () => {
    process.env.GROQ_KEYS = 'groq-key-1,groq-key-2';
    const governor = new TokenGovernor();
    const calls = [];

    const result = await governor.getCompute('low', 'validator', async (key) => {
      calls.push(key);
      if (key === 'groq-key-1') {
        const error = new Error('rate limited');
        error.status = 429;
        throw error;
      }
      return key;
    });

    expect(result).toBe('groq-key-2');
    expect(calls).toEqual(['groq-key-1', 'groq-key-2']);
  });

  it('falls back high-complexity planning to Gemini Pro when NIM is unavailable', async () => {
    process.env.GEMINI_KEYS = 'gemini-key';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const governor = new TokenGovernor();

    const result = await governor.getCompute('high', 'planner', async (key, model, provider) => ({
      key,
      model,
      provider
    }));

    expect(result).toEqual({
      key: 'gemini-key',
      model: 'gemini-1.5-pro',
      provider: 'gemini'
    });
    expect(warn).toHaveBeenCalledWith('[Governor] NIM compute unavailable, failing over to Gemini Pro 1.5');
  });

  it('requires callers to pass the routed API callback', async () => {
    const governor = new TokenGovernor();

    await expect(governor.getCompute('low', 'planner')).rejects.toThrow(
      'TokenGovernor.getCompute requires an API execution callback'
    );
  });
});

describe('routed structured output options', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('passes OpenAI-compatible JSON mode through response_format', async () => {
    let capturedBody = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
      };
    });

    const result = await callRoutedTextModel('key', 'llama3-70b', 'Return JSON.', 'Ping', {
      provider: 'groq',
      jsonMode: true,
    });

    expect(result).toBe('{"ok":true}');
    expect(capturedBody.response_format).toEqual({ type: 'json_object' });
  });

  it('passes Gemini JSON mode through responseMimeType', async () => {
    let capturedBody = null;
    globalThis.fetch = vi.fn(async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
      };
    });

    const result = await callRoutedTextModel('key', 'gemini-1.5-flash', 'Return JSON.', 'Ping', {
      provider: 'gemini',
      jsonMode: true,
    });

    expect(result).toBe('{"ok":true}');
    expect(capturedBody.generationConfig.responseMimeType).toBe('application/json');
  });
});
