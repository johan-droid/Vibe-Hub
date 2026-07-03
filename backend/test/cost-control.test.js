import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenGovernor, TokenBudgetExceededError, resetSessionUsage, getSessionUsage } from '../orchestrator/token-governor.js';
import { semanticCache } from '../orchestrator/semantic-cache.js';
import { pool } from '../db.js';
import { embeddingsService } from '../memory/embeddings.js';
import {
  DailyTokenQuotaExceededError,
  ExpensiveStepConfirmationRequiredError,
  LlmRateLimitError,
  applyBudgetPolicyToProfile,
  enforceLlmRateLimit,
  getBillingEvents,
  recordBillingEvent,
  recordSessionTokenUsage,
  requireExpensiveStepConfirmation,
  resetCostControls,
} from '../orchestrator/cost-controls.js';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../memory/embeddings.js', () => ({
  embeddingsService: {
    getEmbedding: vi.fn(),
  },
}));

describe('LLMCostControlSuite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    semanticCache.enabled = true;
    semanticCache.fallbackToExactOnly = false;
    resetSessionUsage('test-session-123');
    resetCostControls();
    process.env.GEMINI_KEYS = 'test-gemini-key';
    process.env.GROQ_KEYS = 'test-groq-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_KEYS;
    delete process.env.GROQ_KEYS;
    delete process.env.SELINA_DAILY_SESSION_TOKEN_LIMIT;
    delete process.env.SELINA_LLM_CALLS_PER_MINUTE;
  });

  describe('SemanticCacheManager', () => {
    it('should resolve via exact SHA-256 hash match first', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ response: 'Exact Cached Response' }],
      });

      const response = await semanticCache.get('Show me the server bridge code');
      
      expect(response).toBe('Exact Cached Response');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT response FROM semantic_cache WHERE prompt_hash ='),
        expect.any(Array)
      );
    });

    it('should fallback to semantic similarity search if exact hash misses', async () => {
      // 1. Exact query returns empty rows (miss)
      pool.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock embedding generation
      embeddingsService.getEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // 2. Similarity search returns a match above threshold (0.97)
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            prompt: 'Show me server codes',
            response: 'Semantic Cached Response',
            similarity: 0.97,
          },
        ],
      });

      const response = await semanticCache.get('Show me the server bridge code');
      
      expect(response).toBe('Semantic Cached Response');
      expect(embeddingsService.getEmbedding).toHaveBeenCalled();
    });
  });

  describe('TokenBudgetAndGovernor', () => {
    it('should track token usage across multiple runs and enforce per-session budget limits', async () => {
      // Mock db queries & embedding cache checks to miss, forcing direct routing
      pool.query.mockResolvedValue({ rows: [] });
      embeddingsService.getEmbedding.mockResolvedValue([0.1, 0.2]);

      const governor = new TokenGovernor();
      
      // Custom short session budget for testing
      process.env.SESSION_TOKEN_BUDGET = '500';

      // Mock global fetch for Gemini API call
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Short premium output' }] } }],
        }),
      });

      // First call (Should succeed and track usage)
      const runModel = await governor.requestModel('low', 'planner');
      const res1 = await runModel('System Prompt', 'User Prompt', { runId: 'test-session-123' });
      expect(res1).toBe('Short premium output');
      expect(getSessionUsage('test-session-123')).toBeGreaterThan(0);

      // Artificially inflate usage to exceed budget
      process.env.SESSION_TOKEN_BUDGET = '10';

      // Second call (Should throw TokenBudgetExceededError)
      await expect(
        runModel('System Prompt', 'User Prompt', { runId: 'test-session-123' })
      ).rejects.toThrow(TokenBudgetExceededError);

      globalThis.fetch = originalFetch;
      delete process.env.SESSION_TOKEN_BUDGET;
    });

    it('should attempt cheap model first for planning tasks and fallback to premium if validation fails', async () => {
      const governor = new TokenGovernor();
      
      // Mock cheap execution failing validation (short/placeholder string)
      const cheapCallFn = vi.fn()
        .mockResolvedValueOnce('TODO: Write actual plan') // cheap try (fails heuristic validation)
        .mockResolvedValueOnce('Premium comprehensive planner response'); // premium fallback try

      const result = await governor.getCompute('high', 'planner', cheapCallFn, { 
        runId: 'test-session-456',
        skipTieredFallback: false 
      });

      expect(result).toBe('Premium comprehensive planner response');
      expect(cheapCallFn).toHaveBeenCalledTimes(2);
    });

    it('degrades model routing at 80 percent of daily session budget and stops at 100 percent', () => {
      process.env.SELINA_DAILY_SESSION_TOKEN_LIMIT = '100';
      recordSessionTokenUsage({
        userId: 'user-1',
        sessionId: 'session-budget',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        inputTokens: 40,
        outputTokens: 40,
      });

      const degraded = applyBudgetPolicyToProfile({
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        maxOutputTokens: 4096,
      }, {
        sessionId: 'session-budget',
      });

      expect(degraded.model).toBe('gemini-1.5-flash');
      expect(degraded.maxOutputTokens).toBe(1024);

      expect(() => recordSessionTokenUsage({
        userId: 'user-1',
        sessionId: 'session-budget',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        inputTokens: 10,
        outputTokens: 10,
      })).toThrow(DailyTokenQuotaExceededError);
    });

    it('enforces a per-user sliding-window LLM completion limit', () => {
      process.env.SELINA_LLM_CALLS_PER_MINUTE = '2';
      enforceLlmRateLimit({ userId: 'rate-user', now: 1_000 });
      enforceLlmRateLimit({ userId: 'rate-user', now: 2_000 });

      expect(() => enforceLlmRateLimit({ userId: 'rate-user', now: 3_000 }))
        .toThrow(LlmRateLimitError);
      expect(() => enforceLlmRateLimit({ userId: 'rate-user', now: 62_000 }))
        .not.toThrow();
    });

    it('requires extra confirmation for expensive non-trusted steps', async () => {
      await expect(requireExpensiveStepConfirmation({
        user: { id: 'user-1', roles: [] },
        operation: 'deep_agent_loop',
      })).rejects.toThrow(ExpensiveStepConfirmationRequiredError);

      await expect(requireExpensiveStepConfirmation({
        user: { id: 'user-1', roles: [] },
        operation: 'deep_agent_loop',
        confirmFn: async () => true,
      })).resolves.toBe(true);

      await expect(requireExpensiveStepConfirmation({
        user: { id: 'trusted', roles: ['trusted'] },
        operation: 'deep_agent_loop',
      })).resolves.toBe(true);
    });

    it('tags billing events with user and session identifiers for cost monitoring', () => {
      recordBillingEvent({
        kind: 'sandbox',
        userId: 'billing-user',
        sessionId: 'billing-session',
        runId: 'run-1',
      });

      expect(getBillingEvents()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'sandbox',
          userId: 'billing-user',
          sessionId: 'billing-session',
          runId: 'run-1',
        }),
      ]));
    });
  });
});
