/**
 * SharedContext — Neural State Management (v3.2)
 * 
 * Provides a persistent context store that is shared across expert transitions.
 * Prevents context loss when shifting from Planning -> Coding -> Debugging.
 */
/**
 * A simple LRU Cache to prevent memory leaks in AST and File caches.
 */
class LRUCache extends Map {
  constructor(maxSize = 50) {
    super();
    this.maxSize = maxSize;
  }

  set(key, value) {
    if (super.has(key)) {
      super.delete(key);
    } else if (this.size >= this.maxSize) {
      // Remove oldest (first item in insertion order)
      const firstKey = this.keys().next().value;
      if (firstKey) super.delete(firstKey);
    }
    return super.set(key, value);
  }
}

export class SharedContext {
  constructor() {
    this.history = []; // Unified conversation history
    this.astCache = new LRUCache(100); // path -> symbols/structure
    this.fileCache = new LRUCache(50); // path -> content snippets
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
      if (firstUser !== -1) {
        this.history = slice.slice(firstUser);
      } else {
        // Fallback: search backwards through entire history to find the most recent user message
        const lastUser = this.history.findLastIndex(m => m.role === 'user');
        if (lastUser !== -1) {
          this.history = this.history.slice(lastUser);
        }
      }
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

/**
 * PromptOrchestrator — LLM Prompt Builder (V6)
 * 
 * Rigidly sections off context into:
 * 1. Immutable Organization Constraints (highest priority)
 * 2. User Environment Preferences (flexible)
 * 3. Deterministic Semantic Graph (exact code dependencies)
 * 4. Critical Execution Failures (rollback feedback)
 */
export class PromptOrchestrator {
  /**
   * Builds the core system instruction set. This never changes during a session.
   */
  static buildSystemPrompt(orgContext, userContext) {
    return `You are a SaaS-grade expert coding agent operating within strict architectural boundaries.

=== [IMMUTABLE ORGANIZATION CONSTRAINTS] ===
Deployment Target: ${orgContext.enforced_rules.deployment_target}
CI/CD Rules: ${orgContext.enforced_rules.ci_cd}
Linting Rules: ${JSON.stringify(orgContext.enforced_rules.linting)}

=== [USER ENVIRONMENT PREFERENCES] ===
Aesthetics: ${userContext.preferences.aesthetics}
Supported Locales: ${userContext.preferences.supported_locales.join(', ')}
Offline Mode Enforced: ${userContext.preferences.offline_mode}

CRITICAL DIRECTIVE: You must respect both Organization constraints and User preferences. If they conflict, Organization constraints take priority. NEVER hallucinate dependencies.
`;
  }

  /**
   * Builds the dynamic task prompt based on the AST Graph and the current State Machine loop.
   */
  static buildTaskPrompt(taskPrompt, astGraph, sandboxError = null) {
    let prompt = `=== [DETERMINISTIC SEMANTIC GRAPH] ===
Target File: ${astGraph.file}
Available Imports (DO NOT INVENT OTHERS): 
${astGraph.strict_imports.join('\n') || 'None'}

Current Exports: 
${astGraph.strict_exports.join('\n') || 'None'}

Internal Signatures:
${astGraph.internal_functions.join('\n') || 'None'}

=== [CURRENT TASK] ===
${taskPrompt}

Provide ONLY raw code. No markdown formatting, no explanations.
`;

    // The Antigravity Feedback Loop Injection
    if (sandboxError) {
      prompt += `
=== [CRITICAL EXECUTION FAILURE] ===
Your previous generation failed in the isolated sandbox.
Error Trace:
${sandboxError}

Analyze this failure. Fix the logic and output the corrected code. Do NOT repeat the previous error.
`;
    }

    return prompt;
  }
}

