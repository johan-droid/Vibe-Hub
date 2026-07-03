import { logger } from '../../utils/detailed-logger.js';
import { getProviderSnapshot } from './provider-budget-manager.js';

export async function getFreeLLMAPIStatusSnapshot() {
  const baseUrl = process.env.FREELLMAPI_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.FREELLMAPI_API_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return { available: false, reason: 'not_configured', warnings: [] };
  }

  // Construct admin base URL (remove /v1 or similar path suffix)
  const adminUrl = new URL(baseUrl).origin;

  const fetchAdminRoute = async (path) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${adminUrl}${path}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.status === 401 || response.status === 403) {
        throw new Error('admin_auth_required');
      }
      if (!response.ok) {
        throw new Error(`status_${response.status}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    const [health, fallback, byPlatform, byModel] = await Promise.allSettled([
      fetchAdminRoute('/api/health'),
      fetchAdminRoute('/api/fallback/token-usage'),
      fetchAdminRoute('/api/analytics/by-platform?range=24h'),
      fetchAdminRoute('/api/analytics/by-model?range=24h')
    ]);

    // If all failed because of auth, fail gracefully
    const hasAuthError = [health, fallback, byPlatform, byModel].some(
      r => r.status === 'rejected' && r.reason?.message === 'admin_auth_required'
    );

    if (hasAuthError) {
      return { available: false, reason: 'admin_auth_required', warnings: ['Admin token required for preflight observability'] };
    }

    const available = health.status === 'fulfilled';
    const models = []; // Construct simulated models array if needed by orchestrator based on platform response

    if (byPlatform.status === 'fulfilled' && byPlatform.value?.platforms) {
        Object.keys(byPlatform.value.platforms).forEach(platformName => {
            models.push({
               provider: platformName,
               status: 'available',
               successRate: 100 // could be extracted if API provided it
            });
        });
    }

    return {
      available,
      health: health.status === 'fulfilled' ? health.value : null,
      fallbackUsage: fallback.status === 'fulfilled' ? fallback.value : null,
      platforms: byPlatform.status === 'fulfilled' ? byPlatform.value : null,
      modelsByProvider: byModel.status === 'fulfilled' ? byModel.value : null,
      models,
      localProviders: getProviderSnapshot(),
      warnings: []
    };
  } catch (error) {
    logger.warn('FreeLLMAPI_Admin', `Preflight failed: ${error.message}`);
    return { available: false, reason: error.message, warnings: [] };
  }
}
