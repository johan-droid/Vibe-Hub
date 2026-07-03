import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordProviderResult,
  getProviderScore,
  rankProvidersForCapability,
  shouldAvoidProvider,
  resetProviderBudgetManagerForTests
} from '../../orchestrator/routing/provider-budget-manager.js';

describe('Provider Budget Manager', () => {
  beforeEach(() => {
    resetProviderBudgetManagerForTests();
  });

  it('should track successes and improve score', () => {
    recordProviderResult({
      capability: 'coding',
      routedVia: 'mistral/mistral-large-2411',
      status: 200,
      success: true,
      durationMs: 4000
    });

    const score = getProviderScore('mistral', 'coding');
    // mistral is primary for coding (+20), success rate 100% (+15), latency < 5000 (+10) -> base 50
    expect(score).toBe(95);
  });

  it('should track failures and drop score', () => {
    recordProviderResult({
      capability: 'coding',
      routedVia: 'mistral/mistral-large-2411',
      status: 500,
      success: false,
      durationMs: 0
    });
    recordProviderResult({
      capability: 'coding',
      routedVia: 'mistral/mistral-large-2411',
      status: 500,
      success: false,
      durationMs: 0
    });
    recordProviderResult({
      capability: 'coding',
      routedVia: 'mistral/mistral-large-2411',
      status: 500,
      success: false,
      durationMs: 0
    });

    const score = getProviderScore('mistral', 'coding');
    // mistral is primary (+20), success rate 0% and reqs >=3 (-20) -> base 50
    expect(score).toBe(50);
  });

  it('should extract provider from routedVia', () => {
    recordProviderResult({
      capability: 'reasoning',
      routedVia: 'google/gemini-2.5-flash',
      status: 200,
      success: true,
      durationMs: 2000
    });
    const ranked = rankProvidersForCapability('reasoning');
    const google = ranked.find(p => p.provider === 'google');
    expect(google).toBeDefined();
    expect(google.score).toBeGreaterThan(50);
  });

  it('should apply 429 cooldowns', () => {
    recordProviderResult({
      capability: 'fast',
      provider: 'groq',
      status: 429,
      success: false,
      durationMs: 0
    });

    expect(shouldAvoidProvider('groq')).toBe(true);
    const score = getProviderScore('groq', 'fast');
    // Primary (+20), 429 cooldown active (-25), recent429 > 0 (-15)
    expect(score).toBe(30);
  });

  it('should apply 401/404 cooldowns', () => {
    recordProviderResult({
      capability: 'fast',
      provider: 'cerebras',
      status: 401,
      success: false,
      durationMs: 0
    });

    expect(shouldAvoidProvider('cerebras')).toBe(true);
  });

  it('should apply 503 cooldowns', () => {
    recordProviderResult({
      capability: 'fast',
      provider: 'zai',
      status: 503,
      success: false,
      durationMs: 0
    });

    expect(shouldAvoidProvider('zai')).toBe(true);
  });

  it('should rank healthy primary providers highest', () => {
    recordProviderResult({
      capability: 'large_context',
      provider: 'google',
      status: 200,
      success: true,
      durationMs: 3000
    });

    recordProviderResult({
      capability: 'large_context',
      provider: 'mistral',
      status: 429,
      success: false,
      durationMs: 0
    });

    const ranked = rankProvidersForCapability('large_context');
    expect(ranked[0].provider).toBe('google');
    expect(ranked.find(p => p.provider === 'mistral').isCoolingDown).toBe(true);
  });
});
