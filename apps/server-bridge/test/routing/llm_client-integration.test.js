import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

// 1. Mock cache so we don't accidentally cache real answers that mess up other tests
vi.mock('../../utils/cache.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withJsonCache: vi.fn(async (key, ttl, fn) => {
      // Just run it and return the value directly to bypass Redis/local cache
      const value = await fn();
      return { value, isCached: false };
    })
  };
});

vi.mock('../../orchestrator/routing/selina-router.js', () => ({
  chooseModeFromTask: vi.fn().mockReturnValue('fast'),
  callSelinaLLM: vi.fn()
}));

import llmClient from '../../orchestrator/llm_client.js';
import { extractCodePayload } from '../../orchestrator/llm_client.js'; // test it indirectly or directly

describe('llm_client routing integration', () => {
  const originalFetch = globalThis.fetch;
  const originalGateway = llmClient.gateway;
  const originalHasFreeLLMAPIConfig = llmClient.hasFreeLLMAPIConfig;
  const originalGenerateViaFreeLLMAPI = llmClient.generateViaFreeLLMAPI;
  const originalGenerateWithFallback = llmClient.generateWithFallback;
  const originalHasAnyProvider = llmClient.authManager.hasAnyProvider;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    llmClient.gateway = originalGateway;
    llmClient.hasFreeLLMAPIConfig = originalHasFreeLLMAPIConfig;
    llmClient.generateViaFreeLLMAPI = originalGenerateViaFreeLLMAPI;
    llmClient.generateWithFallback = originalGenerateWithFallback;
    llmClient.authManager.hasAnyProvider = originalHasAnyProvider;
  });

  const orgCtx = { enforced_rules: { deployment_target: 'render', ci_cd: 'github', linting: {} } };
  const userCtx = { preferences: { aesthetics: 'google', supported_locales: [], offline_mode: false } };

  it('when SELINA_LLM_GATEWAY=direct, existing generateWithFallback path is still used', async () => {
    llmClient.gateway = 'direct';
    llmClient.authManager.hasAnyProvider = vi.fn().mockReturnValue(true);
    llmClient.generateWithFallback = vi.fn().mockResolvedValue('direct result');
    llmClient.generateViaFreeLLMAPI = vi.fn();

    const result = await llmClient.generateCode(orgCtx, userCtx, 'test', {}, null);

    expect(result).toBe('direct result');
    expect(llmClient.generateWithFallback).toHaveBeenCalled();
    expect(llmClient.generateViaFreeLLMAPI).not.toHaveBeenCalled();
  });

  it('when SELINA_LLM_GATEWAY=freellmapi, direct provider key requirement is bypassed', async () => {
    llmClient.gateway = 'freellmapi';
    llmClient.hasFreeLLMAPIConfig = vi.fn().mockReturnValue(true);
    llmClient.authManager.hasAnyProvider = vi.fn().mockReturnValue(false); // Should NOT throw

    llmClient.generateViaFreeLLMAPI = vi.fn().mockResolvedValue('```javascript\nconst a = 1;\n```');

    const result = await llmClient.generateCode(orgCtx, userCtx, 'test', {}, null);

    expect(result).toBe('const a = 1;');
    expect(llmClient.generateViaFreeLLMAPI).toHaveBeenCalled();
  });

  it('when SELINA_LLM_GATEWAY=freellmapi, missing FreeLLMAPI config throws error', async () => {
    llmClient.gateway = 'freellmapi';
    llmClient.hasFreeLLMAPIConfig = vi.fn().mockReturnValue(false);

    await expect(llmClient.generateCode(orgCtx, userCtx, 'test', {}, null)).rejects.toThrow('FreeLLMAPI config is missing');
  });

  it('generateViaFreeLLMAPI returns extracted code payload when response is fenced', async () => {
    llmClient.gateway = 'freellmapi';
    llmClient.hasFreeLLMAPIConfig = vi.fn().mockReturnValue(true);
    llmClient.authManager.hasAnyProvider = vi.fn().mockReturnValue(true);

    llmClient.generateViaFreeLLMAPI = vi.fn().mockResolvedValue('```python\nprint("hello")\n```\n');

    const result = await llmClient.generateCode(orgCtx, userCtx, 'test', {}, null);

    expect(result).toBe('print("hello")');
  });
});
