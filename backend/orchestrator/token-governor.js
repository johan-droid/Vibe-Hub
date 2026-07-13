import logger from '../utils/detailed-logger.js';
import { hardenSystemPrompt, wrapUserQuery } from './prompt-hardening.js';
import { enforceLlmRateLimit } from './cost-controls.js';
import { callOmniRoute } from './omniroute-client.js';

export class TokenBudgetExceededError extends Error {
  constructor(sessionId, usage, budget) {
    super(`Per-session token budget exceeded for '${sessionId}'. Usage: ${usage}, Budget: ${budget}.`);
    this.name = 'TokenBudgetExceededError';
    this.isTokenBudgetExceeded = true;
    this.sessionId = sessionId;
  }
}

// Kept for test compatibility — actual budget state lives in Redis via omniroute-client
export function getSessionUsage(_runId) { return 0; }
export function resetSessionUsage(_runId) { /* no-op — Redis TTL handles expiry */ }

export class TokenGovernor {
  /**
   * getCompute — unified entry point for all agent LLM calls.
   * taskComplexity and requiredRole are kept for API compat but routing
   * is now handled entirely by OmniRoute (model = 'auto' or configured model).
   */
  async getCompute(taskComplexity, requiredRole, apiCallFn, options = {}) {
    if (typeof apiCallFn !== 'function') {
      throw new TypeError('TokenGovernor.getCompute requires an API execution callback');
    }
    // Pass a single virtual 'omniroute' key. The actual model is resolved
    // inside callOmniRoute based on role via OMNIROUTE_PLANNER_MODEL / OMNIROUTE_WORKER_MODEL.
    const omniRole = requiredRole === 'planner' ? 'planner' : 'worker';
    return apiCallFn('omniroute', omniRole, 'omniroute');
  }

  async requestModel(taskComplexity, requiredRole) {
    return async (systemPrompt, userPrompt, options = {}) => {
      return callRoutedTextModel('omniroute', requiredRole, systemPrompt, userPrompt, { ...options });
    };
  }

  static async getCompute(taskComplexity, requiredRole, apiCallFn, options = {}) {
    return new TokenGovernor().getCompute(taskComplexity, requiredRole, apiCallFn, options);
  }
}

/**
 * callRoutedTextModel — backward-compatible shim.
 * 'key' and 'model' params are ignored; OmniRoute handles provider selection.
 */
export async function callRoutedTextModel(_key, modelOrRole, systemPrompt, userPrompt, options = {}) {
  const hardenedSystem = hardenSystemPrompt(systemPrompt);
  const wrappedUser    = wrapUserQuery(userPrompt);
  const userId  = options.userId || 'anonymous';
  const sessionId = options.sessionId || options.runId || options.requestId || null;

  enforceLlmRateLimit({ userId });

  // Determine role from the model param (token-governor used to pass model strings;
  // now 'planner' maps to OMNIROUTE_PLANNER_MODEL, everything else to WORKER_MODEL)
  const role = (modelOrRole === 'planner' || options.role === 'planner') ? 'planner' : 'worker';

  try {
    return await callOmniRoute({
      systemPrompt: hardenedSystem,
      userPrompt:   wrappedUser,
      role,
      jsonMode:          options.jsonMode || false,
      maxOutputTokens:   options.maxOutputTokens || 2048,
      temperature:       options.temperature ?? 0.2,
      sessionId,
      userId,
      bypassCache:       options.bypassCache || false,
    });
  } catch (err) {
    if (err.code === 'TOKEN_BUDGET_EXCEEDED') {
      throw new TokenBudgetExceededError(sessionId, 0, 0);
    }
    throw err;
  }
}

// Kept for modules that import callRoutedGenerateContent (compat shim)
export async function callRoutedGenerateContent(_key, _model, request, options = {}) {
  const systemPrompt = extractText(request.systemInstruction);
  const userPrompt   = extractText(request.contents);
  const text = await callRoutedTextModel('omniroute', 'planner', systemPrompt, userPrompt, options);
  return { response: { text: () => text }, raw: null };
}

function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n');
  if (Array.isArray(value.parts)) return value.parts.map(p => p.text || '').filter(Boolean).join('\n');
  return '';
}
