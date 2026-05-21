import { KeyRotator, ProviderExhaustedError } from './key-rotator.js';
import { semanticCache } from './semantic-cache.js';
import { countTokens } from '../memory/tokenizer.js';
import logger from '../utils/detailed-logger.js';
import { opsConfig } from './ops-config.js';
import { hardenSystemPrompt, wrapUserQuery } from './prompt-hardening.js';
import {
  applyBudgetPolicyToProfile,
  enforceLlmRateLimit,
  recordSessionTokenUsage,
} from './cost-controls.js';

export class TokenBudgetExceededError extends Error {
  constructor(runId, usage, budget) {
    super(`Per-session token budget exceeded for run '${runId}'. Cumulative usage: ${usage} tokens, Budget: ${budget} tokens.`);
    this.name = 'TokenBudgetExceededError';
    this.isTokenBudgetExceeded = true;
    this.runId = runId;
    this.usage = usage;
    this.budget = budget;
  }
}

// Memory-backed session usage tracker, in-memory with Redis compatibility
const sessionUsageMap = new Map();

export function getSessionUsage(runId) {
  if (!runId) return 0;
  return sessionUsageMap.get(runId) || 0;
}

export function resetSessionUsage(runId) {
  if (runId) sessionUsageMap.delete(runId);
}

export class TokenGovernor {
  constructor() {
    this.rotator = new KeyRotator();
  }

  async getCompute(taskComplexity, requiredRole, apiCallFn, options = {}) {
    if (typeof apiCallFn !== 'function') {
      throw new TypeError('TokenGovernor.getCompute requires an API execution callback');
    }

    // Dynamic emergency model hot-swap override
    if (opsConfig.llmProviderOverride) {
      const activeProvider = opsConfig.llmProviderOverride;
      const model = activeProvider === 'gemini' ? 'gemini-1.5-pro' : workerModelForProvider(activeProvider);
      logger.warn('TokenGovernor', `EMERGENCY OVERRIDE: Routing role '${requiredRole}' directly to provider '${activeProvider}' (model: ${model})`);
      const budgetAware = budgetAwareModel(activeProvider, model, options);
      return this.rotator.executeWithRotation(activeProvider, (key) => apiCallFn(key, budgetAware.model, activeProvider));
    }

    if (requiredRole === 'worker') {
      const workerProvider = normalizeWorkerProvider(process.env.SELINA_CODING_MODEL_PROVIDER || process.env.SELINA_WORKER_PROVIDER || 'groq');
      const workerModel = workerModelForProvider(workerProvider);
      const budgetAware = budgetAwareModel(workerProvider, workerModel, options);
      return this.rotator.executeWithRotation(workerProvider, (key) => apiCallFn(key, budgetAware.model, workerProvider));
    }

    // ─── TIERED MODEL STRATEGY FOR HIGH COMPLEXITY ───
    if (taskComplexity === 'high' && requiredRole === 'planner') {
      const skipTieredFallback = options.skipTieredFallback === true || process.env.DISABLE_TIERED_MODELS === 'true';
      
      if (!skipTieredFallback) {
        logger.info('TokenGovernor', 'Tiered model policy: attempting cheap/small model (gemini-1.5-flash) first...');
        try {
          const cheap = budgetAwareModel('gemini', 'gemini-1.5-flash', options);
          const cheapResult = await this.rotator.executeWithRotation('gemini', (key) => 
            apiCallFn(key, cheap.model, 'gemini')
          );
          
          // Heuristic Validation: Check if the small model returned a high-quality result
          const isValid = validateCheapModelResult(cheapResult, options);
          if (isValid) {
            logger.info('TokenGovernor', 'Tiered model policy: Small model execution successful. Re-routing complete.');
            return cheapResult;
          }
          
          logger.warn('TokenGovernor', 'Tiered model policy: Small model response failed validation heuristics. Falling back to larger model.');
        } catch (cheapErr) {
          logger.warn('TokenGovernor', `Tiered model policy: Small model execution failed (${cheapErr.message}). Falling back to larger model.`);
        }
      }

      // Falls back to high-end model if small model failed or was bypassed
      try {
        const nim = budgetAwareModel('nim', 'nemotron-70b', options);
        return await this.rotator.executeWithRotation('nim', (key) => apiCallFn(key, nim.model, 'nim'));
      } catch (error) {
        if (isProviderUnavailable(error, 'nim')) {
          console.warn('[Governor] NIM compute unavailable, failing over to Gemini Pro 1.5');
          const gemini = budgetAwareModel('gemini', 'gemini-1.5-pro', options);
          return await this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, gemini.model, 'gemini'));
        }
        throw error;
      }
    }

    if (taskComplexity === 'low') {
      if (requiredRole === 'planner') {
        const gemini = budgetAwareModel('gemini', 'gemini-1.5-flash', options);
        return this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, gemini.model, 'gemini'));
      } else {
        const groq = budgetAwareModel('groq', 'llama3-8b', options);
        return this.rotator.executeWithRotation('groq', (key) => apiCallFn(key, groq.model, 'groq'));
      }
    }

    throw new Error('No routing rule matched the specified complexity and role');
  }

  /**
   * Returns a pre-configured apiCall function bound to the correct model
   */
  async requestModel(taskComplexity, requiredRole) {
    return async (systemPrompt, userPrompt, options = {}) => {
      return this.getCompute(
        taskComplexity,
        requiredRole,
        (key, model, provider) => (
          callRoutedTextModel(key, model, systemPrompt, userPrompt, { ...options, provider })
        ),
        options
      );
    };
  }

  static async getCompute(taskComplexity, requiredRole, apiCallFn, options = {}) {
    return new TokenGovernor().getCompute(taskComplexity, requiredRole, apiCallFn, options);
  }
}

