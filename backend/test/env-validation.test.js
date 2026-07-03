import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../utils/detailed-logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const validProductionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@example.com:5432/app?sslmode=require',
  JWT_SECRET: 'jwt_secret_0123456789_0123456789_abcdef',
  CSRF_SECRET: 'csrf_secret_0123456789_0123456789_abcdef',
  VIBE_MASTER_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  SELINA_ACTION_GRANT_SECRET: 'action_grant_secret_0123456789_abcdef',
  UI_ORIGIN: 'https://app.example.com',
  API_ORIGIN: 'https://api.example.com',
  UI_ALLOWED_ORIGINS: 'https://app.example.com',
  FRONTEND_ORIGINS: 'https://app.example.com',
  AUTH_COOKIE_SAME_SITE: 'none',
  NIM_API_KEY: 'nim_realistic_key_value_for_tests',
};

async function loadValidator() {
  vi.resetModules();
  return import('../utils/env.js');
}

describe('validateEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid split-origin production configuration', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment(validProductionEnv)).not.toThrow();
  });

  it('rejects placeholder production secrets', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      JWT_SECRET: 'change_me_to_a_random_string',
    })).toThrow(/JWT_SECRET must not use a placeholder value/);
  });

  it('rejects short production secrets', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      CSRF_SECRET: 'too-short',
    })).toThrow(/CSRF_SECRET must be at least 32 characters/);
  });

  it('rejects invalid VIBE_MASTER_KEY format', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      VIBE_MASTER_KEY: 'not-hex-but-long-enough-to-trigger-format-validation-0000000000000000',
    })).toThrow(/VIBE_MASTER_KEY must be 32 random bytes encoded as 64 hex characters/);
  });

  it('rejects http UI origins in production', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      UI_ORIGIN: 'http://app.example.com',
    })).toThrow(/UI_ORIGIN must use https:\/\/ in production/);
  });

  it('rejects split UI and API origins without SameSite none', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      AUTH_COOKIE_SAME_SITE: 'lax',
    })).toThrow(/Split UI\/API origins require AUTH_COOKIE_SAME_SITE=none/);
  });

  it('rejects invalid SameSite values', async () => {
    const { validateEnvironment } = await loadValidator();

    expect(() => validateEnvironment({
      ...validProductionEnv,
      AUTH_COOKIE_SAME_SITE: 'maybe',
    })).toThrow(/must be one of: strict, lax, none/);
  });
});
