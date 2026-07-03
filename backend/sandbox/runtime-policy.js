export const DISABLED_SANDBOX_PROVIDER = 'disabled';

export function normalizeSandboxProviderName(providerName = DISABLED_SANDBOX_PROVIDER) {
  const normalized = String(providerName || DISABLED_SANDBOX_PROVIDER).trim().toLowerCase();
  if (['disabled', 'off', 'none', 'false'].includes(normalized)) return DISABLED_SANDBOX_PROVIDER;
  if (['docker', 'local', 'local-docker'].includes(normalized)) return 'docker-local';
  if (['e2b', 'vibekit', 'e2b-vibekit', 'vibex'].includes(normalized)) return 'e2b-vibekit';
  return normalized;
}

export function resolveDefaultSandboxProvider(env = process.env) {
  if (env.SELINA_SANDBOX_PROVIDER) {
    return normalizeSandboxProviderName(env.SELINA_SANDBOX_PROVIDER);
  }

  // Production must fail closed. Render/GHCR runtime images intentionally do not
  // carry Docker, and blindly defaulting to docker-local makes readiness and tool
  // execution behave unpredictably.
  if (env.NODE_ENV === 'production') {
    return DISABLED_SANDBOX_PROVIDER;
  }

  return 'docker-local';
}

export function isSandboxExplicitlyEnabled(env = process.env) {
  return normalizeSandboxProviderName(resolveDefaultSandboxProvider(env)) !== DISABLED_SANDBOX_PROVIDER;
}
