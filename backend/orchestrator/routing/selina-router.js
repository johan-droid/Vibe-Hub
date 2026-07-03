import { normalizeCapability, getProviderCapability } from './provider-capabilities.js';
import { recordProviderResult, rankProvidersForCapability } from './provider-budget-manager.js';
import { callFreeLLMAPI } from './freellmapi-client.js';
import { quotaGuard } from './quota-guard.js';
import { recordLlmDuration, recordLlmTokenUsage } from '../../utils/metrics.js';
import { logger } from '../../utils/detailed-logger.js';

export function chooseModeFromTask(taskPrompt, metadata = {}) {
  if (metadata.forceMode) {
    return metadata.forceMode;
  }

  if (metadata.requiresJson) {
    return 'json_strict';
  }

  if (metadata.requiresCode) {
    return 'coding';
  }

  if (metadata.expectedContextTokens > 12000) {
    return 'large_context';
  }

  const prompt = (taskPrompt || '').toLowerCase();

  if (prompt.includes('smoke test') || prompt.includes('test models') || prompt.includes('model availability')) {
    return 'smoke_test';
  }

  if (prompt.includes('whole repo') || prompt.includes('entire repo') || prompt.includes('large context') ||
      prompt.includes('multi-file') || prompt.includes('analyze repository') || prompt.includes('scan repo') ||
      prompt.includes('full codebase') || prompt.includes('architecture map') || prompt.includes('summarize repo')) {
    return 'large_context';
  }

  if (prompt.includes('security') || prompt.includes('threat') || prompt.includes('vulnerability') ||
      prompt.includes('risk') || prompt.includes('deep analysis') || prompt.includes('root cause') ||
      prompt.includes('architecture')) {
    return 'reasoning';
  }

  if (prompt.includes('code') || prompt.includes('bug') || prompt.includes('fix') ||
      prompt.includes('refactor') || prompt.includes('test') || prompt.includes('component') ||
      prompt.includes('api') || prompt.includes('implementation') || prompt.includes('function') ||
      prompt.includes('class') || prompt.includes('backend') || prompt.includes('frontend')) {
    return 'coding';
  }

  if (prompt.includes('json') || prompt.includes('tool args') || prompt.includes('structured') ||
      prompt.includes('state transition') || prompt.includes('schema')) {
    return 'json_strict';
  }

  return 'fast';
}

export async function callSelinaLLM({ mode, messages, taskPrompt, metadata = {} }) {
  const capability = normalizeCapability(mode || chooseModeFromTask(taskPrompt, metadata));
  const profile = getProviderCapability(capability);

  quotaGuard.assertCanCallMode(capability);

    if (process.env.SELINA_FREELLMAPI_PREFLIGHT === 'true' && ["'coding'", "'large_context'", "'reasoning'", "'smoke_test'"].includes(capability)) {
    try {
      const { getFreeLLMAPIStatusSnapshot } = await import('./freellmapi-admin-client.js');
      await getFreeLLMAPIStatusSnapshot();
    } catch (err) {
    }
  }

  const rankedProviders = rankProvidersForCapability(capability);
  logger.info('Routing', `Selected capability ${capability}. Recommended providers: ${rankedProviders.slice(0, 3).map(p => p.provider).join(', ')}`);

  try {
    const result = await callFreeLLMAPI({
      capability,
      mode: capability,
      messages,
      profile,
      metadata
    });

    recordProviderResult({
      capability,
      routedVia: result.routedVia,
      status: result.status,
      success: true,
      durationMs: result.durationMs,
      fallbackAttempts: result.fallbackAttempts
    });

    quotaGuard.recordRoutingResult({ mode: capability, status: result.status });

    recordLlmDuration(result.durationMs / 1000, { provider: 'freellmapi', model: result.model, success: true });

    if (result.raw?.usage) {
       recordLlmTokenUsage({
          provider: 'freellmapi',
          model: result.model,
          inputTokens: result.raw.usage.prompt_tokens || 0,
          outputTokens: result.raw.usage.completion_tokens || 0,
          totalTokens: result.raw.usage.total_tokens || 0,
          durationSeconds: result.durationMs / 1000,
       });
    }

    logger.info('Routing', `Completed ${capability} via ${result.routedVia || 'auto'} (${result.durationMs}ms) fallbackAttempts=${result.fallbackAttempts || 0}`);

    return result.text;
  } catch (error) {
    recordProviderResult({
      capability,
      routedVia: error.routedVia,
      status: error.status || 500,
      success: false,
      durationMs: 0,
      fallbackAttempts: error.fallbackAttempts,
      error
    });

    quotaGuard.recordRoutingResult({
      mode: capability,
      status: error.status || 500,
      error: error.message,
      routedVia: error.routedVia
    });

    recordLlmDuration(0, { provider: 'freellmapi', model: profile.model || 'auto', success: false });

    logger.error('Routing', `Failed ${capability}: ${error.message}`);
    throw error;
  }
}

export async function callSelinaText({ mode, systemInstruction, userInstruction }) {
   return callSelinaLLM({
       mode,
       messages: [
         { role: 'system', content: systemInstruction },
         { role: 'user', content: userInstruction }
       ]
   });
}

export async function callSelinaJson({ systemInstruction, userInstruction, schemaHint }) {
  return callSelinaLLM({
      mode: 'json_strict',
      messages: [
        { role: 'system', content: `${systemInstruction}\n\nEnsure output is strictly JSON${schemaHint ? ` matching: ${schemaHint}` : ''}` },
        { role: 'user', content: userInstruction }
      ]
  });
}

export async function runSelinaSmokeTest() {
  return callSelinaLLM({
    mode: 'smoke_test',
    messages: [
      {
        role: 'system',
        content: 'You are a model availability smoke test. Return only valid JSON.'
      },
      {
        role: 'user',
        content: 'Return exactly this JSON and nothing else: {"ok":true}'
      }
    ],
    taskPrompt: 'smoke test model availability'
  });
}
