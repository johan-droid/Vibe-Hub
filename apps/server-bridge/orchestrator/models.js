import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentAuthManager, agentAuthManager, authToken, callWithAuthRetry } from '../auth/agent-auth.js';
import { countTokens } from '../memory/tokenizer.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_QWEN_MODEL = 'qwen/qwen2.5-coder-32b-instruct';
const DEFAULT_NIM_MODEL = 'meta/llama-4-maverick-17b-128e-instruct';
const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_AFTER_CAP_MS = 8_000;
const DEFAULT_HISTORY_BUDGET = 24_000;
const AUDIT_LIMIT = 250;
const SUPPORTED_PROVIDERS = Object.freeze(['gemini', 'openai', 'qwen', 'nim', 'anthropic']);

function configuredProviderFromEnv(env = {}) {
  if (env.NIM_API_KEY || env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY) return 'nim';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.QWEN_API_KEY) return 'qwen';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.GEMINI_API_KEY || env.LLM_API_KEY) return 'gemini';
  return 'nim';
}

function resolveProvider(env = {}, providerOverride = null) {
  return String(
    providerOverride ||
    env.SELINA_MODEL_PROVIDER ||
    env.SELINA_AGENT_PROVIDER ||
    configuredProviderFromEnv(env)
  ).toLowerCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asFloat(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function redact(value) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= 10) return '[redacted]';
  return `${text.slice(0, 4)}...[redacted]...${text.slice(-4)}`;
}

function retryAfterMsFromMessage(message) {
  const retryDelayMatch = message.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i);
  const retryInMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  const value = retryDelayMatch?.[1] || retryInMatch?.[1];
  return value ? Math.ceil(Number.parseFloat(value) * 1000) : null;
}

export function classifyModelError(error) {
  const message = error?.message || String(error || '');
  const lower = message.toLowerCase();
  const retryAfterMs = retryAfterMsFromMessage(message);

  if (/quota exceeded|quotafailure|free_tier|free tier|limit:\s*0/i.test(message)) {
    return {
      code: 'quota_exceeded',
      retryable: false,
      fallbackable: true,
      retryAfterMs,
      message,
    };
  }

  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('permission') || lower.includes('api key') || lower.includes('not authenticated')) {
    return {
      code: 'auth_failed',
      retryable: false,
      fallbackable: true,
      retryAfterMs,
      message,
    };
  }

  if (lower.includes('429') || lower.includes('too many requests') || lower.includes('rate limit') || lower.includes('rate_limited')) {
    return {
      code: 'rate_limited',
      retryable: true,
      fallbackable: true,
      retryAfterMs,
      message,
    };
  }

  if (lower.includes('503') || lower.includes('502') || lower.includes('504') || lower.includes('timeout') || lower.includes('aborted')) {
    return {
      code: 'transient_provider_error',
      retryable: true,
      fallbackable: true,
      retryAfterMs,
      message,
    };
  }

  return {
    code: 'unknown_provider_error',
    retryable: false,
    fallbackable: false,
    retryAfterMs,
    message,
  };
}

function normalizeType(type) {
  const raw = String(type || 'object').toLowerCase();
  if (raw === 'number' || raw === 'integer') return 'number';
  if (raw === 'array') return 'array';
  if (raw === 'string') return 'string';
  if (raw === 'boolean') return 'boolean';
  return 'object';
}

export function normalizeJsonSchema(schema = {}) {
  const normalized = {
    type: normalizeType(schema.type),
  };

  if (schema.description) normalized.description = schema.description;
  if (schema.enum) normalized.enum = schema.enum;
  if (schema.required) normalized.required = schema.required;

  if (schema.properties) {
    normalized.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, normalizeJsonSchema(value)])
    );
  }

  if (schema.items) normalized.items = normalizeJsonSchema(schema.items);
  return normalized;
}

function toOpenAITools(tools = []) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: normalizeJsonSchema(tool.parameters || { type: 'OBJECT', properties: {} }),
    },
  }));
}

function toOpenAIResponsesTools(tools = []) {
  return tools.map(tool => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: normalizeJsonSchema(tool.parameters || { type: 'OBJECT', properties: {} }),
    strict: false,
  }));
}

