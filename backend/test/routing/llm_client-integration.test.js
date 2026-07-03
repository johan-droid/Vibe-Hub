import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LLMClient from '../../orchestrator/llm_client.js';
import * as selinaRouter from '../../orchestrator/routing/selina-router.js';

describe('LLM Client Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    // Prevent actual LLM calls
    LLMClient.generateWithFallback = vi.fn().mockResolvedValue('direct response');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use freellmapi gateway if SELINA_LLM_GATEWAY=freellmapi', async () => {
    process.env.SELINA_LLM_GATEWAY = 'freellmapi';
    LLMClient.gateway = 'freellmapi';
  });

  it('should check for FreeLLMAPI config', () => {
    process.env.FREELLMAPI_BASE_URL = 'http://test';
    process.env.FREELLMAPI_API_KEY = 'test-key';
    expect(LLMClient.hasFreeLLMAPIConfig()).toBe(true);

    delete process.env.FREELLMAPI_BASE_URL;
    process.env.OPENAI_BASE_URL = 'http://test-openai';
    expect(LLMClient.hasFreeLLMAPIConfig()).toBe(false);

    delete process.env.OPENAI_BASE_URL;
    delete process.env.FREELLMAPI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(LLMClient.hasFreeLLMAPIConfig()).toBe(false);
  });

  it('should call FreeLLMAPI correctly from generateViaFreeLLMAPI', async () => {
    // Note: We need to spy on the module properly
    const callSelinaLLMSpy = vi.spyOn(selinaRouter, 'callSelinaLLM').mockResolvedValue('test response');

    // We un-mock generateViaFreeLLMAPI for this test if it was mocked
    // The implementation of generateViaFreeLLMAPI is what we want to test here.

    await LLMClient.generateViaFreeLLMAPI({
      systemInstruction: 'sys',
      userInstruction: 'usr',
      taskPrompt: 'test code task'
    });

    expect(callSelinaLLMSpy).toHaveBeenCalledTimes(1);
    const args = callSelinaLLMSpy.mock.calls[0][0];

    expect(args.mode).toBe('coding');
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].role).toBe('user');
  });
});
