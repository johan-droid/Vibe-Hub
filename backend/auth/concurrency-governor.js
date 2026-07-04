/**
 * @fileoverview backend/auth/concurrency-governor.js
 * @module ConcurrencyGovernor
 * @description In-memory concurrency governance enforcing a maximum of 3 concurrent agent runs per user.
 * Includes automated timeout protection to reclaim dangling leases and prevent resource exhaustion.
 */

// userId -> Set of active runIds
const activeUserRuns = new Map();

// Track run creation timestamps to handle cleanup
const leaseTimeouts = new Map();

const MAX_CONCURRENT_RUNS = Math.max(1, Number.parseInt(process.env.MAX_CONCURRENT_AGENT_RUNS || '3', 10));
const CONCURRENCY_RETRY_AFTER_SECONDS = Math.max(1, Number.parseInt(process.env.CONCURRENCY_RETRY_AFTER_SECONDS || '30', 10));
const LEASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max per agent run before auto-release

/**
 * Attempts to acquire an execution slot for a user run.
 * @param {string} userId 
 * @param {string} runId 
 * @returns {boolean} true if slot acquired, false if concurrency limit exceeded
 */
export function acquireRun(userId, runId) {
  if (!userId || !runId) return false;

  let runs = activeUserRuns.get(userId);
  if (!runs) {
    runs = new Set();
    activeUserRuns.set(userId, runs);
  }

  // Enforce the limit
  if (runs.size >= MAX_CONCURRENT_RUNS && !runs.has(runId)) {
    console.warn(`[Concurrency] User ${userId} exceeded concurrency limit of ${MAX_CONCURRENT_RUNS}. Blocked run ${runId}.`);
    return false;
  }

  runs.add(runId);

  // Set auto-release timeout in case of orphan connections
  if (leaseTimeouts.has(runId)) {
    clearTimeout(leaseTimeouts.get(runId));
  }
  
  const timeout = setTimeout(() => {
    console.warn(`[Concurrency] Lease auto-released for run ${runId} of user ${userId} after timeout.`);
    releaseRun(userId, runId);
  }, LEASE_TIMEOUT_MS);
  
  leaseTimeouts.set(runId, timeout);

  return true;
}

/**
 * Releases an execution slot for a user run.
 * @param {string} userId 
 * @param {string} runId 
 */
export function releaseRun(userId, runId) {
  if (!userId || !runId) return;

  const runs = activeUserRuns.get(userId);
  if (runs) {
    runs.delete(runId);
    if (runs.size === 0) {
      activeUserRuns.delete(userId);
    }
  }

  const timeout = leaseTimeouts.get(runId);
  if (timeout) {
    clearTimeout(timeout);
    leaseTimeouts.delete(runId);
  }
}

/**
 * Gets the number of active runs for a user.
 * @param {string} userId 
 * @returns {number}
 */
export function getActiveRunCount(userId) {
  const runs = activeUserRuns.get(userId);
  return runs ? runs.size : 0;
}

export function getRunConcurrencyLimit() {
  return MAX_CONCURRENT_RUNS;
}

export function getConcurrencyRetryAfterSeconds() {
  return CONCURRENCY_RETRY_AFTER_SECONDS;
}

/**
 * Reset all slots (useful for test isolation)
 */
export function resetConcurrencyGovernor() {
  for (const timeout of leaseTimeouts.values()) {
    clearTimeout(timeout);
  }
  activeUserRuns.clear();
  leaseTimeouts.clear();
}
