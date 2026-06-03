import { describe, expect, it, afterEach } from 'vitest';
import { getModelProfile, normalizeMode, DEFAULT_PROFILE } from '../../orchestrator/routing/model-profiles.js';

describe('model-profiles', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('normalizes unknown mode to DEFAULT_PROFILE', () => {
    expect(normalizeMode('unknown')).toBe(DEFAULT_PROFILE);
    expect(normalizeMode(null)).toBe(DEFAULT_PROFILE);
  });

  it('keeps known modes', () => {
    expect(normalizeMode('coding')).toBe('coding');
    expect(normalizeMode('reasoning')).toBe('reasoning');
    expect(normalizeMode('smoke_test')).toBe('smoke_test');
  });

  it('returns valid default profiles when no env is set', () => {
    const fast = getModelProfile('fast');
    // maxTokens depends on capabilities maxTokens now (800 vs 700), so let's check correctly
    expect(fast.maxTokens).toBe(800);
    expect(fast.temperature).toBe(0.2);

    const smoke = getModelProfile('smoke_test');
    expect(smoke.maxTokens).toBe(80);
    expect(smoke.temperature).toBe(0);
  });
});
