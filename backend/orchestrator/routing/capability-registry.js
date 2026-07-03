import { isModelAffectedByMigration, PROVIDER_MIGRATION_HINTS } from './provider-migrations.js';

export const SELINA_CAPABILITIES = {
  fast: {
    description: 'Low-latency control-plane calls: routing, summarization, short decisions.',
    strategy: 'fastest',
    maxTokens: 800,
    temperature: 0.2,
    timeoutMs: 8000,
    preferredKeywords: [
      'gemini flash',
      'flash-lite',
      'llama 3.1 8b',
      'llama 3.3',
      'glm flash',
      'compound mini',
      'groq'
    ],
    avoidKeywords: [
      'slow cold-start',
      'preview removed',
      'deprecated',
      'safeguard'
    ],
  },
  coding: {
    description: 'Code generation, refactoring, bug fixing, tests.',
    strategy: 'balanced',
    maxTokens: 4000,
    temperature: 0.15,
    timeoutMs: 15000,
    preferredKeywords: [
      'coder',
      'qwen',
      'codestral',
      'devstral',
      'deepseek',
      'kimi',
      'gemini flash'
    ],
    avoidKeywords: [
      'safeguard',
      'embedding',
      'image',
      'audio',
      'preview removed',
      'deprecated'
    ],
  },
  large_context: {
    description: 'Large repo/file context, multi-file analysis, long summaries.',
    strategy: 'reliable',
    maxTokens: 7000,
    temperature: 0.2,
    timeoutMs: 22000,
    preferredKeywords: [
      'gemini',
      'mistral large',
      'minimax',
      'kimi',
      'llama 4',
      'deepseek',
      'qwen3-coder',
      'gemma 4'
    ],
    avoidKeywords: [
      '8b',
      'nano',
      'micro',
      'small',
      'safeguard',
      'slow cold-start',
      'deprecated'
    ],
  },
  reasoning: {
    description: 'Architecture, security, root-cause analysis, hard reasoning.',
    strategy: 'smartest',
    maxTokens: 5000,
    temperature: 0.2,
    timeoutMs: 20000,
    preferredKeywords: [
      'mistral large',
      'magistral',
      'deepseek',
      'kimi',
      'nemotron',
      'reasoning',
      'llama 4',
      'minimax'
    ],
    avoidKeywords: [
      'safeguard',
      'micro',
      'nano',
      'embedding',
      'deprecated'
    ],
  },
  json_strict: {
    description: 'Structured JSON, tool arguments, state transitions.',
    strategy: 'reliable',
    maxTokens: 700,
    temperature: 0,
    timeoutMs: 8000,
    preferredKeywords: [
      'gemini flash',
      'glm flash',
      'qwen',
      'llama',
      'groq'
    ],
    avoidKeywords: [
      'creative',
      'safeguard',
      'unstable',
      'preview removed',
      'deprecated'
    ],
  },
  smoke_test: {
    description: 'Tiny model availability checks only.',
    strategy: 'fastest',
    maxTokens: 80,
    temperature: 0,
    timeoutMs: 6000,
    preferredKeywords: [
      'gemini flash',
      'qwen',
      'codestral',
      'glm flash',
      'llama'
    ],
    avoidKeywords: [
      'slow cold-start',
      'deprecated',
      'removed'
    ],
  },
};

export const DEFAULT_CAPABILITY = 'fast';

export function normalizeCapability(name) {
  return SELINA_CAPABILITIES[name] ? name : DEFAULT_CAPABILITY;
}

export function getCapabilityProfile(name) {
  return SELINA_CAPABILITIES[normalizeCapability(name)];
}

export function scoreModelForCapability(modelLike, capabilityName) {
  const profile = getCapabilityProfile(capabilityName);
  let score = 0;

  if (!modelLike) return -100;

  let text = '';
  let status = 'available';
  let successRate = 100;
  let avgLatencyMs = 2000;
  let enabled = true;

  if (typeof modelLike === 'string') {
    text = modelLike.toLowerCase();
  } else {
    text = `${modelLike.provider || modelLike.platform || ''} ${modelLike.displayName || modelLike.modelId || ''}`.toLowerCase();
    status = (modelLike.status || 'available').toLowerCase();
    successRate = modelLike.successRate !== undefined ? modelLike.successRate : 100;
    avgLatencyMs = modelLike.avgLatencyMs !== undefined ? modelLike.avgLatencyMs : 2000;
    enabled = modelLike.enabled !== undefined ? modelLike.enabled : true;
  }

  if (profile.preferredKeywords.some(kw => text.includes(kw.toLowerCase()))) score += 10;
  if (profile.avoidKeywords.some(kw => text.includes(kw.toLowerCase()))) score -= 10;

  if (successRate >= 80) score += 5;
  if (successRate < 60) score -= 8;
  if (avgLatencyMs <= 5000) score += 5;
  if (avgLatencyMs > 15000) score -= 5;

  if (['rate_limited', 'invalid', 'error', 'unavailable', 'deprecated', 'removed'].includes(status)) {
    score -= 20;
  }
  if (enabled === false) {
    score -= 20;
  }

  if (isModelAffectedByMigration(modelLike)) {
    score -= 15;
  }

  const matchesReplacement = PROVIDER_MIGRATION_HINTS.some(hint =>
    hint.replacementKeywords.some(kw => text.includes(kw.toLowerCase()))
  );
  if (matchesReplacement) {
    score += 8;
  }

  return score;
}

export function rankModelsForCapability(models, capabilityName) {
  if (!Array.isArray(models)) return [];
  return [...models].sort((a, b) => {
    return scoreModelForCapability(b, capabilityName) - scoreModelForCapability(a, capabilityName);
  });
}
