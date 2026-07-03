export const SELINA_PROVIDER_CAPABILITIES = {
  fast: {
    description: 'Low-latency control-plane calls: routing decisions, short summaries, tool choice.',
    strategy: 'fastest',
    maxTokens: Number.parseInt(process.env.SELINA_FAST_MAX_TOKENS || '800', 10),
    temperature: Number.parseFloat(process.env.SELINA_FAST_TEMPERATURE || '0.2'),
    timeoutMs: Number.parseInt(process.env.SELINA_FAST_TIMEOUT_MS || '8000', 10),

    primaryProviders: ['groq', 'cerebras', 'zai', 'cloudflare'],
    fallbackProviders: ['google', 'mistral', 'openrouter'],
    emergencyProviders: ['pollinations', 'llm7', 'kilo'],
  },

  coding: {
    description: 'Code generation, repo edits, bug fixes, tests, refactors.',
    strategy: 'balanced',
    maxTokens: Number.parseInt(process.env.SELINA_CODING_MAX_TOKENS || '4000', 10),
    temperature: Number.parseFloat(process.env.SELINA_CODING_TEMPERATURE || '0.15'),
    timeoutMs: Number.parseInt(process.env.SELINA_CODING_TIMEOUT_MS || '15000', 10),

    primaryProviders: ['mistral', 'cloudflare', 'groq'],
    fallbackProviders: ['openrouter', 'cerebras', 'google', 'huggingface'],
    emergencyProviders: ['llm7', 'ollama', 'pollinations'],
  },

  large_context: {
    description: 'Large repo/file context, multi-file analysis, long summaries.',
    strategy: 'reliable',
    maxTokens: Number.parseInt(process.env.SELINA_LARGE_CONTEXT_MAX_TOKENS || '7000', 10),
    temperature: Number.parseFloat(process.env.SELINA_LARGE_CONTEXT_TEMPERATURE || '0.2'),
    timeoutMs: Number.parseInt(process.env.SELINA_LARGE_CONTEXT_TIMEOUT_MS || '22000', 10),

    primaryProviders: ['google', 'mistral', 'cloudflare'],
    fallbackProviders: ['openrouter', 'github', 'cerebras', 'huggingface'],
    emergencyProviders: ['ollama', 'llm7'],
  },

  reasoning: {
    description: 'Architecture, security, root-cause analysis, complex planning.',
    strategy: 'smartest',
    maxTokens: Number.parseInt(process.env.SELINA_REASONING_MAX_TOKENS || '5000', 10),
    temperature: Number.parseFloat(process.env.SELINA_REASONING_TEMPERATURE || '0.2'),
    timeoutMs: Number.parseInt(process.env.SELINA_REASONING_TIMEOUT_MS || '20000', 10),

    primaryProviders: ['mistral', 'google', 'github'],
    fallbackProviders: ['openrouter', 'cloudflare', 'cerebras', 'huggingface'],
    emergencyProviders: ['ollama', 'llm7'],
  },

  json_strict: {
    description: 'Structured JSON, tool arguments, state transitions, schemas.',
    strategy: 'reliable',
    maxTokens: Number.parseInt(process.env.SELINA_JSON_STRICT_MAX_TOKENS || '700', 10),
    temperature: Number.parseFloat(process.env.SELINA_JSON_STRICT_TEMPERATURE || '0'),
    timeoutMs: Number.parseInt(process.env.SELINA_JSON_STRICT_TIMEOUT_MS || '8000', 10),

    primaryProviders: ['google', 'groq', 'cloudflare'],
    fallbackProviders: ['zai', 'cerebras', 'mistral', 'openrouter'],
    emergencyProviders: ['llm7', 'pollinations'],
  },

  smoke_test: {
    description: 'Tiny model availability checks only.',
    strategy: 'fastest',
    maxTokens: Number.parseInt(process.env.SELINA_SMOKE_TEST_MAX_TOKENS || '80', 10),
    temperature: Number.parseFloat(process.env.SELINA_SMOKE_TEST_TEMPERATURE || '0'),
    timeoutMs: Number.parseInt(process.env.SELINA_SMOKE_TEST_TIMEOUT_MS || '6000', 10),

    primaryProviders: ['groq', 'cerebras', 'google'],
    fallbackProviders: ['cloudflare', 'mistral', 'openrouter'],
    emergencyProviders: ['pollinations', 'llm7', 'kilo'],
  },
};

export const DEFAULT_SELINA_CAPABILITY = 'fast';

export function normalizeCapability(name) {
  return SELINA_PROVIDER_CAPABILITIES[name] ? name : DEFAULT_SELINA_CAPABILITY;
}

export function getProviderCapability(name) {
  return SELINA_PROVIDER_CAPABILITIES[normalizeCapability(name)];
}

export function flattenProviders(profile) {
  return [
    ...(profile.primaryProviders || []),
    ...(profile.fallbackProviders || []),
    ...(profile.emergencyProviders || []),
  ];
}

export function getProviderTier(profile, provider) {
  const normalized = String(provider || '').toLowerCase();
  if ((profile.primaryProviders || []).includes(normalized)) return 'primary';
  if ((profile.fallbackProviders || []).includes(normalized)) return 'fallback';
  if ((profile.emergencyProviders || []).includes(normalized)) return 'emergency';
  return 'unknown';
}

export function normalizeProviderName(provider) {
  const p = String(provider || '').toLowerCase();
  if (['z.ai', 'zai', 'zhipu'].includes(p)) return 'zai';
  if (['github models', 'github'].includes(p)) return 'github';
  if (['cloudflare workers ai', 'cloudflare'].includes(p)) return 'cloudflare';
  if (['mistral la plateforme', 'mistral'].includes(p)) return 'mistral';
  if (['nvidia nim', 'nvidia'].includes(p)) return 'nvidia';
  if (['ollama cloud', 'ollama'].includes(p)) return 'ollama';
  if (['kilo gateway', 'kilo'].includes(p)) return 'kilo';
  return p;
}
