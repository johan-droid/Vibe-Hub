import { describe, expect, it, vi } from 'vitest';
import { chooseModeFromTask, callSelinaLLM } from '../../orchestrator/routing/selina-router.js';

// Mock FreeLLMAPI client so we don't make real requests
vi.mock('../../orchestrator/routing/freellmapi-client.js', () => ({
  callFreeLLMAPI: vi.fn().mockResolvedValue({ status: 200, durationMs: 100, text: 'test response', model: 'test-model' })
}));

describe('selina-router', () => {
  describe('chooseModeFromTask', () => {
    it('maps fix this bug to coding', () => {
      expect(chooseModeFromTask('please fix this bug in auth')).toBe('coding');
      expect(chooseModeFromTask('write test for component')).toBe('coding');
    });

    it('maps architecture analysis to reasoning', () => {
      expect(chooseModeFromTask('provide deep analysis of security')).toBe('reasoning');
      expect(chooseModeFromTask('threat model this design')).toBe('reasoning');
    });

    it('maps JSON to json_strict', () => {
      expect(chooseModeFromTask('return JSON for tool args')).toBe('json_strict');
    });

    it('maps smoke test to smoke_test', () => {
      expect(chooseModeFromTask('smoke test models')).toBe('smoke_test');
      expect(chooseModeFromTask('check model availability')).toBe('smoke_test');
    });

    it('maps normal text to fast', () => {
      expect(chooseModeFromTask('hello how are you')).toBe('fast');
      expect(chooseModeFromTask('')).toBe('fast');
      expect(chooseModeFromTask(null)).toBe('fast');
    });
  });

  describe('callSelinaLLM', () => {
    it('expectedContextTokens > 12000 upgrades to large_context', async () => {
      const { callFreeLLMAPI } = await import('../../orchestrator/routing/freellmapi-client.js');
      await callSelinaLLM({ mode: 'coding', messages: [], metadata: { expectedContextTokens: 15000 } });
      expect(callFreeLLMAPI).toHaveBeenCalledWith(expect.objectContaining({ capability: 'large_context' }));
    });

    it('requiresJson uses json_strict', async () => {
      const { callFreeLLMAPI } = await import('../../orchestrator/routing/freellmapi-client.js');
      await callSelinaLLM({ mode: 'fast', messages: [], metadata: { requiresJson: true } });
      expect(callFreeLLMAPI).toHaveBeenCalledWith(expect.objectContaining({ capability: 'json_strict' }));
    });

    it('requiresCode uses coding', async () => {
      const { callFreeLLMAPI } = await import('../../orchestrator/routing/freellmapi-client.js');
      await callSelinaLLM({ mode: 'fast', messages: [], metadata: { requiresCode: true } });
      expect(callFreeLLMAPI).toHaveBeenCalledWith(expect.objectContaining({ capability: 'coding' }));
    });

    it('forceMode overrides auto selection', async () => {
      const { callFreeLLMAPI } = await import('../../orchestrator/routing/freellmapi-client.js');
      await callSelinaLLM({ mode: 'reasoning', messages: [], metadata: { requiresCode: true, forceMode: true } });
      expect(callFreeLLMAPI).toHaveBeenCalledWith(expect.objectContaining({ capability: 'reasoning' }));
    });
  });
});
