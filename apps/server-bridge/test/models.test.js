import { describe, it, expect } from 'vitest';
import { ModelService, normalizeJsonSchema } from '../orchestrator/models.js';

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
    expect(profile.model).toBe('codex-grade-model');
    expect(profile.retries).toBe(4);
    expect(profile.timeoutMs).toBe(12000);

    const diagnostics = service.diagnostics();
    expect(diagnostics.providerStatus.openai.configured).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain('sk-secret-value');
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
});
