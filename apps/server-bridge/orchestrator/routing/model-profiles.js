export const MODEL_PROFILES = {
  fast: {
    model: process.env.SELINA_FAST_MODEL || 'auto',
    maxTokens: Number.parseInt(process.env.SELINA_FAST_MAX_TOKENS || '700', 10),
    temperature: Number.parseFloat(process.env.SELINA_FAST_TEMPERATURE || '0.2'),
    timeoutMs: Number.parseInt(process.env.SELINA_FAST_TIMEOUT_MS || '8000', 10),
    stream: false,
  },

  coding: {
    model: process.env.SELINA_CODING_MODEL || 'auto',
    maxTokens: Number.parseInt(process.env.SELINA_CODING_MAX_TOKENS || '2500', 10),
    temperature: Number.parseFloat(process.env.SELINA_CODING_TEMPERATURE || '0.15'),
    timeoutMs: Number.parseInt(process.env.SELINA_CODING_TIMEOUT_MS || '15000', 10),
    stream: false,
  },

  reasoning: {
    model: process.env.SELINA_REASONING_MODEL || 'auto',
    maxTokens: Number.parseInt(process.env.SELINA_REASONING_MAX_TOKENS || '3000', 10),
    temperature: Number.parseFloat(process.env.SELINA_REASONING_TEMPERATURE || '0.2'),
    timeoutMs: Number.parseInt(process.env.SELINA_REASONING_TIMEOUT_MS || '18000', 10),
    stream: false,
  },

  json_strict: {
    model: process.env.SELINA_JSON_MODEL || 'auto',
    maxTokens: Number.parseInt(process.env.SELINA_JSON_MAX_TOKENS || '600', 10),
    temperature: Number.parseFloat(process.env.SELINA_JSON_TEMPERATURE || '0'),
    timeoutMs: Number.parseInt(process.env.SELINA_JSON_TIMEOUT_MS || '8000', 10),
    stream: false,
  },

  smoke_test: {
    model: process.env.SELINA_SMOKE_MODEL || 'auto',
    maxTokens: Number.parseInt(process.env.SELINA_SMOKE_MAX_TOKENS || '80', 10),
    temperature: Number.parseFloat(process.env.SELINA_SMOKE_TEMPERATURE || '0'),
    timeoutMs: Number.parseInt(process.env.SELINA_SMOKE_TIMEOUT_MS || '6000', 10),
    stream: false,
  },
};

export const DEFAULT_PROFILE = 'fast';

export function getModelProfile(mode = DEFAULT_PROFILE) {
  return MODEL_PROFILES[mode] || MODEL_PROFILES[DEFAULT_PROFILE];
}

export function normalizeMode(mode) {
  if (!mode) return DEFAULT_PROFILE;
  return MODEL_PROFILES[mode] ? mode : DEFAULT_PROFILE;
}
