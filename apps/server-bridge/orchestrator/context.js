/**
 * SharedContext — Neural State Management (v3.2)
 * 
 * Provides a persistent context store that is shared across expert transitions.
 * Prevents context loss when shifting from Planning -> Coding -> Debugging.
 */
export class SharedContext {
  constructor() {
    this.history = []; // Unified conversation history
    this.astCache = new Map(); // path -> symbols/structure
    this.fileCache = new Map(); // path -> content snippets
    this.sessionState = {
      currentGoal: null,
      completedSteps: [],
      pendingActions: [],
      decisions: [],
      variables: {}, // Shared variables between expert tools
    };
  }

  /**
   * Append a message to the shared history.
   */
  addMessage(role, content) {
    this.history.push({ role, parts: [{ text: content }] });
    // BUG #6 FIX: Gemini's startChat() requires history[0].role === 'user'.
    // A naive slice(-10) can land on a 'model' turn if history has odd length,
    // causing a 400 "Contents must start with role 'user'" error from the API.
    // We walk forward from the slice point to the first user turn.
    if (this.history.length > 20) {
      const slice = this.history.slice(-10);
      const firstUser = slice.findIndex(m => m.role === 'user');
      this.history = firstUser > 0 ? slice.slice(firstUser) : slice;
    }
  }

  /**
   * Record a decision or step completion.
   */
  recordProgress(step, type = 'step') {
    if (type === 'decision') {
      this.sessionState.decisions.push(step);
    } else {
      this.sessionState.completedSteps.push(step);
    }
  }

  /**
   * Get a summary of the current session state for prompt injection.
   */
  getSummary() {
    return `
Goal: ${this.sessionState.currentGoal || 'None'}
Completed: ${this.sessionState.completedSteps.join(', ') || 'None'}
Decisions: ${this.sessionState.decisions.join(', ') || 'None'}
    `.trim();
  }
}

