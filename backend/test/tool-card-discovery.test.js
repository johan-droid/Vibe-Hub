import { describe, expect, it } from 'vitest';
import {
  createDraftToolCards,
  createOpenApiToolCards,
  createToolCard,
  inferToolRisk,
} from '../orchestrator/tool-card-discovery.js';

describe('Adopt-style tool card discovery', () => {
  it('turns built-in tool schemas into disabled draft cards with risk labels', () => {
    const report = createDraftToolCards({
      tools: [
        { name: 'read_file', description: 'Reads a file', parameters: { type: 'OBJECT', properties: {}, required: [] } },
        { name: 'patch_file', description: 'Patch a file', parameters: { type: 'OBJECT', properties: {}, required: [] } },
      ],
    });

    expect(report).toMatchObject({
      source: 'adopt-zapi-style-discovery',
      status: 'draft',
      enabled: false,
    });
    expect(report.cards).toEqual([
      expect.objectContaining({ name: 'read_file', risk: 'readonly', enabled: false, reviewRequired: true }),
      expect.objectContaining({ name: 'patch_file', risk: 'write', approvalRequired: true, enabled: false }),
    ]);
  });

  it('creates OpenAPI cards without auto-enabling mutating operations', () => {
    const cards = createOpenApiToolCards({
      paths: {
        '/runs/{id}': {
          get: {
            operationId: 'getRun',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
          post: {
            operationId: 'retryRun',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['reason'],
                    properties: { reason: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(cards).toEqual([
      expect.objectContaining({ name: 'getRun', source: 'openapi', risk: 'readonly', enabled: false }),
      expect.objectContaining({ name: 'retryRun', source: 'openapi', risk: 'write', enabled: false, approvalRequired: true }),
    ]);
    expect(cards[1].inputSchema.properties.body.required).toEqual(['reason']);
  });

  it('honors declared MCP/helper risk annotations', () => {
    expect(inferToolRisk({ name: 'remote__query', metadata: { risk: 'readonly' } })).toBe('readonly');
    expect(createToolCard({
      name: 'helper_validate_json',
      metadata: { source: 'helper-tool-pack', risk: 'readonly' },
    })).toMatchObject({
      source: 'helper-tool-pack',
      risk: 'readonly',
      enabled: false,
    });
  });
});
