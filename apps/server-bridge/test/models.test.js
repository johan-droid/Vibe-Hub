import { describe, it, expect } from 'vitest';
import { AgentAuthManager } from '../auth/agent-auth.js';
import { ModelService, classifyModelError, normalizeJsonSchema } from '../orchestrator/models.js';

describe('ModelService gateway', () => {
  it('normalizes Gemini-style schemas to JSON schema for external providers', () => {
    const schema = normalizeJsonSchema({
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'File path' },
        edits: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { search: { type: 'STRING' } },
            required: ['search'],
          },
        },
      },
      required: ['path'],
    });

    expect(schema.type).toBe('object');
    expect(schema.properties.path.type).toBe('string');
    expect(schema.properties.edits.type).toBe('array');
    expect(schema.properties.edits.items.type).toBe('object');
    expect(schema.required).toEqual(['path']);
  });

  it('selects an OpenAI-compatible profile from env without exposing secrets', () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-secret-value',
      OPENAI_MODEL: 'codex-grade-model',
      SELINA_MODEL_RETRIES: '4',
      SELINA_MODEL_TIMEOUT_MS: '12000',
    });

    const profile = service.selectProfile({ effortLevel: 'deep', domain: 'code' });
    expect(profile.provider).toBe('openai');
    expect(profile.apiMode).toBe('responses');
    expect(profile.model).toBe('codex-grade-model');
    expect(profile.retries).toBe(4);
    expect(profile.timeoutMs).toBe(12000);

    const diagnostics = service.diagnostics();
    expect(diagnostics.providerStatus.openai.configured).toBe(true);
    expect(diagnostics.providerStatus.openai.apiMode).toBe('responses');
    expect(JSON.stringify(diagnostics)).not.toContain('sk-secret-value');
  });

  it('selects a NIM Llama 4 Maverick profile without exposing secrets', () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'nim',
      NIM_API_KEY: 'nvapi-secret-value',
      SELINA_MODEL_RETRIES: '1',
    });

    const profile = service.selectProfile({ effortLevel: 'standard', domain: 'code' });
    expect(profile.provider).toBe('nim');
    expect(profile.apiMode).toBe('chat');
    expect(profile.model).toBe('meta/llama-4-maverick-17b-128e-instruct');
    expect(service.providerKind(profile)).toBe('openai-compatible');

    const diagnostics = service.diagnostics();
    expect(diagnostics.providerStatus.nim).toMatchObject({
      configured: true,
      model: 'meta/llama-4-maverick-17b-128e-instruct',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('nvapi-secret-value');
  });

  it('infers Gemini when no provider is explicit and only Gemini is configured', () => {
    const service = new ModelService({
      GEMINI_API_KEY: 'gemini-secret-value',
    });

    const profile = service.selectProfile({ effortLevel: 'quick', domain: 'classifier' });

    expect(profile.provider).toBe('gemini');
    expect(profile.model).toBe('gemini-2.0-flash');
    expect(service.providerStatus().activeProvider).toBe('gemini');
    expect(JSON.stringify(service.diagnostics())).not.toContain('gemini-secret-value');
  });

  it('builds Responses API function tools for OpenAI agents', () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-secret-value',
      OPENAI_MODEL: 'gpt-5.5',
    });
    const profile = service.selectProfile({ effortLevel: 'standard', domain: 'code' });

    const request = service.buildOpenAIResponsesRequest({
      profile,
      instructions: 'You are Selina.',
      input: [{ role: 'user', content: 'Read a file' }],
      tools: [{
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'OBJECT',
          properties: { path: { type: 'STRING' } },
          required: ['path'],
        },
      }],
    });

    expect(request.store).toBe(false);
    expect(request.parallel_tool_calls).toBe(false);
    expect(request.tools[0]).toMatchObject({
      type: 'function',
      name: 'read_file',
      strict: false,
    });
    expect(request.tools[0].parameters.properties.path.type).toBe('string');
  });

  it('builds NVIDIA NIM chat payloads with the expected sampling fields', () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'nim',
      NIM_API_KEY: 'nvapi-secret-value',
      NIM_TEMPERATURE: '0.75',
      NIM_TOP_P: '0.9',
      NIM_FREQUENCY_PENALTY: '0.1',
      NIM_PRESENCE_PENALTY: '0.2',
    });
    const profile = service.selectProfile({ effortLevel: 'quick', domain: 'code' });

    const request = service.buildOpenAIRequest({
      profile,
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [],
    });

    expect(request).toMatchObject({
      model: 'meta/llama-4-maverick-17b-128e-instruct',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024,
      temperature: 0.75,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      stream: false,
    });
  });

  it('sends NIM chat requests to NVIDIA with JSON accept headers', async () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'nim',
      NIM_API_KEY: 'nvapi-secret-value',
    });
    const profile = service.selectProfile({ effortLevel: 'quick', domain: 'code' });
    let captured = null;

    service.fetchJsonWithAuth = async (provider, url, buildOptions) => {
      captured = {
        provider,
        url,
        options: buildOptions({ type: 'api-key', value: 'nvapi-redacted', expiresAt: null }),
      };
      return {
        choices: [{ message: { content: 'ok' } }],
        usage: { total_tokens: 3 },
      };
    };

    const result = await service.openAICompatibleChat({
      profile,
      messages: [{ role: 'user', content: 'Ping' }],
      tools: [],
    });

    expect(result.content).toBe('ok');
    expect(captured.provider).toBe('nim');
    expect(captured.url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(captured.options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer nvapi-redacted',
    });
    expect(JSON.parse(captured.options.body)).toMatchObject({
      model: 'meta/llama-4-maverick-17b-128e-instruct',
      stream: false,
    });
  });

  it('normalizes Responses API message and function-call output', async () => {
    const service = new ModelService({
      SELINA_MODEL_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-secret-value',
      OPENAI_MODEL: 'gpt-5.5',
    });
    const profile = service.selectProfile({ effortLevel: 'standard', domain: 'code' });
    service.fetchJsonWithAuth = async () => ({
      id: 'resp_test',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'I need to inspect the file.' }],
        },
        {
          type: 'function_call',
          id: 'fc_test',
          call_id: 'call_test',
          name: 'read_file',
          arguments: '{"path":"src/App.jsx"}',
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.openAIResponses({
      profile,
      instructions: 'You are Selina.',
      input: [{ role: 'user', content: 'Read App.' }],
      tools: [],
    });

    expect(result.content).toBe('I need to inspect the file.');
    expect(result.toolCalls).toEqual([
      expect.objectContaining({
        callId: 'call_test',
        name: 'read_file',
        args: { path: 'src/App.jsx' },
      }),
    ]);
    expect(result.responseId).toBe('resp_test');
  });

  it('trims Gemini history within a token budget and starts on a user turn', () => {
    const service = new ModelService({});
    const history = [
      { role: 'model', parts: [{ text: 'orphan assistant' }] },
      { role: 'user', parts: [{ text: 'short' }] },
      { role: 'model', parts: [{ text: 'answer' }] },
      { role: 'user', parts: [{ text: 'x'.repeat(1000) }] },
      { role: 'model', parts: [{ text: 'latest' }] },
    ];

    const trimmed = service.trimGeminiHistory(history, 300);
    expect(trimmed.length).toBeGreaterThan(0);
    expect(trimmed[0].role).toBe('user');
    expect(trimmed.at(-1).role).toBe('model');
  });

  it('keeps bounded audit diagnostics', () => {
    const service = new ModelService({});
    for (let i = 0; i < 300; i++) service.recordAudit({ kind: 'test', i, apiKey: 'secret' });

    const diagnostics = service.diagnostics();
    expect(diagnostics.auditTail).toHaveLength(25);
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
  });

  it('classifies Gemini free-tier quota exhaustion as fallbackable but not retryable', () => {
    const classification = classifyModelError(new Error(
      '[429 Too Many Requests] Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-2.0-flash Please retry in 46.383132222s.'
    ));

    expect(classification.code).toBe('quota_exceeded');
    expect(classification.retryable).toBe(false);
    expect(classification.fallbackable).toBe(true);
    expect(classification.retryAfterMs).toBe(46384);
  });

  it('selects only explicitly configured fallback providers with credentials', () => {
    const env = {
      SELINA_MODEL_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'gemini-key',
      OPENAI_API_KEY: 'sk-openai',
      OPENAI_MODEL: 'gpt-fallback',
      ANTHROPIC_MODEL: 'claude-fallback',
      SELINA_MODEL_FALLBACKS: 'openai,anthropic,qwen',
    };
    const auth = new AgentAuthManager({ env });
    const service = new ModelService(env, auth);
    const primary = service.selectProfile({ effortLevel: 'standard', domain: 'code' });
    const fallbacks = service.selectFallbackProfiles(primary);

    expect(primary.provider).toBe('gemini');
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-fallback',
      apiMode: 'responses',
    });
  });

  it('falls back from NIM quota exhaustion to the configured OpenAI provider', async () => {
    const env = {
      SELINA_MODEL_PROVIDER: 'nim',
      NIM_API_KEY: 'nvapi-primary',
      NIM_MODEL: 'meta/llama-4-maverick-17b-128e-instruct',
      OPENAI_API_KEY: 'sk-openai',
      OPENAI_MODEL: 'gpt-fallback',
      SELINA_MODEL_FALLBACKS: 'openai',
    };
    const auth = new AgentAuthManager({ env });
    const service = new ModelService(env, auth);

    service.openAICompatibleChat = async ({ profile }) => {
      if (profile.provider === 'nim') {
        throw new Error('[429 Too Many Requests] Quota exceeded for metric: free_tier_requests. Please retry in 46s.');
      }
      return { content: 'unexpected chat fallback' };
    };
    service.openAIResponses = async ({ profile }) => ({
      content: `fallback via ${profile.provider}`,
    });

    const result = await service.completeText({
      prompt: 'Refactor this file.',
      domain: 'code',
      effortLevel: 'standard',
    });

    expect(result.content).toBe('fallback via openai');
    expect(result.profile).toMatchObject({
      provider: 'openai',
      model: 'gpt-fallback',
    });
    expect(service.audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'provider_fallback',
        fromProvider: 'nim',
        toProvider: 'openai',
        reason: 'quota_exceeded',
        retryAfterMs: 46000,
      }),
    ]));
  });
});
