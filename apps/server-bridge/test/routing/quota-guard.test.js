import { describe, expect, it, beforeEach } from 'vitest';
import { quotaGuard } from '../../orchestrator/routing/quota-guard.js';

describe('quota-guard', () => {
  beforeEach(() => {
    quotaGuard.resetQuotaGuardForTests();
  });

  it('allows calls under limit', () => {
    expect(quotaGuard.canCallMode('smoke_test')).toBe(true);
    quotaGuard.recordRoutingResult({ mode: 'smoke_test', status: 200 });

    const snapshot = quotaGuard.getQuotaSnapshot();
    expect(snapshot.windows['smoke_test'].count).toBe(1);
    expect(quotaGuard.canCallMode('smoke_test')).toBe(true);
  });

  it('blocks after limit', () => {
    for (let i = 0; i < 5; i++) {
      quotaGuard.recordRoutingResult({ mode: 'smoke_test', status: 200 });
    }
    expect(quotaGuard.canCallMode('smoke_test')).toBe(false);
    expect(() => quotaGuard.assertCanCallMode('smoke_test')).toThrow('Quota limit reached or in cooldown');
  });

  it('cooldown blocks after 429 result', () => {
    quotaGuard.recordRoutingResult({ mode: 'fast', status: 429 });

    expect(quotaGuard.canCallMode('fast')).toBe(false);
    const snapshot = quotaGuard.getQuotaSnapshot();
    expect(snapshot.cooldowns['fast']).toBeDefined();
  });

  it('cooldown uses routedVia if available', () => {
    quotaGuard.recordRoutingResult({ mode: 'fast', status: 429, routedVia: 'groq' });

    const snapshot = quotaGuard.getQuotaSnapshot();
    expect(snapshot.cooldowns['groq']).toBeDefined();
  });
});
