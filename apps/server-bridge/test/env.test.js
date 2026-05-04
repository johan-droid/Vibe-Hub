import { describe, expect, it, vi } from 'vitest';
import { validateEnvironment } from '../utils/env.js';

const productionBaseEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
  JWT_SECRET: 'jwt-secret-for-tests',
  UI_ORIGIN: 'https://vibe-hub-ui.onrender.com',
};

describe('Environment validation', () => {
  it('allows production to start without CSRF_SECRET by falling back to JWT_SECRET', () => {
    const env = { ...productionBaseEnv };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const parsed = validateEnvironment(env);

    expect(parsed.CSRF_SECRET).toBe(productionBaseEnv.JWT_SECRET);
    expect(env.CSRF_SECRET).toBe(productionBaseEnv.JWT_SECRET);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('CSRF_SECRET is not set'));

    warn.mockRestore();
  });

  it('still requires JWT_SECRET in production', () => {
    const env = { ...productionBaseEnv, JWT_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Missing required production environment variables: JWT_SECRET');
  });
});
