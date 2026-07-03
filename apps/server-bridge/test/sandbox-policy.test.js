import { describe, expect, it } from 'vitest';
import {
  DISABLED_SANDBOX_PROVIDER,
  normalizeSandboxProviderName,
  resolveDefaultSandboxProvider,
} from '../sandbox/runtime-policy.js';
import { SandboxProviderRouter } from '../sandbox/providers.js';

describe('sandbox runtime policy', () => {
  it('defaults to disabled in production when provider is not explicitly configured', () => {
    expect(resolveDefaultSandboxProvider({ NODE_ENV: 'production' })).toBe(DISABLED_SANDBOX_PROVIDER);
  });

  it('defaults to docker-local outside production for developer ergonomics', () => {
    expect(resolveDefaultSandboxProvider({ NODE_ENV: 'development' })).toBe('docker-local');
  });

  it('normalizes provider aliases', () => {
    expect(normalizeSandboxProviderName('docker')).toBe('docker-local');
    expect(normalizeSandboxProviderName('e2b')).toBe('e2b-vibekit');
    expect(normalizeSandboxProviderName('off')).toBe(DISABLED_SANDBOX_PROVIDER);
  });

  it('fails closed with a clear error when disabled provider is selected', async () => {
    const router = new SandboxProviderRouter({ env: { NODE_ENV: 'production' } });

    await expect(router.executeCommand({ command: 'node', args: ['-v'] })).rejects.toMatchObject({
      code: 'SANDBOX_DISABLED',
    });
  });
});
