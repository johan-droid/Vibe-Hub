import { recordTaskFailure, getTaskFailures } from '../db.js';

async function bestEffort(operation, fallback) {
  try {
    return await operation();
  } catch (err) {
    console.error('[SolutionsLedger] DB Error:', err.message);
    return fallback;
  }
}

export class SolutionsLedger {
  constructor() {
    // ledger is now persisted in DB
  }

  async recordFailure(taskId, attemptSummary, metadata = {}) {
    return bestEffort(
      () => recordTaskFailure(taskId, attemptSummary, metadata),
      null
    );
  }

  async getHistory(taskId) {
    const history = await bestEffort(
      () => getTaskFailures(taskId, 10),
      []
    );
    if (!history || history.length === 0) {
      return "No past failures.";
    }
    return history.join("\n");
  }

  async getLessons(taskId) {
    const history = await bestEffort(
      () => getTaskFailures(taskId, 3),
      []
    );
    return history;
  }

  static recordFailure(taskId, message) {
    console.error(`[SolutionsLedger] Task ${taskId} FAILED: ${message}`);
  }
}