/**
 * Validates responses from smaller models to ensure they meet basic complexity requirements
 */
function validateCheapModelResult(result, options = {}) {
  if (!result || typeof result !== 'string') return false;
  
  const text = result.trim();
  if (text.length < 20) return false;
  
  // If we expect JSON, verify it is parseable
  if (options.jsonMode || options.responseMimeType === 'application/json') {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  // Reject generic error messages or placeholders
  if (text.toLowerCase().includes('i cannot answer') || text.toLowerCase().includes('todo')) {
    return false;
  }

  return true;
}

export async function callRoutedTextModel(key, model, systemPrompt, userPrompt, options = {}) {
  const runId = options.runId || options.requestId;
  const budget = Number.parseInt(process.env.SESSION_TOKEN_BUDGET || '100000', 10);
  const sessionId = options.sessionId || runId;
  const userId = options.userId || 'anonymous';
  const hardenedSystemPrompt = hardenSystemPrompt(systemPrompt);
  const wrappedUserPrompt = wrapUserQuery(userPrompt);

  enforceLlmRateLimit({ userId });

  // 1. Budget tracking: pre-execution verification
  if (runId) {
    const currentUsage = sessionUsageMap.get(runId) || 0;
    if (currentUsage > budget) {
      logger.error('TokenGovernor', `Token budget exceeded for session ${runId} (Usage: ${currentUsage}, Budget: ${budget})`);
      throw new TokenBudgetExceededError(runId, currentUsage, budget);
    }
  }

  // 2. Semantic Cache interception
  if (options.bypassCache !== true) {
    const cachedResponse = await semanticCache.get(wrappedUserPrompt);
    if (cachedResponse) {
      logger.info('TokenGovernor', `[Cache Intercept] Retokenizing cached response. Saved call to ${model}.`);
      return cachedResponse;
    }
  }

  // 3. Execution & dynamic tracking
  const provider = options.provider || inferProvider(model);
  let resultText = '';

  const inputTokens = countTokens(hardenedSystemPrompt + '\n' + wrappedUserPrompt);

  if (provider === 'gemini') {
    const response = await callRoutedGenerateContent(key, model, {
      contents: [{ role: 'user', parts: [{ text: wrappedUserPrompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: hardenedSystemPrompt }] },
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
        ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
      }
    }, { provider });
    resultText = response.response.text();
  } else {
    resultText = await callOpenAICompatibleChat(key, model, hardenedSystemPrompt, wrappedUserPrompt, {
      ...options,
      provider
    });
  }

  const outputTokens = countTokens(resultText);

  recordSessionTokenUsage({
    userId,
    sessionId,
    provider,
    model,
    inputTokens,
    outputTokens,
  });

  // 4. Budget tracking: post-execution update
  if (runId) {
    const currentUsage = sessionUsageMap.get(runId) || 0;
    const total = currentUsage + inputTokens + outputTokens;
    sessionUsageMap.set(runId, total);
    logger.info('TokenGovernor', `Session ${runId} Token Usage Update: +${inputTokens + outputTokens} (Total: ${total}/${budget})`);
    
    if (total > budget) {
      throw new TokenBudgetExceededError(runId, total, budget);
    }
  }

  // 5. Store in Semantic Cache
  if (options.bypassCache !== true && resultText) {
    await semanticCache.set(wrappedUserPrompt, resultText);
  }

  return resultText;
}

export async function callRoutedGenerateContent(key, model, request, options = {}) {
  const provider = options.provider || inferProvider(model);

  if (provider === 'gemini') {
    return callGeminiGenerateContent(key, model, request);
  }

  const systemPrompt = extractGeminiText(request.systemInstruction);
  const userPrompt = extractGeminiText(request.contents);
  const text = await callOpenAICompatibleChat(key, model, systemPrompt, userPrompt, {
    ...options,
    provider
  });

  return {
    response: { text: () => text },
    raw: null
  };
}

function isProviderUnavailable(error, provider) {
  if (error instanceof ProviderExhaustedError && error.message.includes(provider)) {
    return true;
  }
  return error?.message?.includes(`No keys configured for provider: ${provider}`);
}

function inferProvider(model) {
  if (model.startsWith('gemini')) return 'gemini';
  if (model.includes('nemotron')) return 'nim';
  if (model.includes('qwen')) return 'qwen';
  if (model.includes('deepseek')) return 'deepseek';
  return 'groq';
}

function normalizeWorkerProvider(provider) {
  const normalized = String(provider || 'groq').trim().toLowerCase();
  if (['qwen', 'deepseek', 'groq'].includes(normalized)) return normalized;
  return 'groq';
}

function workerModelForProvider(provider) {
  if (provider === 'qwen') {
    return process.env.QWEN_CODER_MODEL || process.env.QWEN_MODEL || 'qwen/qwen2.5-coder-32b-instruct';
  }
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_CODER_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-coder';
  }
  return process.env.GROQ_WORKER_MODEL || 'llama3-70b';
}

