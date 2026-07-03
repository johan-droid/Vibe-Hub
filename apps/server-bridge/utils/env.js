import { z } from 'zod';
import logger from './detailed-logger.js';

const optionalUrl = z.string().url().or(z.literal('')).optional();
const optionalProvider = z.enum(['freellmapi', 'gemini', 'openai', 'qwen', 'deepseek', 'nim', 'anthropic']).or(z.literal('')).optional();

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: optionalUrl,
  JWT_SECRET: z.string().optional(),
  CSRF_SECRET: z.string().optional(),
  VIBE_MASTER_KEY: z.string().optional(),
  SELINA_ACTION_GRANT_SECRET: z.string().optional(),
  UI_ORIGIN: z.string().optional(),
  FREELLMAPI_BASE_URL: optionalUrl,
  FREELLMAPI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_MODE: z.enum(['responses', 'chat']).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  NIM_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_NIM_API_KEY: z.string().optional(),
  SELINA_MODEL_PROVIDER: optionalProvider,
  SELINA_AGENT_PROVIDER: optionalProvider,
  SENTRY_DSN: optionalUrl,
  EDGE_PROTECTION_REQUIRED: z.enum(['true', 'false']).optional(),
  EDGE_PROVIDER: z.string().optional(),
  CONTROL_PLANE_ALLOWED_CIDRS: z.string().optional(),
  CONTROL_PLANE_INTERNAL_TOKEN: z.string().optional(),
  ALLOW_PUBLIC_CONTROL_PLANE: z.enum(['true', 'false']).optional(),
});

const PROVIDER_ENV_KEYS = {
  freellmapi: 'FREELLMAPI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  qwen: 'QWEN_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  nim: 'NIM_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

const PROVIDER_ENV_ALIASES = {
  freellmapi: ['FREELLMAPI_API_KEY'],
  nim: ['NIM_API_KEY', 'NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
};

function configuredProviderFromEnv(env = {}) {
  if (env.FREELLMAPI_API_KEY) return 'freellmapi';
  if (env.NIM_API_KEY || env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY) return 'nim';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.QWEN_API_KEY) return 'qwen';
  if (env.DEEPSEEK_API_KEY) return 'deepseek';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.GEMINI_API_KEY || env.LLM_API_KEY) return 'gemini';
  return 'nim';
}

export function validateEnvironment(env = process.env) {
  const effectiveEnv = { ...env };

  const parsed = envSchema.safeParse(effectiveEnv);

  if (!parsed.success) {
    const errorMsg = `Invalid environment configuration: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`;
    logger.error('Env', errorMsg);
    throw new Error(errorMsg);
  }

  logger.info('Env', 'Environment validation passed', {
    nodeEnv: env.NODE_ENV || 'development',
    hasDatabaseUrl: !!env.DATABASE_URL,
    hasJwtSecret: !!env.JWT_SECRET,
    hasCsrfSecret: !!env.CSRF_SECRET,
    hasVibeMasterKey: !!env.VIBE_MASTER_KEY,
    hasActionGrantSecret: !!env.SELINA_ACTION_GRANT_SECRET,
    hasUiOrigin: !!env.UI_ORIGIN,
    hasFreeLLMAPIKey: !!env.FREELLMAPI_API_KEY,
    hasGeminiKey: !!env.GEMINI_API_KEY,
    hasNimKey: !!(env.NIM_API_KEY || env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY),
  });

  if (env.NODE_ENV === 'production') {
    const activeProvider = (
      env.SELINA_MODEL_PROVIDER ||
      env.SELINA_AGENT_PROVIDER ||
      configuredProviderFromEnv(env)
    ).toLowerCase();
    const providerKey = PROVIDER_ENV_KEYS[activeProvider];
    const required = ['DATABASE_URL', 'JWT_SECRET', 'CSRF_SECRET', 'VIBE_MASTER_KEY', 'SELINA_ACTION_GRANT_SECRET', 'UI_ORIGIN'];

    const missing = required.filter(key => !env[key]);
    const providerAliases = PROVIDER_ENV_ALIASES[activeProvider] || [providerKey].filter(Boolean);
    if (providerAliases.length > 0 && !providerAliases.some(key => env[key])) {
      missing.push(providerAliases.join('|'));
    }
    if (activeProvider === 'freellmapi' && !env.FREELLMAPI_BASE_URL) {
      missing.push('FREELLMAPI_BASE_URL');
    }

    if (missing.length > 0) {
      const errorMsg = `Missing required production environment variables: ${missing.join(', ')}`;
      logger.error('Env', errorMsg);
      throw new Error(errorMsg);
    }
  }

  return parsed.data;
}
