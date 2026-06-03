class QuotaGuard {
  constructor() {
    this.windows = new Map(); // mode -> { count, windowStart }
    this.cooldowns = new Map(); // mode|provider -> expiryTime
  }

  _getRateLimit(mode) {
    const envKey = `SELINA_${mode.toUpperCase()}_RPM`;
    const defaultLimits = {
      fast: 20,
      coding: 10,
      reasoning: 6,
      json_strict: 20,
      smoke_test: 5,
    };
    return Number.parseInt(process.env[envKey] || defaultLimits[mode] || 20, 10);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.cooldowns.entries()) {
      if (now > expiry) {
        this.cooldowns.delete(key);
      }
    }
    for (const [mode, windowData] of this.windows.entries()) {
      if (now - windowData.windowStart > 60000) {
        this.windows.delete(mode);
      }
    }
  }

  canCallMode(mode) {
    this._cleanup();
    const now = Date.now();

    // Check mode cooldown
    if (this.cooldowns.has(mode) && now < this.cooldowns.get(mode)) {
      return false;
    }

    // Check rate limit window
    const limit = this._getRateLimit(mode);
    const windowData = this.windows.get(mode) || { count: 0, windowStart: now };

    if (now - windowData.windowStart > 60000) {
      // Should have been cleaned up, but handle safely
      return true;
    }

    return windowData.count < limit;
  }

  assertCanCallMode(mode) {
    if (!this.canCallMode(mode)) {
      throw new Error(`Quota limit reached or in cooldown for mode: ${mode}`);
    }
  }

  recordRoutingResult(result) {
    this._cleanup();
    const now = Date.now();

    // Always increment usage count for the mode
    const mode = result.mode;
    if (mode) {
       const windowData = this.windows.get(mode) || { count: 0, windowStart: now };
       if (now - windowData.windowStart > 60000) {
           windowData.count = 1;
           windowData.windowStart = now;
       } else {
           windowData.count += 1;
       }
       this.windows.set(mode, windowData);
    }

    // Handle 429 rate limit
    if (result.status === 429 || (result.error && /rate limit|quota|too many requests/i.test(result.error))) {
      const cooldownSeconds = Number.parseInt(process.env.SELINA_PROVIDER_COOLDOWN_SECONDS || '600', 10);
      const cooldownExpiry = now + (cooldownSeconds * 1000);

      if (result.routedVia) {
        this.cooldowns.set(result.routedVia, cooldownExpiry);
      } else if (mode) {
        this.cooldowns.set(mode, cooldownExpiry);
      }
    }
  }

  getQuotaSnapshot() {
    this._cleanup();
    const snapshot = {
      windows: {},
      cooldowns: {}
    };
    for (const [k, v] of this.windows.entries()) {
      snapshot.windows[k] = { ...v };
    }
    for (const [k, v] of this.cooldowns.entries()) {
      snapshot.cooldowns[k] = v;
    }
    return snapshot;
  }

  resetQuotaGuardForTests() {
    this.windows.clear();
    this.cooldowns.clear();
  }
}

// Single process memory.
// Note: Production multi-instance deployments should move this to Redis later.
export const quotaGuard = new QuotaGuard();
