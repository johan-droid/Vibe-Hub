import { afterEach, describe, expect, it, vi } from 'vitest';
import llmClient, { extractCodePayload } from '../orchestrator/llm_client.js';

describe('LLMClient Gemini prompting', () => {
  const originalFetch = globalThis.fetch;
  const originalAuthManager = llmClient.authManager;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    llmClient.authManager = originalAuthManager;
    vi.restoreAllMocks();
  });

  it('sends Gemini system instructions through the native systemInstruction field', async () => {
    let capturedUrl = null;
    let capturedBody = null;

    llmClient.authManager = {
      auth: vi.fn().mockResolvedValue({ type: 'api-key', value: 'gemini-test-key' }),
      forceRefresh: vi.fn(),
    };
    globalThis.fetch = vi.fn(async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'const ok = true;' }] } }],
          usageMetadata: { totalTokenCount: 12 },
        }),
      };
    });

    const result = await llmClient.callGemini({
      systemInstruction: 'Follow architecture rules.',
      userInstruction: 'Write the implementation.',
      endpoint: 'https://example.test/models/gemini:generateContent',
      model: 'gemini-test',
    });

    expect(result).toBe('const ok = true;');
    expect(capturedUrl).toBe('https://example.test/models/gemini:generateContent?key=gemini-test-key');
    expect(capturedBody.systemInstruction).toEqual({
      parts: [{ text: 'Follow architecture rules.' }],
    });
    expect(capturedBody.contents).toEqual([
      { role: 'user', parts: [{ text: 'Write the implementation.' }] },
    ]);
  });

  it('reuses Gemini cached content for stable system and AST context', async () => {
    const originalMin = process.env.SELINA_GEMINI_CACHE_MIN_TOKENS;
    const originalTtl = process.env.SELINA_GEMINI_CACHE_TTL_SECONDS;
    process.env.SELINA_GEMINI_CACHE_MIN_TOKENS = '1';
    process.env.SELINA_GEMINI_CACHE_TTL_SECONDS = '60';

    const bodies = [];
    llmClient.authManager = {
      auth: vi.fn().mockResolvedValue({ type: 'api-key', value: 'gemini-test-key' }),
      forceRefresh: vi.fn(),
    };
    globalThis.fetch = vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      bodies.push({ url, body });

      if (url.includes('/cachedContents?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: 'cachedContents/static-context-1', model: 'models/gemini-test' }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'const cached = true;' }] } }],
          usageMetadata: { totalTokenCount: 12 },
        }),
      };
    });

    try {
      const result = await llmClient.callGemini({
        systemInstruction: 'Stable system rules.',
        staticContext: 'Static AST context for Button.jsx with definitions.',
        userInstruction: 'Make the Button blue.',
        fallbackUserInstruction: 'Static AST context for Button.jsx with definitions.\n\nMake the Button blue.',
        endpoint: 'https://example.test/models/gemini:generateContent',
        model: 'gemini-test',
      });

      expect(result).toBe('const cached = true;');
      expect(bodies[0].body).toMatchObject({
        model: 'models/gemini-test',
        systemInstruction: { parts: [{ text: 'Stable system rules.' }] },
      });
      expect(bodies[1].body).toMatchObject({
        cachedContent: 'cachedContents/static-context-1',
        contents: [{ role: 'user', parts: [{ text: 'Make the Button blue.' }] }],
      });
      expect(bodies[1].body.systemInstruction).toBeUndefined();
    } finally {
      if (originalMin === undefined) delete process.env.SELINA_GEMINI_CACHE_MIN_TOKENS;
      else process.env.SELINA_GEMINI_CACHE_MIN_TOKENS = originalMin;
      if (originalTtl === undefined) delete process.env.SELINA_GEMINI_CACHE_TTL_SECONDS;
      else process.env.SELINA_GEMINI_CACHE_TTL_SECONDS = originalTtl;
    }
  });
});

describe('extractCodePayload', () => {
  it('extracts a complete fenced code payload with trailing whitespace', () => {
    expect(extractCodePayload('```javascript\nconst value = 1;\n```\n\n')).toBe('const value = 1;');
  });

  it('does not truncate when code contains an internal fence-like sequence', () => {
    const fenced = [
      '```javascript',
      'const doc = `example',
      '```',
      'still inside template`;',
      'console.log(doc);',
      '```',
      '',
    ].join('\n');

    expect(extractCodePayload(fenced)).toBe([
      'const doc = `example',
      '```',
      'still inside template`;',
      'console.log(doc);',
    ].join('\n'));
  });

  it('returns unfenced content trimmed but otherwise unchanged', () => {
    expect(extractCodePayload('\nconst direct = true;\n')).toBe('const direct = true;');
  });
});
