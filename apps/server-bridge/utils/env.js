import { z } from 'zod';

const optionalUrl = z.string().url().or(z.literal('')).optional();

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: optionalUrl,
  JWT_SECRET: z.string().optional(),
  CSRF_SECRET: z.string().optional(),
  UI_ORIGIN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SENTRY_DSN: optionalUrl,
});

export function validateEnvironment(env = process.env) {
  const effectiveEnv = {
    ...env,
    CSRF_SECRET: env.CSRF_SECRET || env.JWT_SECRET,
  };

  const parsed = envSchema.safeParse(effectiveEnv);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
  }

  if (env.NODE_ENV === 'production') {
    const missing = ['DATABASE_URL', 'JWT_SECRET', 'UI_ORIGIN']
      .filter(key => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }

    if (!env.CSRF_SECRET && env.JWT_SECRET) {
      env.CSRF_SECRET = env.JWT_SECRET;
      console.warn('CSRF_SECRET is not set; falling back to JWT_SECRET. Configure a dedicated CSRF_SECRET for stronger secret isolation.');
    }
  }

  return parsed.data;
}