function budgetAwareModel(provider, model, options = {}) {
  const profile = applyBudgetPolicyToProfile({
    provider,
    model,
    maxOutputTokens: options.maxOutputTokens || 2048,
  }, {
    userId: options.userId,
    sessionId: options.sessionId || options.runId || options.requestId,
  });
  return profile;
}

async function callGeminiGenerateContent(key, model, request) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw await responseError(response, 'Gemini');
  }

  const data = await response.json();
  return {
    response: {
      text: () => data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || ''
    },
    raw: data
  };
}

async function callOpenAICompatibleChat(key, model, systemPrompt, userPrompt, options) {
  const provider = options.provider || inferProvider(model);
  const baseUrl = provider === 'nim'
    ? (process.env.NVIDIA_NIM_BASE_URL || process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1')
    : provider === 'qwen'
      ? (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
      : provider === 'deepseek'
        ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
        : (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1');

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxOutputTokens ?? 2048,
      stream: false,
      ...((options.jsonMode || options.responseFormat) ? {
        response_format: options.responseFormat || { type: 'json_object' }
      } : {})
    })
  });

  if (!response.ok) {
    throw await responseError(response, provider.toUpperCase());
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function extractGeminiText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(extractGeminiText).filter(Boolean).join('\n');
  }
  if (Array.isArray(value.parts)) {
    return value.parts.map(part => part.text || '').filter(Boolean).join('\n');
  }
  return '';
}

async function responseError(response, provider) {
  const body = await response.text();
  const error = new Error(`${provider} API returned status ${response.status}: ${body}`);
  error.status = response.status;
  error.statusCode = response.status;
  return error;
}
