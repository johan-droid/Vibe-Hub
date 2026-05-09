export class SolutionsLedger {
  constructor() {
    this.ledger = new Map();
  }

  recordFailure(taskId, attemptSummary) {
    if (!this.ledger.has(taskId)) {
      this.ledger.set(taskId, []);
    }
    this.ledger.get(taskId).push(attemptSummary);
  }

  getHistory(taskId) {
    const history = this.ledger.get(taskId);
    if (!history || history.length === 0) {
      return "No past failures.";
    }
    return history.join("\n");
  }
}
