import fetch from 'node-fetch'; // fallback if global fetch is unsupported in older runtimes
import logger from '../utils/detailed-logger.js';

export class SpotPreemptionError extends Error {
  constructor(message = 'Spot instance preemption initiated. Enqueuing for on-demand failover.') {
    super(message);
    this.name = 'SpotPreemptionError';
    this.isSpotPreemption = true;
  }
}

class SpotManager {
  constructor() {
    this.preempting = false;
    this.workers = [];
    this.pollInterval = null;
    this.metadataUrl = process.env.AWS_SPOT_METADATA_URL || 'http://169.254.169.254/latest/meta-data/spot/termination-time';
    this.gracePeriodMs = Number.parseInt(process.env.SPOT_GRACE_PERIOD_MS || '15000', 10);
  }

  initialize(workers = []) {
    this.workers = workers;
    
    const instanceType = (process.env.SELINA_INSTANCE_TYPE || 'spot').toLowerCase().trim();
    if (instanceType !== 'spot') {
      logger.info('SpotManager', `Instance type configured as '${instanceType}'. Skipping spot preemption active listeners.`);
      return;
    }

    logger.info('SpotManager', 'Initializing Spot Preemption Manager. Listening for preemption events...');

    // 1. Process Signal Listeners
    process.on('SIGTERM', () => this.handlePreemption('SIGTERM signal received'));
    process.on('SIGINT', () => this.handlePreemption('SIGINT signal received'));

    // 2. AWS Metadata Endpoint Polling (Simulated or Real)
    if (process.env.DISABLE_SPOT_METADATA_POLLING !== 'true') {
      this.startMetadataPolling();
    }
  }

  isPreempting() {
    return this.preempting;
  }

  startMetadataPolling() {
    // Poll every 10 seconds for spot preemption warnings
    const intervalMs = Number.parseInt(process.env.SPOT_POLL_INTERVAL_MS || '10000', 10);
    this.pollInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(this.metadataUrl, { 
          signal: controller.signal,
          headers: { 'Metadata-Flavor': 'Google' } // Google metadata compat
        });
        
        clearTimeout(timeoutId);

        if (response.status === 200) {
          const body = await response.text();
          this.handlePreemption(`Spot termination scheduled at: ${body.trim()}`);
        }
      } catch (err) {
        // Suppress connection errors as 169.254.169.254 is unreachable outside cloud envs
        if (process.env.DEBUG_SPOT_MANAGER === 'true') {
          logger.debug('SpotManager', `Spot metadata check returned: ${err.message}`);
        }
      }
    }, intervalMs);
  }

  async handlePreemption(reason) {
    if (this.preempting) return;
    this.preempting = true;

    logger.warn('SpotManager', `!!! SPOT PREEMPTION DETECTED !!! Reason: ${reason}`);

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // 1. Pause all active BullMQ queue consumers immediately so they don't fetch new work
    logger.info('SpotManager', 'Pausing active BullMQ workers...');
    for (const worker of this.workers) {
      try {
        if (worker && typeof worker.pause === 'function') {
          await worker.pause(true); // force pause immediately
          logger.info('SpotManager', `Worker ${worker.name || 'queue'} paused successfully.`);
        }
      } catch (err) {
        logger.error('SpotManager', `Failed to pause worker: ${err.message}`);
      }
    }

    // 2. Cooperative cancellation hook: alert active jobs or wait for grace period
    logger.info('SpotManager', `Grace period of ${this.gracePeriodMs}ms active. Allowing fast jobs to complete.`);
    
    // After the grace period, any remaining active tasks will be failed so they retry on on-demand
    setTimeout(() => {
      logger.warn('SpotManager', 'Grace period expired. Aborting remaining in-flight tasks.');
      // Force exit or let active preemption checks throw errors in worker loops
    }, this.gracePeriodMs);
  }

  /**
   * Cooperative preemption check helper
   */
  checkPreemption() {
    if (this.preempting) {
      throw new SpotPreemptionError();
    }
  }

  reset() {
    this.preempting = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

export const spotManager = new SpotManager();
