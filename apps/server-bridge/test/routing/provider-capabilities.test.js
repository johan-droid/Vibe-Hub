import { describe, it, expect } from 'vitest';
import {
  normalizeCapability,
  getProviderCapability,
  flattenProviders,
  getProviderTier,
  normalizeProviderName
} from '../../orchestrator/routing/provider-capabilities.js';

describe('Provider Capabilities Registry', () => {
  it('should resolve known capabilities', () => {
    expect(normalizeCapability('fast')).toBe('fast');
    expect(normalizeCapability('coding')).toBe('coding');
    expect(normalizeCapability('large_context')).toBe('large_context');
    expect(normalizeCapability('reasoning')).toBe('reasoning');
    expect(normalizeCapability('json_strict')).toBe('json_strict');
    expect(normalizeCapability('smoke_test')).toBe('smoke_test');
  });

  it('should fallback unknown capability to fast', () => {
    expect(normalizeCapability('unknown')).toBe('fast');
    expect(normalizeCapability('')).toBe('fast');
    expect(normalizeCapability(undefined)).toBe('fast');
  });

  it('should normalize provider names', () => {
    expect(normalizeProviderName('z.ai')).toBe('zai');
    expect(normalizeProviderName('ZAI')).toBe('zai');
    expect(normalizeProviderName('zhipu')).toBe('zai');
    expect(normalizeProviderName('github models')).toBe('github');
    expect(normalizeProviderName('cloudflare workers ai')).toBe('cloudflare');
    expect(normalizeProviderName('mistral la plateforme')).toBe('mistral');
    expect(normalizeProviderName('Nvidia NIM')).toBe('nvidia');
    expect(normalizeProviderName('ollama cloud')).toBe('ollama');
    expect(normalizeProviderName('kilo gateway')).toBe('kilo');
    expect(normalizeProviderName('google')).toBe('google');
  });

  it('should flatten providers', () => {
    const profile = getProviderCapability('coding');
    const flattened = flattenProviders(profile);

    expect(flattened).toContain('mistral');
    expect(flattened).toContain('cerebras');
    expect(flattened).toContain('ollama');
  });

  it('should determine provider tiers', () => {
    const profile = getProviderCapability('large_context');

    expect(getProviderTier(profile, 'google')).toBe('primary');
    expect(getProviderTier(profile, 'cerebras')).toBe('fallback');
    expect(getProviderTier(profile, 'llm7')).toBe('emergency');
    expect(getProviderTier(profile, 'unknown-provider')).toBe('unknown');
  });
});
