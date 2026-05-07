const SUPPORTED_PROVIDERS = ['nim', 'openai', 'anthropic', 'qwen', 'gemini'];

const CODE_DOMAINS = new Set(['code', 'ui', 'git', 'architect', 'motion', 'artist']);
const DEBUG_DOMAINS = new Set(['debug', 'reviewer', 'security', 'creative']);

function normalizeProvider(provider) {
  const normalized = String(provider || '').trim().toLowerCase();
  return SUPPORTED_PROVIDERS.includes(normalized) ? normalized : null;
}

function configuredProviders(modelService) {
  const status = modelService.providerStatus();
  return SUPPORTED_PROVIDERS.filter(provider => status[provider]?.configured);
}

function defaultProviderForDomain(domain, env = process.env) {
  if (domain === 'manager') return normalizeProvider(env.SELINA_EXPERT_MANAGER_PROVIDER) || 'nim';
  if (DEBUG_DOMAINS.has(domain)) return normalizeProvider(env.SELINA_EXPERT_DEBUG_PROVIDER) || 'nim';
  if (CODE_DOMAINS.has(domain)) return normalizeProvider(env.SELINA_EXPERT_CODE_PROVIDER) || 'nim';
  return normalizeProvider(env.SELINA_EXPERT_CODE_PROVIDER) || 'nim';
}

function fallbackOrder(primary, env = process.env) {
  const configured = String(env.SELINA_PROVIDER_FALLBACKS || env.SELINA_MODEL_FALLBACKS || '')
    .split(',')
    .map(normalizeProvider)
    .filter(Boolean);
  const defaults = ['nim', 'openai', 'anthropic', 'qwen', 'gemini'];
  return [primary, ...configured, ...defaults]
    .filter(Boolean)
    .filter((provider, index, all) => all.indexOf(provider) === index);
}

export function resolveExpertProfile({
  domain = 'code',
  taskType = null,
  risk = 'normal',
  autonomyLevel = 2,
  effortLevel = 'standard',
  env = process.env,
  modelService,
} = {}) {
  let primary = defaultProviderForDomain(domain, env);

  if (domain === 'manager') {
    const highRisk = ['security', 'execution', 'write', 'browser', 'github', 'mcp'].includes(String(risk).toLowerCase());
    if (highRisk || Number(autonomyLevel) <= 1 || effortLevel === 'deep') {
      primary = normalizeProvider(env.SELINA_EXPERT_MANAGER_PROVIDER) || primary;
    }
    if (String(taskType || '').toLowerCase().includes('review')) {
      primary = normalizeProvider(env.SELINA_EXPERT_DEBUG_PROVIDER) || primary;
    }
  }

  const available = modelService ? configuredProviders(modelService) : [];
  const order = fallbackOrder(primary, env);
  const provider = available.length
    ? order.find(candidate => available.includes(candidate)) || available[0]
    : primary;
  const profile = modelService?.selectProfile({ provider, domain, effortLevel }) || { provider };

  return {
    expert: domain,
    provider,
    model: profile.model || null,
    fallbackOrder: order.filter(candidate => candidate !== provider),
    capabilities: capabilitiesFor(domain),
    health: available.length ? 'configured' : 'unconfigured',
  };
}

export function capabilitiesFor(domain) {
  if (domain === 'manager') return ['routing', 'risk_assessment', 'planning', 'delegation'];
  if (DEBUG_DOMAINS.has(domain)) return ['debugging', 'review', 'security_critique', 'explanation'];
  if (domain === 'ui') return ['frontend', 'ux', 'monaco_workspace', 'visual_review'];
  if (domain === 'git') return ['git', 'github', 'branching', 'conflict_detection'];
  return ['coding', 'refactor', 'ide_workflow', 'surgical_edits'];
}

export function buildExpertDiagnostics(modelService, env = process.env) {
  const domains = ['manager', 'code', 'ui', 'debug', 'reviewer', 'security', 'git', 'creative'];
  return {
    strategy: 'provider-moe',
    localExecution: 'local-docker-only',
    experts: domains.map(domain => resolveExpertProfile({ domain, env, modelService })),
  };
}
