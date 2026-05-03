import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_HISTORY_BUDGET = 24_000;
const AUDIT_LIMIT = 250;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function redact(value) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= 10) return '[redacted]';
  return `${text.slice(0, 4)}...[redacted]...${text.slice(-4)}`;
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

/**
 * ModelService is the SaaS-grade provider gateway for Selina agents.
 * It centralizes model selection, token budgeting, retries/timeouts, and audit logs.
 */
export class ModelService {
  constructor(env = process.env) {
    this.env = env;
    this.audit = [];
    this.clients = new Map();
  }

  estimateTokens(input) {
    const text = typeof input === 'string' ? input : JSON.stringify(input ?? '');
    return Math.ceil(text.length / 4);
  }

  selectProfile({ modelName = DEFAULT_GEMINI_MODEL, effortLevel = 'standard', domain = 'code' } = {}) {
    const provider = (this.env.SELINA_MODEL_PROVIDER || this.env.SELINA_AGENT_PROVIDER || 'gemini').toLowerCase();
    const providerModel = {
      gemini: this.env.GEMINI_MODEL || this.env.SELINA_MODEL || modelName || DEFAULT_GEMINI_MODEL,
      openai: this.env.OPENAI_MODEL || this.env.SELINA_MODEL,
      qwen: this.env.QWEN_MODEL || this.env.SELINA_MODEL,
      anthropic: this.env.ANTHROPIC_MODEL || this.env.SELINA_MODEL,
    }[provider] || modelName;

    const outputByEffort = { quick: 1024, standard: 2048, deep: 4096 };
    const budgetByEffort = { quick: 8_000, standard: DEFAULT_HISTORY_BUDGET, deep: 64_000 };

    return {
      provider,
      model: providerModel || modelName || DEFAULT_GEMINI_MODEL,
      domain,
      effortLevel,
      maxOutputTokens: asInt(this.env.SELINA_MAX_OUTPUT_TOKENS, outputByEffort[effortLevel] || 2048),
      historyBudgetTokens: asInt(this.env.SELINA_HISTORY_TOKEN_BUDGET, budgetByEffort[effortLevel] || DEFAULT_HISTORY_BUDGET),
      timeoutMs: asInt(this.env.SELINA_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      retries: asInt(this.env.SELINA_MODEL_RETRIES, DEFAULT_RETRIES),
    };
  }

  providerStatus() {
    return {
      activeProvider: (this.env.SELINA_MODEL_PROVIDER || this.env.SELINA_AGENT_PROVIDER || 'gemini').toLowerCase(),
      gemini: { configured: Boolean(this.env.GEMINI_API_KEY), model: this.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL },
      openai: { configured: Boolean(this.env.OPENAI_API_KEY), model: this.env.OPENAI_MODEL || null, baseUrl: this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' },
      qwen: { configured: Boolean(this.env.QWEN_API_KEY), model: this.env.QWEN_MODEL || null, baseUrl: this.env.QWEN_BASE_URL || null },
      anthropic: { configured: Boolean(this.env.ANTHROPIC_API_KEY), model: this.env.ANTHROPIC_MODEL || null, baseUrl: this.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com' },
    };
  }

  diagnostics() {
    return {
      providerStatus: this.providerStatus(),
      auditTail: this.audit.slice(-25),
    };
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
    if (!this.env.GEMINI_API_KEY) {
      return {
        getGenerativeModel: () => ({
          startChat: () => ({ sendMessageStream: () => { throw new Error('GEMINI_API_KEY missing'); } }),
          generateContent: () => { throw new Error('GEMINI_API_KEY missing'); },
        }),
      };
    }

    if (!this.clients.has('gemini')) {
      this.clients.set('gemini', new GoogleGenerativeAI(this.env.GEMINI_API_KEY));
    }
    return this.clients.get('gemini');
  }

  getGeminiGenerativeModel({ model, tools, systemInstruction, maxOutputTokens }) {
    return this.getGeminiClient().getGenerativeModel({
      model,
      tools,
      systemInstruction,
      generationConfig: { maxOutputTokens },
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
        const message = err?.message || String(err);
        const retryable = /429|503|502|504|quota|rate|timeout|aborted/i.test(message);
        this.recordAudit({
          kind: 'model_error',
          provider: profile.provider,
          model: profile.model,
          attempt,
          durationMs: Date.now() - started,
          ok: false,
          retryable,
          error: message.slice(0, 220),
          ...meta,
        });
        if (!retryable || attempt >= profile.retries) break;
        await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 150));
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

  buildOpenAIRequest({ profile, messages, tools }) {
    return {
      model: profile.model,
      messages,
      tools: tools?.length ? toOpenAITools(tools) : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      max_tokens: profile.maxOutputTokens,
      temperature: 0.2,
    };
  }

  async openAICompatibleChat({ profile, messages, tools = [] }) {
    const providerConfig = profile.provider === 'qwen'
      ? {
          key: this.env.QWEN_API_KEY,
          baseUrl: this.env.QWEN_BASE_URL,
          headerName: 'Authorization',
        }
      : {
          key: this.env.OPENAI_API_KEY,
          baseUrl: this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
          headerName: 'Authorization',
        };

    if (!providerConfig.key) throw new Error(`${profile.provider.toUpperCase()} API key is missing`);
    if (!profile.model) throw new Error(`${profile.provider.toUpperCase()} model is missing`);
    const baseUrl = (providerConfig.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) throw new Error(`${profile.provider.toUpperCase()} base URL is missing`);

    const body = this.buildOpenAIRequest({ profile, messages, tools });
    const promptTokens = this.estimateTokens(messages);

    const data = await this.fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [providerConfig.headerName]: `Bearer ${providerConfig.key}`,
      },
      body: JSON.stringify(body),
    }, profile, { promptTokens });

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

  async anthropicChat({ profile, system, messages, tools = [] }) {
    if (!this.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is missing');
    if (!profile.model) throw new Error('ANTHROPIC_MODEL is missing');

    const baseUrl = (this.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
    const promptTokens = this.estimateTokens({ system, messages });
    const data = await this.fetchJson(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.env.ANTHROPIC_API_KEY,
        'anthropic-version': this.env.ANTHROPIC_VERSION || '2023-06-01',
      },
      body: JSON.stringify({
        model: profile.model,
        system,
        messages,
        tools: tools?.length ? toAnthropicTools(tools) : undefined,
        max_tokens: profile.maxOutputTokens,
        temperature: 0.2,
      }),
    }, profile, { promptTokens });

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
    if (profile.provider === 'qwen' || profile.provider === 'openai') return 'openai-compatible';
    if (profile.provider === 'anthropic') return 'anthropic';
    return 'gemini';
  }

  providerSecretPreview(provider) {
    const key = {
      gemini: this.env.GEMINI_API_KEY,
      openai: this.env.OPENAI_API_KEY,
      qwen: this.env.QWEN_API_KEY,
      anthropic: this.env.ANTHROPIC_API_KEY,
    }[provider];
    return redact(key);
  }
}

export const modelService = new ModelService();
