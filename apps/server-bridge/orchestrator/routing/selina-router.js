import { normalizeCapability, getCapabilityProfile, rankModelsForCapability } from './capability-registry.js';
import { callFreeLLMAPI } from './freellmapi-client.js';
import { quotaGuard } from './quota-guard.js';
import { recordLlmDuration, recordLlmTokenUsage } from '../../utils/metrics.js';
import { logger } from '../../utils/detailed-logger.js';

export function chooseModeFromTask(taskPrompt) {
  const prompt = (taskPrompt || '').toLowerCase();

  if (prompt.includes('smoke test') || prompt.includes('test models') || prompt.includes('model availability')) {
    return 'smoke_test';
  }
  if (prompt.includes('code') || prompt.includes('bug') || prompt.includes('fix') || prompt.includes('refactor') || prompt.includes('test') || prompt.includes('component') || prompt.includes('api')) {
    return 'coding';
  }
  if (prompt.includes('architecture') || prompt.includes('security') || prompt.includes('deep analysis') || prompt.includes('threat') || prompt.includes('design')) {
    return 'reasoning';
  }
  if (prompt.includes('json') || prompt.includes('tool args') || prompt.includes('structured')) {
    return 'json_strict';
  }

  return 'fast';
}

export async function callSelinaLLM({ mode, messages, taskPrompt, metadata = {} }) {
  let capabilityName = normalizeCapability(mode || chooseModeFromTask(taskPrompt));

  if (!metadata.forceMode) {
    if (metadata.expectedContextTokens > 12000) {
      capabilityName = 'large_context';
    } else if (metadata.requiresJson) {
      capabilityName = 'json_strict';
    } else if (metadata.requiresCode) {
      capabilityName = 'coding';
    }
  }

  const profile = getCapabilityProfile(capabilityName);
  quotaGuard.assertCanCallMode(capabilityName);

  if (process.env.SELINA_FREELLMAPI_PREFLIGHT === 'true' && ['coding', 'large_context', 'reasoning', 'smoke_test'].includes(capabilityName)) {
    try {
      // Import dynamically to avoid breaking if the file doesn't exist
      const { getFreeLLMAPIStatusSnapshot } = await import('./freellmapi-admin-client.js');
      const snapshot = await getFreeLLMAPIStatusSnapshot();
      if (snapshot && snapshot.models) {
        const ranked = rankModelsForCapability(snapshot.models, capabilityName);
        const top5 = ranked.slice(0, 5).map(m => m.modelId || m.displayName);
        logger.info('RoutingPreflight', `Recommended models for ${capabilityName}: ${top5.join(', ')}`);
      }
    } catch (err) {
      // Ignore errors if file missing or network issues to not block calls
    }
  }

  try {
    const result = await callFreeLLMAPI({
      capability: capabilityName,
      mode: capabilityName,
      messages,
      profile,
      metadata
    });

    quotaGuard.recordRoutingResult({ mode: capabilityName, status: result.status });

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

    logger.info('Routing', `Completed ${capabilityName} via ${result.routedVia || 'auto'} (${result.durationMs}ms) fallbackAttempts=${result.fallbackAttempts || 0}`);

    return result.text;
  } catch (error) {
    quotaGuard.recordRoutingResult({
      mode: capabilityName,
      status: error.status || 500,
      error: error.message
    });
    recordLlmDuration(0, { provider: 'freellmapi', model: profile.model || 'auto', success: false });

    logger.error('Routing', `Failed ${capabilityName}: ${error.message}`);
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
