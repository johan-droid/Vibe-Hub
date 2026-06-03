import { getModelProfile, normalizeMode } from './model-profiles.js';
import { callFreeLLMAPI } from './freellmapi-client.js';
import { quotaGuard } from './quota-guard.js';
import { recordLlmDuration, recordLlmTokenUsage } from '../../utils/metrics.js';

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

export async function callSelinaLLM({ mode, messages, taskPrompt, systemInstruction, userInstruction, fallbackUserInstruction }) {
  const normalizedMode = normalizeMode(mode || chooseModeFromTask(taskPrompt));
  const profile = getModelProfile(normalizedMode);

  quotaGuard.assertCanCallMode(normalizedMode);

  try {
    const result = await callFreeLLMAPI({
      mode: normalizedMode,
      messages,
      profile,
    });

    quotaGuard.recordRoutingResult({ mode: normalizedMode, status: result.status });

    // Record metrics
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

    return result.text;
  } catch (error) {
    quotaGuard.recordRoutingResult({
      mode: normalizedMode,
      status: error.status || 500,
      error: error.message
    });
    recordLlmDuration(0, { provider: 'freellmapi', model: profile.model || 'auto', success: false });
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
