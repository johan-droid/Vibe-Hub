import { z } from 'zod';
import logger from './detailed-logger.js';

const optionalUrl = z.string().url().or(z.literal('')).optional();
const optionalProvider = z.enum(['freellmapi', 'gemini', 'openai', 'qwen', 'deepseek', 'nim', 'anthropic']).or(z.literal('')).optional();
const SAME_SITE_VALUES = ['strict', 'lax', 'none'];
const PLACEHOLDER_PATTERN = /^(change[_-]?me|your[_-]?|example|placeholder|test-secret|secret|password|changeme)/i;

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
  UI_ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_ORIGINS: z.string().optional(),
  API_ORIGIN: z.string().optional(),
  AUTH_COOKIE_SAME_SITE: z.string().optional(),
  COOKIE_SAME_SITE: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().optional(),
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

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(String(value).trim()).origin;
  } catch {
    return null;
  }
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function collectOrigins(env) {
  const values = [env.UI_ORIGIN, env.UI_ALLOWED_ORIGINS, env.FRONTEND_ORIGINS]
    .filter(Boolean)
    .flatMap(csv);
  return [...new Set(values.map(normalizeOrigin).filter(Boolean))];
}

function isProbablyPlaceholder(value) {
  return !value || PLACEHOLDER_PATTERN.test(String(value).trim());
}

function assertSecret(errors, env, key, { minLength = 32, hexBytes = null } = {}) {
  const value = env[key];
  if (!value) {
    errors.push(`${key} is required`);
    return;
  }
  if (isProbablyPlaceholder(value)) {
    errors.push(`${key} must not use a placeholder value`);
  }
  if (String(value).length < minLength) {
    errors.push(`${key} must be at least ${minLength} characters`);
  }
  if (hexBytes && !new RegExp(`^[a-f0-9]{${hexBytes * 2}}$`, 'i').test(String(value))) {
    errors.push(`${key} must be ${hexBytes} random bytes encoded as ${hexBytes * 2} hex characters`);
  }
}

function assertUrl(errors, env, key, { required = false, originOnly = false, httpsInProduction = false } = {}) {
  const value = env[key];
  if (!value) {
    if (required) errors.push(`${key} is required`);
    return;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${key} must be a valid URL`);
    return;
  }
  if (originOnly && parsed.href !== parsed.origin + '/') {
    errors.push(`${key} must be an origin only, for example ${parsed.origin}`);
  }
  if (httpsInProduction && parsed.protocol !== 'https:') {
    errors.push(`${key} must use https:// in production`);
  }
}

function assertOriginList(errors, env, key) {
  for (const origin of csv(env[key])) {
    const normalized = normalizeOrigin(origin);
    if (!normalized) {
      errors.push(`${key} contains an invalid origin: ${origin}`);
    } else if (normalized !== origin.replace(/\/$/, '')) {
      errors.push(`${key} origin should be normalized without path/query: ${origin}`);
    }
  }
}

function validateProductionEnvironment(env) {
  const errors = [];
  const activeProvider = (
    env.SELINA_MODEL_PROVIDER ||
    env.SELINA_AGENT_PROVIDER ||
    configuredProviderFromEnv(env)
  ).toLowerCase();
  const providerKey = PROVIDER_ENV_KEYS[activeProvider];
  const providerAliases = PROVIDER_ENV_ALIASES[activeProvider] || [providerKey].filter(Boolean);

  assertUrl(errors, env, 'DATABASE_URL', { required: true });
  assertUrl(errors, env, 'UI_ORIGIN', { required: true, originOnly: true, httpsInProduction: true });
  assertUrl(errors, env, 'API_ORIGIN', { required: false, originOnly: true, httpsInProduction: true });
  assertUrl(errors, env, 'GOOGLE_REDIRECT_URI', { required: false, httpsInProduction: true });
  assertUrl(errors, env, 'GITHUB_REDIRECT_URI', { required: false, httpsInProduction: true });
  assertOriginList(errors, env, 'UI_ALLOWED_ORIGINS');
  assertOriginList(errors, env, 'FRONTEND_ORIGINS');

  assertSecret(errors, env, 'JWT_SECRET', { minLength: 32 });
  assertSecret(errors, env, 'CSRF_SECRET', { minLength: 32 });
  assertSecret(errors, env, 'VIBE_MASTER_KEY', { minLength: 64, hexBytes: 32 });
  assertSecret(errors, env, 'SELINA_ACTION_GRANT_SECRET', { minLength: 32 });

  if (providerAliases.length > 0 && !providerAliases.some(key => env[key])) {
    errors.push(`One provider key is required for active provider ${activeProvider}: ${providerAliases.join(' or ')}`);
  }

  if (activeProvider === 'freellmapi') {
    assertUrl(errors, env, 'FREELLMAPI_BASE_URL', { required: true });
  }

  const cookieSameSite = String(env.AUTH_COOKIE_SAME_SITE || env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  if (cookieSameSite && !SAME_SITE_VALUES.includes(cookieSameSite)) {
    errors.push('AUTH_COOKIE_SAME_SITE/COOKIE_SAME_SITE must be one of: strict, lax, none');
  }

  const apiOrigin = normalizeOrigin(env.API_ORIGIN);
  const uiOrigins = collectOrigins(env);
  if (apiOrigin && uiOrigins.length > 0 && uiOrigins.some(origin => origin !== apiOrigin)) {
    if (cookieSameSite && cookieSameSite !== 'none') {
      errors.push('Split UI/API origins require AUTH_COOKIE_SAME_SITE=none for credentialed browser auth');
    }
  }

  if (errors.length > 0) {
    const errorMsg = `Invalid production environment configuration: ${errors.join('; ')}`;
    logger.error('Env', errorMsg);
    throw new Error(errorMsg);
  }
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
    hasApiOrigin: !!env.API_ORIGIN,
    hasGeminiKey: !!env.GEMINI_API_KEY,
    hasNimKey: !!(env.NIM_API_KEY || env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY),
  });

  if (env.NODE_ENV === 'production') {
    validateProductionEnvironment(env);
  }

  return parsed.data;
}
