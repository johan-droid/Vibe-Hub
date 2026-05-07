import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../utils/env.js';

const productionBaseEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
  JWT_SECRET: 'jwt-secret-for-tests',
  CSRF_SECRET: 'csrf-secret-for-tests',
  VIBE_MASTER_KEY: 'master-key-for-tests',
  UI_ORIGIN: 'https://vibe-hub-ui.onrender.com',
  SELINA_MODEL_PROVIDER: 'nim',
  NIM_API_KEY: 'nim-key-for-tests',
};

describe('Environment validation', () => {
  it('allows production to start when core secrets and provider credentials are configured', () => {
    const env = { ...productionBaseEnv };

    const parsed = validateEnvironment(env);

    expect(parsed.CSRF_SECRET).toBe(productionBaseEnv.CSRF_SECRET);
    expect(parsed.NIM_API_KEY).toBe(productionBaseEnv.NIM_API_KEY);
  });

  it('still requires JWT_SECRET in production', () => {
    const env = { ...productionBaseEnv, JWT_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Missing required production environment variables: JWT_SECRET');
  });

  it('requires a dedicated CSRF_SECRET in production', () => {
    const env = { ...productionBaseEnv, CSRF_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Missing required production environment variables: CSRF_SECRET');
  });

  it('requires VIBE_MASTER_KEY in production', () => {
    const env = { ...productionBaseEnv, VIBE_MASTER_KEY: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Missing required production environment variables: VIBE_MASTER_KEY');
  });

  it('requires credentials for the selected production model provider', () => {
    const env = {
      ...productionBaseEnv,
      SELINA_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: '',
    };

    expect(() => validateEnvironment(env))
      .toThrow('Missing required production environment variables: OPENAI_API_KEY');
  });
});
