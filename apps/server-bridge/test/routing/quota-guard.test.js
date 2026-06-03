import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quotaGuard } from '../../orchestrator/routing/quota-guard.js';

describe('Quota Guard', () => {
  beforeEach(() => {
    quotaGuard.resetQuotaGuardForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  it('should enforce fast mode limits', () => {
    process.env.SELINA_FAST_RPM = '2';

    quotaGuard.recordRoutingResult({ mode: 'fast', status: 200 });
    quotaGuard.recordRoutingResult({ mode: 'fast', status: 200 });

    expect(quotaGuard.canCallMode('fast')).toBe(false);

    vi.advanceTimersByTime(60001);
    expect(quotaGuard.canCallMode('fast')).toBe(true);
  });

  it('should enforce large_context mode limits default to 4', () => {
    delete process.env.SELINA_LARGE_CONTEXT_RPM;

    quotaGuard.recordRoutingResult({ mode: 'large_context', status: 200 });
    quotaGuard.recordRoutingResult({ mode: 'large_context', status: 200 });
    quotaGuard.recordRoutingResult({ mode: 'large_context', status: 200 });
    quotaGuard.recordRoutingResult({ mode: 'large_context', status: 200 });

    expect(quotaGuard.canCallMode('large_context')).toBe(false);

    vi.advanceTimersByTime(60001);
    expect(quotaGuard.canCallMode('large_context')).toBe(true);
  });

  it('should handle json_strict limits', () => {
    process.env.SELINA_JSON_STRICT_RPM = '1';

    quotaGuard.recordRoutingResult({ mode: 'json_strict', status: 200 });

    expect(quotaGuard.canCallMode('json_strict')).toBe(false);
  });

  it('should apply mode-wide cooldown on 429 when routedVia missing', () => {
    quotaGuard.recordRoutingResult({ mode: 'smoke_test', status: 429 });

    expect(quotaGuard.canCallMode('smoke_test')).toBe(false);
    expect(() => quotaGuard.assertCanCallMode('smoke_test')).toThrowError('Quota limit reached or in cooldown for mode: smoke_test');

    vi.advanceTimersByTime(600 * 1000 + 1); // 10 minutes default provider cooldown
    expect(quotaGuard.canCallMode('smoke_test')).toBe(true);
  });
});
