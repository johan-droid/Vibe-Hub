import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../utils/env.js';

const productionBaseEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
  JWT_SECRET: '12345678901234567890123456789012',
  CSRF_SECRET: '12345678901234567890123456789012',
  VIBE_MASTER_KEY: '1234567890123456789012345678901212345678901234567890123456789012',
  SELINA_ACTION_GRANT_SECRET: '12345678901234567890123456789012',
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

  it('infers Gemini for legacy production envs that only have Gemini configured', () => {
    const env = {
      ...productionBaseEnv,
      SELINA_MODEL_PROVIDER: '',
      NIM_API_KEY: '',
      GEMINI_API_KEY: 'gemini-key-for-tests',
    };

    const parsed = validateEnvironment(env);

    expect(parsed.GEMINI_API_KEY).toBe('gemini-key-for-tests');
  });

  it('still requires JWT_SECRET in production', () => {
    const env = { ...productionBaseEnv, JWT_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Invalid production environment configuration: JWT_SECRET');
  });

  it('requires a dedicated CSRF_SECRET in production', () => {
    const env = { ...productionBaseEnv, CSRF_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Invalid production environment configuration: CSRF_SECRET');
  });

  it('requires VIBE_MASTER_KEY in production', () => {
    const env = { ...productionBaseEnv, VIBE_MASTER_KEY: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Invalid production environment configuration: VIBE_MASTER_KEY');
  });

  it('requires a dedicated SELINA_ACTION_GRANT_SECRET in production', () => {
    const env = { ...productionBaseEnv, SELINA_ACTION_GRANT_SECRET: '' };

    expect(() => validateEnvironment(env))
      .toThrow('Invalid production environment configuration: SELINA_ACTION_GRANT_SECRET');
  });

  it('requires credentials for the selected production model provider', () => {
    const env = {
      ...productionBaseEnv,
      SELINA_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: '',
    };

    expect(() => validateEnvironment(env))
      .toThrow('Invalid production environment configuration: One provider key is required for active provider openai: OPENAI_API_KEY');
  });

  it('accepts DeepSeek as a selected production coding provider', () => {
    const env = {
      ...productionBaseEnv,
      SELINA_MODEL_PROVIDER: 'deepseek',
      NIM_API_KEY: '',
      DEEPSEEK_API_KEY: 'deepseek-key-for-tests',
    };

    const parsed = validateEnvironment(env);

    expect(parsed.SELINA_MODEL_PROVIDER).toBe('deepseek');
    expect(parsed.DEEPSEEK_API_KEY).toBe('deepseek-key-for-tests');
  });

  it('accepts FreeLLMAPI as the selected production provider', () => {
    const env = {
      ...productionBaseEnv,
      SELINA_MODEL_PROVIDER: 'freellmapi',
      SELINA_AGENT_PROVIDER: 'freellmapi',
      SELINA_EXPERT_CODE_PROVIDER: 'freellmapi',
      SELINA_EXPERT_DEBUG_PROVIDER: 'freellmapi',
      SELINA_EXPERT_MANAGER_PROVIDER: 'freellmapi',
      FREELLMAPI_BASE_URL: 'https://freellmapi-uqzq.onrender.com/v1',
      FREELLMAPI_API_KEY: 'freellmapi-key-for-tests',
      NIM_API_KEY: '',
    };

    const parsed = validateEnvironment(env);

    expect(parsed.FREELLMAPI_API_KEY).toBe('freellmapi-key-for-tests');
  });
});
