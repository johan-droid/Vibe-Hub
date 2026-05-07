import CircuitBreaker from 'opossum';
import { PromptOrchestrator } from './context.js';
import { recordLlmCost, recordLlmDuration } from '../utils/metrics.js';
import { hashValue, withJsonCache } from '../utils/cache.js';
import { agentAuthManager, authToken, callWithAuthRetry } from '../auth/agent-auth.js';

class LLMClient {
  constructor() {
    this.authManager = agentAuthManager;
    this.endpoint = process.env.LLM_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.model = process.env.LLM_MODEL || 'gemini-2.0-flash';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
    this.breakers = new Map([
      ['gemini', this.createBreaker('gemini', (payload) => this.callGemini(payload))],
      ['openai', this.createBreaker('openai', (payload) => this.callOpenAI(payload))],
      ['anthropic', this.createBreaker('anthropic', (payload) => this.callAnthropic(payload))],
    ]);
  }

  createBreaker(provider, action) {
    return new CircuitBreaker(action, {
      timeout: Number.parseInt(process.env.LLM_PROVIDER_TIMEOUT_MS || '45000', 10),
      resetTimeout: Number.parseInt(process.env.LLM_CIRCUIT_RESET_MS || '30000', 10),
      errorThresholdPercentage: 50,
      volumeThreshold: 3,
      name: provider,
    });
  }

  /**
   * Executes the API call using the strictly formatted prompts.
   */
  async generateCode(orgContext, userContext, taskPrompt, astGraph, sandboxError = null) {
    if (!this.authManager.hasAnyProvider(['gemini', 'openai', 'anthropic'])) {
      throw new Error("CRITICAL: LLM API key is missing. Cannot generate code.");
    }

    // 1. Compile the strict prompt structures
    const systemInstruction = PromptOrchestrator.buildSystemPrompt(orgContext, userContext);
    const userInstruction = PromptOrchestrator.buildTaskPrompt(taskPrompt, astGraph, sandboxError);
    const cacheKey = `cache:llm:${hashValue({
      model: this.model,
      openaiModel: this.openaiModel,
      anthropicModel: this.anthropicModel,
      systemInstruction,
      userInstruction,
      temperature: 0.2,
    })}`;

    const { value } = await withJsonCache(
      cacheKey,
      Number.parseInt(process.env.LLM_CACHE_TTL_SECONDS || '1800', 10),
      () => this.generateWithFallback({ systemInstruction, userInstruction })
    );

    return value;
  }

  async generateWithFallback(payload) {
    const providers = [
      this.authManager.hasProvider('gemini') && ['gemini', { ...payload, endpoint: this.endpoint, model: this.model }],
      this.authManager.hasProvider('openai') && ['openai', { ...payload, model: this.openaiModel }],
      this.authManager.hasProvider('anthropic') && ['anthropic', { ...payload, model: this.anthropicModel }],
    ].filter(Boolean);

    let lastError = null;
    for (const [provider, providerPayload] of providers) {
      const started = Date.now();
      try {
        const result = await this.breakers.get(provider).fire(providerPayload);
        recordLlmDuration((Date.now() - started) / 1000, { provider, model: providerPayload.model, success: true });
        return result;
      } catch (error) {
        recordLlmDuration((Date.now() - started) / 1000, { provider, model: providerPayload.model, success: false });
        lastError = error;
      }
    }

    throw new Error(`Failed to communicate with all LLM providers: ${lastError?.message || 'no provider configured'}`);
  }

  async callGemini({ systemInstruction, userInstruction, endpoint, model }) {
    try {
      const auth = await this.authManager.auth('gemini');
      const apiKey = authToken(auth);
      // 2. Execute the network request
      // Using Gemini API format (adjust if using OpenAI/Anthropic)
      const response = await callWithAuthRetry(this.authManager, 'gemini', () => fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: systemInstruction + '\n\n' + userInstruction }
            ]
          }],
          generationConfig: {
            temperature: 0.2, // Keep temperature low for deterministic coding tasks
            maxOutputTokens: 8192
          }
        })
      }));

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LLM API returned status ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const totalTokens = data.usageMetadata?.totalTokenCount || 0;
      if (totalTokens > 0) {
        const costPerThousand = Number.parseFloat(process.env.LLM_COST_PER_1K_TOKENS || '0');
        recordLlmCost((totalTokens / 1000) * costPerThousand, {
          model,
          provider: 'gemini',
        });
      }
      
      // Extract the raw code from the response
      let rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Crude markdown block stripper for safety
      if (rawCode.startsWith('```')) {
        const lines = rawCode.split('\n');
        // Remove first line (```javascript or ```) and last line (```)
        rawCode = lines.slice(1, lines.length - 1).join('\n');
      }

      return rawCode;

    } catch (error) {
      throw new Error(`Gemini provider failed: ${error.message}`);
    }
  }

  async callOpenAI({ systemInstruction, userInstruction, model }) {
    const response = await callWithAuthRetry(this.authManager, 'openai', auth => fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken(auth)}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userInstruction },
        ],
      }),
    }));

    if (!response.ok) {
      throw new Error(`OpenAI API returned status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  async callAnthropic({ systemInstruction, userInstruction, model }) {
    const response = await callWithAuthRetry(this.authManager, 'anthropic', auth => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken(auth),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 8192,
        system: systemInstruction,
        messages: [{ role: 'user', content: userInstruction }],
      }),
    }));

    if (!response.ok) {
      throw new Error(`Anthropic API returned status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.content?.map(part => part.text || '').join('').trim() || '';
  }
}

export default new LLMClient();
