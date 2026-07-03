import logger from '../utils/detailed-logger.js';

class OpsConfig {
  constructor() {
    this.emergencyRateLimitEnabled = false;
    this.rateLimitMaxAgent = null;
    this.concurrencyLimitOverride = null;
    this.llmProviderOverride = null;
    this.registeredWorkers = [];
  }

  registerWorkers(workers = []) {
    this.registeredWorkers = workers;
    logger.info('OpsConfig', `Registered ${workers.length} active queue workers for live operations.`);
  }

  async updateConfig(updates = {}) {
    logger.warn('OpsConfig', 'Applying live operational updates:', updates);

    if (updates.emergencyRateLimitEnabled !== undefined) {
      this.emergencyRateLimitEnabled = !!updates.emergencyRateLimitEnabled;
    }

    if (updates.rateLimitMaxAgent !== undefined) {
      this.rateLimitMaxAgent = updates.rateLimitMaxAgent === null ? null : Number.parseInt(updates.rateLimitMaxAgent, 10);
    }

    if (updates.llmProviderOverride !== undefined) {
      this.llmProviderOverride = updates.llmProviderOverride;
    }

    if (updates.concurrencyLimitOverride !== undefined) {
      const parsedConcurrency = updates.concurrencyLimitOverride === null ? null : Number.parseInt(updates.concurrencyLimitOverride, 10);
      this.concurrencyLimitOverride = parsedConcurrency;

      if (parsedConcurrency !== null && this.registeredWorkers.length > 0) {
        for (const worker of this.registeredWorkers) {
          try {
            logger.warn('OpsConfig', `Live adjusting concurrency on BullMQ worker '${worker.name || 'queue'}' to ${parsedConcurrency}`);
            worker.concurrency = parsedConcurrency;
          } catch (err) {
            logger.error('OpsConfig', `Failed to dynamically adjust concurrency for worker: ${err.message}`);
          }
        }
      }
    }

    logger.info('OpsConfig', 'Dynamic operations configuration updated successfully.', {
      emergencyRateLimitEnabled: this.emergencyRateLimitEnabled,
      rateLimitMaxAgent: this.rateLimitMaxAgent,
      concurrencyLimitOverride: this.concurrencyLimitOverride,
      llmProviderOverride: this.llmProviderOverride,
    });

    return this.getState();
  }

  getState() {
    return {
      emergencyRateLimitEnabled: this.emergencyRateLimitEnabled,
      rateLimitMaxAgent: this.rateLimitMaxAgent,
      concurrencyLimitOverride: this.concurrencyLimitOverride,
      llmProviderOverride: this.llmProviderOverride,
      workerCount: this.registeredWorkers.length,
    };
  }
}

export const opsConfig = new OpsConfig();
