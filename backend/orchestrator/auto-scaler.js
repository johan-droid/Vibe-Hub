import { logger } from '../utils/detailed-logger.js';

class AutoScaler {
  constructor() {
    this.isDevStaging = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging';
    this.enabled = process.env.AUTO_SCALE_TO_ZERO_ENABLED === 'true' || this.isDevStaging;
    this.offHoursStart = Number.parseInt(process.env.OFF_HOURS_START || '20', 10); // 8:00 PM
    this.offHoursEnd = Number.parseInt(process.env.OFF_HOURS_END || '7', 10);     // 7:00 AM
    this.timezone = process.env.TIMEZONE || 'UTC';
    this.workers = [];
    this.checkInterval = null;
    this.isSleeping = false;
  }

  initialize(workers = []) {
    this.workers = workers;

    if (!this.enabled) {
      logger.info('AutoScaler', 'Auto-Scale to Zero is disabled (Not dev/staging or explicitly disabled).');
      return;
    }

    logger.info('AutoScaler', `Initializing Dev/Staging Auto-Scale to Zero. Off-hours: ${this.offHoursStart}:00 to ${this.offHoursEnd}:00 (${this.timezone}).`);
    
    // Perform initial state check
    this.evaluateState();

    // Check state every minute
    const oneMinuteMs = 60 * 1000;
    this.checkInterval = setInterval(() => {
      this.evaluateState();
    }, oneMinuteMs);
  }

  evaluateState() {
    const isOffHour = this.checkIfOffHour();

    if (isOffHour && !this.isSleeping) {
      this.sleep();
    } else if (!isOffHour && this.isSleeping) {
      this.wakeup();
    }
  }

  checkIfOffHour() {
    // Basic date translation supporting custom hour checking
    const now = new Date();
    
    // If timezone is UTC (default), we just use standard UTC hours
    let hour = now.getUTCHours();
    let day = now.getUTCDay(); // 0 is Sunday, 6 is Saturday

    // Check timezone offset if not UTC
    if (this.timezone !== 'UTC') {
      try {
        const localTimeStr = now.toLocaleString('en-US', { timeZone: this.timezone });
        const localDate = new Date(localTimeStr);
        hour = localDate.getHours();
        day = localDate.getDay();
      } catch (err) {
        logger.error('AutoScaler', `Invalid timezone configured: ${this.timezone}. Defaulting to UTC.`);
      }
    }

    // Weekends are entirely off-hours
    if (day === 0 || day === 6) {
      return true;
    }

    // Check hourly boundary
    if (this.offHoursStart > this.offHoursEnd) {
      // Over-night off hours (e.g. 21:00 PM to 6:00 AM)
      return hour >= this.offHoursStart || hour < this.offHoursEnd;
    } else {
      // Day-time off hours
      return hour >= this.offHoursStart && hour < this.offHoursEnd;
    }
  }

  async sleep() {
    logger.warn('AutoScaler', '=== OFF-HOURS DETECTED: AUTO-SCALING NON-PRODUCTION RESOURCES TO ZERO ===');
    this.isSleeping = true;

    if (this.workers.length === 0) {
      logger.info('AutoScaler', 'No active queues registered to sleep.');
      return;
    }

    for (const worker of this.workers) {
      try {
        logger.info('AutoScaler', `Pausing BullMQ worker '${worker.name || 'queue'}' to save polling CPU cycles.`);
        await worker.pause(true);
      } catch (err) {
        logger.error('AutoScaler', `Failed to pause queue: ${err.message}`);
      }
    }
  }

  async wakeup() {
    logger.warn('AutoScaler', '=== ACTIVE HOURS RESUMING: AUTO-SCALING UP SYSTEM RESOURCES ===');
    this.isSleeping = false;

    if (this.workers.length === 0) {
      return;
    }

    for (const worker of this.workers) {
      try {
        logger.info('AutoScaler', `Resuming BullMQ worker '${worker.name || 'queue'}' execution.`);
        await worker.resume();
      } catch (err) {
        logger.error('AutoScaler', `Failed to resume queue: ${err.message}`);
      }
    }
  }

  /**
   * Safe manual bypass / on-demand wake trigger for immediate task invocation
   */
  async triggerOnDemandWake() {
    if (this.isSleeping) {
      logger.info('AutoScaler', 'On-demand execution request received. Temporarily waking up workers...');
      await this.wakeup();
      
      // Auto-sleep again after 10 minutes if still within off-hours
      setTimeout(() => {
        if (this.checkIfOffHour()) {
          this.sleep().catch(err => {
            logger.error('AutoScaler', `Failed to transition back to sleep: ${err.message}`);
          });
        }
      }, 10 * 60 * 1000);
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const autoScaler = new AutoScaler();