function toAnthropicTools(tools = []) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: normalizeJsonSchema(tool.parameters || { type: 'OBJECT', properties: {} }),
  }));
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => part?.text || part?.content || '').join('\n');
  }
  return JSON.stringify(content ?? '');
}

function toAnthropicSystem(system, usePromptCache) {
  if (!system) return undefined;
  if (!usePromptCache) return system;
  return [{
    type: 'text',
    text: system,
    cache_control: { type: 'ephemeral' },
  }];
}

function parseToolArgs(argumentsText) {
  if (!argumentsText) return {};
  if (typeof argumentsText === 'object') return argumentsText;
  try {
    return JSON.parse(argumentsText);
  } catch {
    return {};
  }
}

function extractResponseText(data = {}) {
  if (data.output_text) return data.output_text;

  return (data.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(part => part.type === 'output_text' || part.text)
    .map(part => part.text || '')
    .join('\n');
}

function extractResponseToolCalls(data = {}) {
  return (data.output || [])
    .filter(item => item.type === 'function_call' && item.name)
    .map(item => ({
      id: item.id,
      callId: item.call_id || item.id,
      name: item.name,
      args: parseToolArgs(item.arguments),
      raw: item,
    }));
}

/**
 * ModelService is the SaaS-grade provider gateway for Selina agents.
 * It centralizes model selection, token budgeting, retries/timeouts, and audit logs.
 */
export class ModelService {
  constructor(env = process.env, authManager = new AgentAuthManager({ env })) {
    this.env = env;
    this.authManager = authManager;
    this.audit = [];
    this.clients = new Map();
  }

  estimateTokens(input) {
    return countTokens(input);
  }

  selectProfile({ modelName = DEFAULT_GEMINI_MODEL, effortLevel = 'standard', domain = 'code', provider: providerOverride = null } = {}) {
    const provider = resolveProvider(this.env, providerOverride);
    const providerModel = {
      gemini: this.env.GEMINI_MODEL || this.env.SELINA_MODEL || modelName || DEFAULT_GEMINI_MODEL,
      openai: this.env.OPENAI_MODEL || this.env.SELINA_MODEL || DEFAULT_OPENAI_MODEL,
      qwen: this.env.QWEN_MODEL || this.env.SELINA_MODEL || DEFAULT_QWEN_MODEL,
      nim: this.env.NIM_MODEL || this.env.NVIDIA_NIM_MODEL || this.env.SELINA_MODEL || DEFAULT_NIM_MODEL,
      anthropic: this.env.ANTHROPIC_MODEL || this.env.SELINA_MODEL || DEFAULT_ANTHROPIC_MODEL,
    }[provider] || modelName;
    const apiMode = provider === 'openai'
      ? String(this.env.OPENAI_API_MODE || this.env.SELINA_OPENAI_API_MODE || 'responses').toLowerCase()
      : 'chat';

    const outputByEffort = { quick: 1024, standard: 2048, deep: 4096 };
    const budgetByEffort = { quick: 8_000, standard: DEFAULT_HISTORY_BUDGET, deep: 64_000 };

    return {
      provider,
      model: providerModel || modelName || DEFAULT_GEMINI_MODEL,
      apiMode,
      domain,
      effortLevel,
      maxOutputTokens: asInt(this.env.SELINA_MAX_OUTPUT_TOKENS, outputByEffort[effortLevel] || 2048),
      historyBudgetTokens: asInt(this.env.SELINA_HISTORY_TOKEN_BUDGET, budgetByEffort[effortLevel] || DEFAULT_HISTORY_BUDGET),
      timeoutMs: asInt(this.env.SELINA_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      retries: asInt(this.env.SELINA_MODEL_RETRIES, DEFAULT_RETRIES),
    };
  }

  fallbackProviderNames(primaryProvider) {
    const raw = this.env.SELINA_MODEL_FALLBACKS || this.env.SELINA_PROVIDER_FALLBACKS || '';
    return raw
      .split(',')
      .map(provider => provider.trim().toLowerCase())
      .filter(provider => SUPPORTED_PROVIDERS.includes(provider))
      .filter(provider => provider !== primaryProvider)
      .filter(provider => this.authManager.hasProvider(provider));
  }

  selectFallbackProfiles(primaryProfile) {
    return this.fallbackProviderNames(primaryProfile.provider)
      .map(provider => this.selectProfile({
        provider,
        effortLevel: primaryProfile.effortLevel,
        domain: primaryProfile.domain,
      }))
      .filter(profile => profile.model);
  }

  shouldFallback(error) {
    return classifyModelError(error).fallbackable;
  }

  providerFailureMessage(error, profile) {
    const classification = classifyModelError(error);
    const retry = classification.retryAfterMs
      ? ` Retry-after hint: ${Math.ceil(classification.retryAfterMs / 1000)}s.`
      : '';
    const fallbackHint = classification.fallbackable
      ? ' Configure SELINA_MODEL_PROVIDER to another provider, or set SELINA_MODEL_FALLBACKS=nim,openai,qwen,anthropic,gemini with matching API keys.'
      : '';

    return `${profile.provider}:${profile.model} failed with ${classification.code}.${retry}${fallbackHint}`;
  }

  providerStatus() {
    const activeProvider = resolveProvider(this.env);
    return {
      activeProvider,
      gemini: { configured: this.authManager.hasProvider('gemini'), model: this.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL },
      openai: {
        configured: this.authManager.hasProvider('openai'),
        model: this.env.OPENAI_MODEL || null,
        baseUrl: this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiMode: String(this.env.OPENAI_API_MODE || this.env.SELINA_OPENAI_API_MODE || 'responses').toLowerCase(),
      },
      qwen: {
        configured: this.authManager.hasProvider('qwen'),
        model: this.env.QWEN_MODEL || DEFAULT_QWEN_MODEL,
        baseUrl: this.env.QWEN_BASE_URL || null,
      },
      nim: {
        configured: this.authManager.hasProvider('nim'),
        model: this.env.NIM_MODEL || this.env.NVIDIA_NIM_MODEL || DEFAULT_NIM_MODEL,
        baseUrl: this.env.NIM_BASE_URL || this.env.NVIDIA_NIM_BASE_URL || DEFAULT_NIM_BASE_URL,
      },
      anthropic: { configured: this.authManager.hasProvider('anthropic'), model: this.env.ANTHROPIC_MODEL || null, baseUrl: this.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com' },
    };
  }

  diagnostics() {
    return {
      providerStatus: this.providerStatus(),
      auditTail: this.audit.slice(-25),
    };
  }

  async completeText({
    prompt,
    system = '',
    provider = null,
    modelName = DEFAULT_GEMINI_MODEL,
    effortLevel = 'quick',
    domain = 'classifier',
    meta = {},
    jsonMode = false,
  } = {}) {
    const primary = this.selectProfile({ modelName, effortLevel, domain, provider });
    const profiles = [primary, ...this.selectFallbackProfiles(primary)];
    let lastError = null;

    for (let index = 0; index < profiles.length; index++) {
      const candidate = profiles[index];
      try {
        if (this.providerKind(candidate) === 'gemini') {
          const model = this.getGeminiGenerativeModel({
            model: candidate.model,
            systemInstruction: system,
            maxOutputTokens: candidate.maxOutputTokens,
            responseMimeType: jsonMode ? 'application/json' : undefined,
          });
          const result = await this.withRetry(
            () => model.generateContent(prompt),
            candidate,
            { phase: 'complete_text', ...meta }
          );
          return {
            content: result.response.text(),
            profile: candidate,
          };
        }

        if (this.providerKind(candidate) === 'anthropic') {
          const result = await this.anthropicChat({
            profile: candidate,
            system,
            messages: [{ role: 'user', content: prompt }],
            tools: [],
            jsonMode,
          });
          return { content: result.content, profile: candidate };
        }

        if (candidate.provider === 'openai' && candidate.apiMode === 'responses') {
          const result = await this.openAIResponses({
            profile: candidate,
            instructions: system,
            input: [{ role: 'user', content: prompt }],
            tools: [],
            jsonMode,
          });
          return { content: result.content, profile: candidate };
        }

        const messages = [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ];
        const result = await this.openAICompatibleChat({ profile: candidate, messages, tools: [], jsonMode });
        return { content: result.content, profile: candidate };
      } catch (error) {
        lastError = error;
        const hasNext = index < profiles.length - 1;
        const classification = classifyModelError(error);
        const canFallback = hasNext && classification.fallbackable;
        this.recordAudit({
          kind: canFallback ? 'provider_fallback' : 'provider_failure',
          fromProvider: candidate.provider,
          fromModel: candidate.model,
          toProvider: canFallback ? profiles[index + 1].provider : null,
          toModel: canFallback ? profiles[index + 1].model : null,
          reason: classification.code,
          retryAfterMs: classification.retryAfterMs,
          message: classification.message.slice(0, 220),
          ...meta,
        });
        if (!canFallback) throw new Error(this.providerFailureMessage(error, candidate));
      }
    }

    throw lastError;
  }

  recordAudit(event) {
    const safe = {
      ts: new Date().toISOString(),
      ...event,
    };
    delete safe.apiKey;
    this.audit.push(safe);
    if (this.audit.length > AUDIT_LIMIT) this.audit.splice(0, this.audit.length - AUDIT_LIMIT);
  }

  getGeminiClient() {
    const apiKey = this.authManager.getBearerToken('gemini');
    if (!apiKey) {
      return {
        getGenerativeModel: () => ({
          startChat: () => ({ sendMessageStream: () => { throw new Error('GEMINI_API_KEY missing'); } }),
          generateContent: () => { throw new Error('GEMINI_API_KEY missing'); },
        }),
      };
    }

    if (!this.clients.has('gemini')) {
      this.clients.set('gemini', new GoogleGenerativeAI(apiKey));
    }
    return this.clients.get('gemini');
  }

  getGeminiGenerativeModel({ model, tools, systemInstruction, maxOutputTokens, responseMimeType, responseSchema, cachedContent }) {
    return this.getGeminiClient().getGenerativeModel({
      model,
      tools,
      systemInstruction,
      cachedContent,
      generationConfig: {
        maxOutputTokens,
        ...(responseMimeType ? { responseMimeType } : {}),
        ...(responseSchema ? { responseSchema } : {}),
      },
    });
  }

  trimGeminiHistory(history = [], budgetTokens = DEFAULT_HISTORY_BUDGET) {
    const kept = [];
    let total = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      const tokens = this.estimateTokens(turn);
      if (kept.length > 0 && total + tokens > budgetTokens) break;
      kept.unshift(turn);
      total += tokens;
    }

    while (kept.length && kept[0].role !== 'user') kept.shift();
    return kept;
  }

  async withRetry(operation, profile, meta = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= profile.retries; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), profile.timeoutMs);

      try {
        const result = await operation(controller.signal, attempt);
        clearTimeout(timeout);
        this.recordAudit({
          kind: 'model_call',
          provider: profile.provider,
          model: profile.model,
          domain: profile.domain,
          effortLevel: profile.effortLevel,
          attempt,
          durationMs: Date.now() - started,
          ok: true,
          ...meta,
        });
        return result;
      } catch (err) {
        clearTimeout(timeout);
        lastErr = err;
        const classification = classifyModelError(err);
        const message = err?.message || String(err);
        const retryable = classification.retryable;
        this.recordAudit({
          kind: 'model_error',
          provider: profile.provider,
          model: profile.model,
          attempt,
          durationMs: Date.now() - started,
          ok: false,
          retryable,
          code: classification.code,
          retryAfterMs: classification.retryAfterMs,
          error: message.slice(0, 220),
          ...meta,
        });
        if (!retryable || attempt >= profile.retries) break;
        const retryCapMs = asInt(this.env.SELINA_MODEL_MAX_RETRY_AFTER_MS, DEFAULT_RETRY_AFTER_CAP_MS);
        const retryDelayMs = classification.retryAfterMs
          ? Math.min(classification.retryAfterMs, retryCapMs)
          : Math.min(retryCapMs, 500 * 2 ** attempt);
        await sleep(retryDelayMs + Math.floor(Math.random() * 150));
      }
    }
    throw lastErr;
  }

  async sendGeminiStream(chat, message, profile, { onStream, meta } = {}) {
    return this.withRetry(async () => {
      const result = await chat.sendMessageStream(message);
      let streamed = 0;
      for await (const chunk of result.stream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text)?.text;
        if (textPart) {
          streamed += this.estimateTokens(textPart);
          if (onStream) onStream(textPart);
        }
      }
      const response = await result.response;
      this.recordAudit({ kind: 'token_estimate', provider: 'gemini', model: profile.model, streamedTokens: streamed });
      return response;
    }, profile, meta);
  }

  async fetchJson(url, options, profile, meta) {
    return this.withRetry(async (signal) => {
      const res = await fetch(url, { ...options, signal });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) {
        const detail = data?.error?.message || data?.error || data?.message || res.statusText;
        throw new Error(`${res.status} ${detail}`);
      }
      return data;
    }, profile, meta);
  }

  async fetchJsonWithAuth(provider, url, buildOptions, profile, meta) {
    return this.withRetry(async (signal) => {
      const res = await callWithAuthRetry(this.authManager, provider, auth => {
        const options = buildOptions(auth);
        return fetch(url, { ...options, signal });
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) {
        const detail = data?.error?.message || data?.error || data?.message || res.statusText;
        throw new Error(`${res.status} ${detail}`);
      }
      return data;
    }, profile, meta);
  }

  buildOpenAIRequest({ profile, messages, tools, jsonMode = false, responseFormat = null }) {
    const body = {
      model: profile.model,
      messages,
      tools: tools?.length ? toOpenAITools(tools) : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      max_tokens: profile.maxOutputTokens,
      temperature: asFloat(this.env.SELINA_MODEL_TEMPERATURE, 0.2),
    };

    if (responseFormat || jsonMode) {
      body.response_format = responseFormat || { type: 'json_object' };
    }

    if (profile.provider === 'nim') {
      body.stream = false;
      body.temperature = asFloat(this.env.NIM_TEMPERATURE || this.env.SELINA_MODEL_TEMPERATURE, 1.0);
      body.top_p = asFloat(this.env.NIM_TOP_P, 1.0);
      body.frequency_penalty = asFloat(this.env.NIM_FREQUENCY_PENALTY, 0.0);
      body.presence_penalty = asFloat(this.env.NIM_PRESENCE_PENALTY, 0.0);
    }

    return body;
  }

  buildOpenAIResponsesRequest({ profile, instructions, input, tools, jsonMode = false }) {
    const body = {
      model: profile.model,
      input,
      store: false,
      parallel_tool_calls: false,
      max_output_tokens: profile.maxOutputTokens,
    };

    if (instructions) body.instructions = instructions;
    if (tools?.length) body.tools = toOpenAIResponsesTools(tools);
    if (jsonMode) body.text = { format: { type: 'json_object' } };
    return body;
  }

  async openAICompatibleChat({ profile, messages, tools = [], jsonMode = false, responseFormat = null }) {
    const providerConfig = {
      openai: {
        baseUrl: this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        headerName: 'Authorization',
      },
      qwen: {
        baseUrl: this.env.QWEN_BASE_URL,
        headerName: 'Authorization',
      },
      nim: {
        baseUrl: this.env.NIM_BASE_URL || this.env.NVIDIA_NIM_BASE_URL || DEFAULT_NIM_BASE_URL,
        headerName: 'Authorization',
        accept: 'application/json',
      },
    }[profile.provider];

    if (!providerConfig) throw new Error(`${profile.provider.toUpperCase()} is not an OpenAI-compatible provider`);

    if (!this.authManager.hasProvider(profile.provider)) throw new Error(`${profile.provider.toUpperCase()} API key is missing`);
    if (!profile.model) throw new Error(`${profile.provider.toUpperCase()} model is missing`);
    const baseUrl = (providerConfig.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) throw new Error(`${profile.provider.toUpperCase()} base URL is missing`);

    const body = this.buildOpenAIRequest({ profile, messages, tools, jsonMode, responseFormat });
    const promptTokens = this.estimateTokens(messages);

    const data = await this.fetchJsonWithAuth(profile.provider, `${baseUrl}/chat/completions`, (auth) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: providerConfig.accept || 'application/json',
        [providerConfig.headerName]: `Bearer ${authToken(auth)}`,
      },
      body: JSON.stringify(body),
    }), profile, { promptTokens });

    const message = data.choices?.[0]?.message || {};
    return {
      content: message.content || '',
      toolCalls: (message.tool_calls || []).map(call => ({
        id: call.id,
        name: call.function?.name,
        args: JSON.parse(call.function?.arguments || '{}'),
        raw: call,
      })).filter(call => call.name),
      rawMessage: message,
      usage: data.usage,
    };
  }

  async openAIResponses({ profile, instructions, input, tools = [], jsonMode = false }) {
    if (!this.authManager.hasProvider('openai')) throw new Error('OPENAI_API_KEY is missing');
    if (!profile.model) throw new Error('OPENAI_MODEL is missing');

    const baseUrl = (this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const body = this.buildOpenAIResponsesRequest({ profile, instructions, input, tools, jsonMode });
    const promptTokens = this.estimateTokens({ instructions, input });

    const data = await this.fetchJsonWithAuth('openai', `${baseUrl}/responses`, (auth) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken(auth)}`,
      },
      body: JSON.stringify(body),
    }), profile, { promptTokens, apiMode: 'responses' });

    return {
      content: extractResponseText(data),
      toolCalls: extractResponseToolCalls(data),
      rawItems: data.output || [],
      responseId: data.id,
      usage: data.usage,
    };
  }

  async anthropicChat({ profile, system, messages, tools = [], jsonMode = false, promptCache = null }) {
    if (!this.authManager.hasProvider('anthropic')) throw new Error('ANTHROPIC_API_KEY is missing');
    if (!profile.model) throw new Error('ANTHROPIC_MODEL is missing');

    const baseUrl = (this.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
    const promptTokens = this.estimateTokens({ system, messages });
    const minCacheTokens = asInt(this.env.SELINA_ANTHROPIC_CACHE_MIN_TOKENS, 1024);
    const usePromptCache = promptCache ?? (
      this.env.SELINA_ANTHROPIC_PROMPT_CACHE !== 'false' &&
      system &&
      this.estimateTokens(system) >= minCacheTokens
    );
    const anthropicSystem = toAnthropicSystem(system, usePromptCache);
    const data = await this.fetchJsonWithAuth('anthropic', `${baseUrl}/v1/messages`, (auth) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken(auth),
        'anthropic-version': this.env.ANTHROPIC_VERSION || '2023-06-01',
        ...(this.env.ANTHROPIC_BETA ? { 'anthropic-beta': this.env.ANTHROPIC_BETA } : {}),
      },
      body: JSON.stringify({
        model: profile.model,
        ...(anthropicSystem ? { system: anthropicSystem } : {}),
        messages,
        tools: tools?.length ? toAnthropicTools(tools) : undefined,
        max_tokens: profile.maxOutputTokens,
        temperature: 0.2,
      }),
    }), profile, { promptTokens, promptCache: Boolean(usePromptCache), jsonMode });

    const blocks = data.content || [];
    return {
      content: blocks.filter(b => b.type === 'text').map(b => b.text).join('\n'),
      toolCalls: blocks.filter(b => b.type === 'tool_use').map(b => ({
        id: b.id,
        name: b.name,
        args: b.input || {},
        raw: b,
      })),
      rawMessage: { role: 'assistant', content: blocks },
      usage: data.usage,
    };
  }

  providerKind(profile) {
    if (profile.provider === 'qwen' || profile.provider === 'openai' || profile.provider === 'nim') return 'openai-compatible';
    if (profile.provider === 'anthropic') return 'anthropic';
    return 'gemini';
  }

  providerSecretPreview(provider) {
    const key = {
      gemini: this.authManager.getBearerToken('gemini'),
      openai: this.authManager.getBearerToken('openai'),
      qwen: this.authManager.getBearerToken('qwen'),
      nim: this.authManager.getBearerToken('nim'),
      anthropic: this.authManager.getBearerToken('anthropic'),
    }[provider];
    return redact(key);
  }
}

export const modelService = new ModelService(process.env, agentAuthManager);
