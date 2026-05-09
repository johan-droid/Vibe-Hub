export class SolutionsLedger {
  static recordFailure(taskId, message) {
    console.error(`[SolutionsLedger] Task ${taskId} FAILED: ${message}`);
  }
}
