import { describe, expect, it } from 'vitest';
import { normalizeCapability, getCapabilityProfile, scoreModelForCapability, rankModelsForCapability } from '../../orchestrator/routing/capability-registry.js';

describe('capability-registry', () => {
  it('normalizes unknown capability to fast', () => {
    expect(normalizeCapability('unknown')).toBe('fast');
  });

  it('coding ranks coder/codestral/devstral keywords higher', () => {
    const scoreNormal = scoreModelForCapability('gpt-4', 'coding');
    const scoreCoder = scoreModelForCapability('qwen3-coder', 'coding');
    expect(scoreCoder).toBeGreaterThan(scoreNormal);
  });

  it('large_context penalizes 8b/nano/micro', () => {
    const scoreLarge = scoreModelForCapability('mistral large', 'large_context');
    const scoreNano = scoreModelForCapability('llama 3.1 8b', 'large_context');
    expect(scoreLarge).toBeGreaterThan(scoreNano);
  });

  it('reasoning ranks deepseek/magistral/nemotron/kimi higher', () => {
    const scoreBase = scoreModelForCapability('base-model', 'reasoning');
    const scoreReasoning = scoreModelForCapability('deepseek r1', 'reasoning');
    expect(scoreReasoning).toBeGreaterThan(scoreBase);
  });

  it('json_strict uses temperature 0', () => {
    const profile = getCapabilityProfile('json_strict');
    expect(profile.temperature).toBe(0);
  });

  it('unhealthy status gets strong negative score', () => {
    const scoreHealthy = scoreModelForCapability({ displayName: 'qwen', status: 'available' }, 'coding');
    const scoreUnhealthy = scoreModelForCapability({ displayName: 'qwen', status: 'error' }, 'coding');
    expect(scoreUnhealthy).toBeLessThan(scoreHealthy);
  });
});
