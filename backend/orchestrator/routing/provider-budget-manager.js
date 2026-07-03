import { normalizeProviderName, getProviderCapability, getProviderTier } from './provider-capabilities.js';

class ProviderBudgetManager {
  constructor() {
    this.providers = new Map();
  }

  _getOrCreate(providerName) {
    if (!this.providers.has(providerName)) {
      this.providers.set(providerName, {
        requests: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        recent429: 0,
        recent401: 0,
        recent404: 0,
        recent503: 0,
        timeoutCount: 0,
        lastFailureAt: null,
        cooldownUntil: null
      });
    }
    return this.providers.get(providerName);
  }

  recordProviderResult({ capability, routedVia, provider, status, success, durationMs, fallbackAttempts, error }) {
    let pName = provider || (routedVia ? routedVia.split('/')[0] : null);
    if (!pName) return;

    pName = normalizeProviderName(pName);
    const stats = this._getOrCreate(pName);

    stats.requests++;

    if (success) {
      stats.successes++;
      stats.avgLatencyMs = stats.avgLatencyMs === 0
        ? durationMs
        : (stats.avgLatencyMs * 0.8) + (durationMs * 0.2); // EWMA
    } else {
      stats.failures++;
      stats.lastFailureAt = Date.now();

      const applyCooldown = (minutes) => {
        stats.cooldownUntil = Date.now() + (minutes * 60 * 1000);
      };

      if (status === 429) {
        stats.recent429++;
        applyCooldown(10);
      } else if (status === 401 || status === 403) {
        stats.recent401++;
        applyCooldown(60);
      } else if (status === 404) {
        stats.recent404++;
        applyCooldown(60);
      } else if (status === 503 || status === 502) {
        stats.recent503++;
        applyCooldown(5);
      } else if (status === 408 || error?.message?.includes('timeout') || error?.message?.includes('aborted')) {
        stats.timeoutCount++;
        applyCooldown(3);
      }
    }
  }

  getProviderSnapshot() {
    const snapshot = {};
    for (const [provider, stats] of this.providers.entries()) {
      snapshot[provider] = { ...stats };
    }
    return snapshot;
  }

  getProviderScore(provider, capability) {
    const pName = normalizeProviderName(provider);
    const stats = this.providers.get(pName);
    const profile = getProviderCapability(capability);
    const tier = getProviderTier(profile, pName);

    let score = 50;

    if (tier === 'primary') score += 20;
    else if (tier === 'fallback') score += 10;
    else if (tier === 'emergency') score -= 10;

    if (!stats) return score; // No history, return base tier score

    const successRate = stats.requests > 0 ? (stats.successes / stats.requests) * 100 : 100;

    if (successRate >= 80) score += 15;
    if (successRate < 60 && stats.requests >= 3) score -= 20;

    if (stats.avgLatencyMs > 0) {
      if (stats.avgLatencyMs <= 5000) score += 10;
      else if (stats.avgLatencyMs > 12000) score -= 10;
    }

    if (stats.cooldownUntil && Date.now() < stats.cooldownUntil) {
      score -= 25;
    }

    if (stats.recent429 > 0) score -= 15;
    if (stats.recent401 > 0) score -= 15;
    if (stats.recent404 > 0) score -= 10;
    if (stats.recent503 > 0) score -= 10;
    if (stats.timeoutCount > 0) score -= 8;

    return score;
  }

  shouldAvoidProvider(provider) {
    const pName = normalizeProviderName(provider);
    const stats = this.providers.get(pName);
    if (!stats) return false;
    if (stats.cooldownUntil && Date.now() < stats.cooldownUntil) return true;
    return false;
  }

  reset() {
    this.providers.clear();
  }
}

const budgetManager = new ProviderBudgetManager();

export function recordProviderResult(args) {
  budgetManager.recordProviderResult(args);
}

export function getProviderSnapshot() {
  return budgetManager.getProviderSnapshot();
}

export function getProviderScore(provider, capability) {
  return budgetManager.getProviderScore(provider, capability);
}

export function rankProvidersForCapability(capability) {
  const profile = getProviderCapability(capability);
  if (!profile) return [];

  const allProviders = new Set([
    ...(profile.primaryProviders || []),
    ...(profile.fallbackProviders || []),
    ...(profile.emergencyProviders || []),
    ...Array.from(budgetManager.providers.keys())
  ]);

  const ranked = Array.from(allProviders)
    .map(provider => ({
      provider,
      score: getProviderScore(provider, capability),
      isCoolingDown: budgetManager.shouldAvoidProvider(provider)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked;
}

export function shouldAvoidProvider(provider) {
  return budgetManager.shouldAvoidProvider(provider);
}

export function resetProviderBudgetManagerForTests() {
  budgetManager.reset();
}
