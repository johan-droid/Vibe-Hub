import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chooseModeFromTask, callSelinaLLM, callSelinaText } from '../../orchestrator/routing/selina-router.js';
import * as freellmapiClient from '../../orchestrator/routing/freellmapi-client.js';
import { quotaGuard } from '../../orchestrator/routing/quota-guard.js';

describe('Selina Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaGuard.resetQuotaGuardForTests();
  });

  describe('chooseModeFromTask', () => {
    it('should respect forceMode metadata', () => {
      expect(chooseModeFromTask('hello', { forceMode: 'reasoning' })).toBe('reasoning');
    });

    it('should map metadata requiresJson to json_strict', () => {
      expect(chooseModeFromTask('hello', { requiresJson: true })).toBe('json_strict');
    });

    it('should map metadata requiresCode to coding', () => {
      expect(chooseModeFromTask('hello', { requiresCode: true })).toBe('coding');
    });

    it('should map expectedContextTokens > 12000 to large_context', () => {
      expect(chooseModeFromTask('hello', { expectedContextTokens: 13000 })).toBe('large_context');
    });

    it('should detect smoke_test keywords', () => {
      expect(chooseModeFromTask('smoke test model availability')).toBe('smoke_test');
      expect(chooseModeFromTask('run test models')).toBe('smoke_test');
    });

    it('should detect large_context keywords', () => {
      expect(chooseModeFromTask('summarize the whole repo')).toBe('large_context');
      expect(chooseModeFromTask('analyze repository')).toBe('large_context');
    });

    it('should detect reasoning keywords', () => {
      expect(chooseModeFromTask('deep analysis of architecture')).toBe('reasoning');
      expect(chooseModeFromTask('find the root cause of this vulnerability')).toBe('reasoning');
    });

    it('should detect coding keywords', () => {
      expect(chooseModeFromTask('write a test')).toBe('coding');
      expect(chooseModeFromTask('fix this bug in the frontend component')).toBe('coding');
    });

    it('should detect json_strict keywords', () => {
      expect(chooseModeFromTask('output as json')).toBe('json_strict');
      expect(chooseModeFromTask('state transition')).toBe('json_strict');
    });

    it('should fallback to fast for unknown requests', () => {
      expect(chooseModeFromTask('say hello world')).toBe('fast');
    });

    it('should prioritize repo-wide terms (large_context) over generic terms', () => {
      expect(chooseModeFromTask('write code for the entire repo')).toBe('large_context');
      expect(chooseModeFromTask('security analysis of full codebase')).toBe('large_context');
    });
  });

  describe('callSelinaLLM', () => {
    it('should pass profile maxTokens and temperature to FreeLLMAPI', async () => {
      const mockResult = {
        text: 'mocked',
        status: 200,
        durationMs: 1000,
        routedVia: 'mistral/test',
        model: 'auto'
      };
      const callSpy = vi.spyOn(freellmapiClient, 'callFreeLLMAPI').mockResolvedValue(mockResult);

      await callSelinaText({
        mode: 'coding',
        systemInstruction: 'sys',
        userInstruction: 'usr'
      });

      expect(callSpy).toHaveBeenCalledTimes(1);
      const callArgs = callSpy.mock.calls[0][0];

      expect(callArgs.capability).toBe('coding');
      expect(callArgs.profile).toBeDefined();
      expect(callArgs.profile.strategy).toBe('balanced');
      // Values are loaded from defaults or env, check they are numbers
      expect(typeof callArgs.profile.maxTokens).toBe('number');
      expect(typeof callArgs.profile.temperature).toBe('number');
    });

    it('should record success to QuotaGuard and BudgetManager', async () => {
      vi.spyOn(freellmapiClient, 'callFreeLLMAPI').mockResolvedValue({
        text: 'success', status: 200, durationMs: 500, routedVia: 'google'
      });

      await callSelinaText({ mode: 'fast', systemInstruction: 'sys', userInstruction: 'usr' });

      const snapshot = quotaGuard.getQuotaSnapshot();
      expect(snapshot.windows['fast']).toBeDefined();
      expect(snapshot.windows['fast'].count).toBe(1);
    });
  });
});
