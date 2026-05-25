import { INTEGRATION_BASE_PATH } from '../integration/manifest.js';

const jsonContent = (schema, example) => ({
  'application/json': {
    schema,
    ...(example ? { example } : {}),
  },
});

const successEnvelope = (properties = {}) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    ...properties,
  },
});

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string' },
    code: { type: 'string', nullable: true },
    requestId: { type: 'string', nullable: true },
    details: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Vibe Hub Integration API',
      version: '6.0.0',
      description: 'Unified REST facade for orchestration, VFS review, runtime diagnostics, chat, preferences, repositories, run records, and MCP-backed tools.',
    },
    servers: [
      { url: '/', description: 'Server root' },
    ],
    tags: [
      { name: 'Integration', description: 'Facade discovery and operational metadata.' },
      { name: 'Auth', description: 'OAuth/session bootstrap endpoints used before calling the integration facade.' },
      { name: 'Code', description: 'Headless orchestration and run execution.' },
      { name: 'VFS', description: 'Approval-gated staged file review.' },
      { name: 'Content', description: 'Imported text harnessing and agent-memory ingestion.' },
      { name: 'Repos', description: 'Repository linking and listing.' },
      { name: 'MCP', description: 'Model Context Protocol tool discovery and invocation.' },
      { name: 'Runtime', description: 'Diagnostics and public product metadata.' },
      { name: 'Chat', description: 'Persistent chat sessions and messages.' },
      { name: 'Preferences', description: 'User preference synchronization.' },
      { name: 'Runs', description: 'Stored orchestration run metadata and artifacts.' },
      { name: 'Approvals', description: 'Approval grants for guarded tool execution.' },
    ],
    paths: {
      '/api/v6/integration': {
        get: {
          tags: ['Integration'],
          summary: 'Get integration manifest',
          description: 'Returns the base path, supported authentication modes, and documentation endpoints for service integrations and Postman clients.',
          responses: {
            200: {
              description: 'Integration manifest',
              content: jsonContent(successEnvelope({
                name: { type: 'string' },
                version: { type: 'string' },
                basePath: { type: 'string' },
              })),
            },
          },
        },
      },
      '/api/v6/integration/operations': {
        get: {
          tags: ['Integration'],
          summary: 'List integration operations',
          responses: {
            200: {
              description: 'Operation catalog',
              content: jsonContent(successEnvelope({
                basePath: { type: 'string' },
                operations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      method: { type: 'string' },
                      path: { type: 'string' },
                      auth: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
              })),
            },
          },
        },
      },
      '/api/v6/auth/status': {
        get: {
          tags: ['Auth'],
          summary: 'Probe authentication state',
          responses: {
            200: {
              description: 'Authentication status',
              content: jsonContent(successEnvelope({
                authenticated: { type: 'boolean' },
                user: { $ref: '#/components/schemas/User', nullable: true },
                sessionId: { type: 'string', nullable: true },
              })),
            },
          },
        },
      },
      '/api/v6/auth/handoff': {
        post: {
          tags: ['Auth'],
          summary: 'Exchange OAuth handoff code for session cookies',
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string' },
              },
            }),
          },
          responses: {
            200: {
              description: 'Authenticated session established',
              content: jsonContent(successEnvelope({
                authenticated: { type: 'boolean' },
                user: { $ref: '#/components/schemas/User' },
                sessionId: { type: 'string' },
                provider: { type: 'string' },
              })),
            },
            401: {
              description: 'Invalid handoff',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      '/api/v6/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token from refresh cookie or refresh token body',
          responses: {
            200: {
              description: 'Token refreshed',
              content: jsonContent(successEnvelope()),
            },
            401: {
              description: 'Refresh rejected',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/code/run`]: {
        post: {
          tags: ['Code'],
          summary: 'Run a headless orchestration job',
          description: 'Runs the same backend orchestration pipeline used by the product UI, but without requiring a live socket connection. This is the preferred route for Postman and service-to-service usage.',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({ $ref: '#/components/schemas/IntegrationCodeRunRequest' }),
          },
          responses: {
            200: {
              description: 'Run completed synchronously',
              content: jsonContent(successEnvelope({
                data: { $ref: '#/components/schemas/CodeRunResult' },
              })),
            },
            202: {
              description: 'Run queued or fallback payload returned',
              content: jsonContent(successEnvelope({
                jobId: { type: 'string', nullable: true },
                requestId: { type: 'string', nullable: true },
                error: { type: 'string', nullable: true },
                fallback: { type: 'object', additionalProperties: true, nullable: true },
              })),
            },
            400: {
              description: 'Validation failed',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/code/jobs/{jobId}`]: {
        get: {
          tags: ['Code'],
          summary: 'Get orchestration job status',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'X-Acting-User-Id', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Job status',
              content: jsonContent(successEnvelope({
                job: { type: 'object', additionalProperties: true },
              })),
            },
            404: {
              description: 'Job not found',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/vfs/pending`]: {
        get: {
          tags: ['VFS'],
          summary: 'List pending staged files',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'X-Acting-User-Id', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Pending files',
              content: jsonContent(successEnvelope({
                files: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/StagedFile' },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/vfs/stats`]: {
        get: {
          tags: ['VFS'],
          summary: 'Get VFS statistics',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'X-Acting-User-Id', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'VFS stats',
              content: jsonContent(successEnvelope({
                stats: {
                  type: 'object',
                  additionalProperties: { type: 'number' },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/vfs/commit`]: {
        post: {
          tags: ['VFS'],
          summary: 'Approve or reject a staged file',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['filePath', 'approved'],
              properties: {
                filePath: { type: 'string' },
                approved: { type: 'boolean' },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Commit/reject result',
              content: jsonContent(successEnvelope({
                message: { type: 'string' },
                filePath: { type: 'string' },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/content/harness`]: {
        post: {
          tags: ['Content'],
          summary: 'Harness imported text into agent memory',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['sourceName', 'content'],
              properties: {
                sourceName: { type: 'string' },
                sourcePath: { type: 'string', nullable: true },
                projectName: { type: 'string', nullable: true },
                content: { type: 'string' },
                mimeType: { type: 'string', nullable: true },
                kind: {
                  type: 'string',
                  enum: ['upload', 'note', 'document', 'dataset', 'repo_doc'],
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Content harnessed',
              content: jsonContent(successEnvelope({
                harnessed: {
                  type: 'object',
                  properties: {
                    sourceName: { type: 'string' },
                    sourcePath: { type: 'string', nullable: true },
                    projectName: { type: 'string' },
                    summary: { type: 'string' },
                    keywords: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    itemsStored: { type: 'integer' },
                    chunkCount: { type: 'integer' },
                    tokenCount: { type: 'integer' },
                    truncated: { type: 'boolean' },
                    contentHash: { type: 'string' },
                  },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/repos/link`]: {
        post: {
          tags: ['Repos'],
          summary: 'Link a repository',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string', format: 'uri' },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Repository linked',
              content: jsonContent(successEnvelope({
                project: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/repos`]: {
        get: {
          tags: ['Repos'],
          summary: 'List linked repositories',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Repositories listed',
              content: jsonContent(successEnvelope({
                repos: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/mcp/tools`]: {
        get: {
          tags: ['MCP'],
          summary: 'List MCP tools',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Tools listed',
              content: jsonContent(successEnvelope({
                tools: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/mcp/servers`]: {
        get: {
          tags: ['MCP'],
          summary: 'List MCP servers',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Servers listed',
              content: jsonContent(successEnvelope({
                servers: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/mcp/diagnostics`]: {
        get: {
          tags: ['MCP'],
          summary: 'Get MCP diagnostics',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Diagnostics payload',
              content: jsonContent(successEnvelope({
                diagnostics: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/mcp/call`]: {
        post: {
          tags: ['MCP'],
          summary: 'Call an MCP tool',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['toolId'],
              properties: {
                toolId: { type: 'string' },
                arguments: { type: 'object', additionalProperties: true },
                actionGrant: { type: 'string', nullable: true },
                runId: { type: 'string', nullable: true },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Tool result',
              content: jsonContent(successEnvelope({
                result: { type: 'object', additionalProperties: true },
              })),
            },
            403: {
              description: 'Authorization denied',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runtime/diagnostics`]: {
        get: {
          tags: ['Runtime'],
          summary: 'Get model-runtime diagnostics',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Diagnostics response',
              content: jsonContent({ type: 'object', additionalProperties: true }),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runtime/experts`]: {
        get: {
          tags: ['Runtime'],
          summary: 'Get expert-router diagnostics',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Expert diagnostics',
              content: jsonContent(successEnvelope({
                diagnostics: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runtime/skills`]: {
        get: {
          tags: ['Runtime'],
          summary: 'Get active skill graph',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Skill graph',
              content: jsonContent({
                type: 'object',
                properties: {
                  mode: { type: 'string' },
                  graph: { type: 'object', additionalProperties: true },
                },
              }),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runtime/brand`]: {
        get: {
          tags: ['Runtime'],
          summary: 'Get public product metadata',
          responses: {
            200: {
              description: 'Brand metadata',
              content: jsonContent(successEnvelope({
                brand: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/audit-logs`]: {
        get: {
          tags: ['Runtime'],
          summary: 'List audit logs',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'resourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 500 } },
            { name: 'X-Acting-User-Id', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Audit logs',
              content: jsonContent(successEnvelope({
                logs: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/chat/sessions`]: {
        get: {
          tags: ['Chat'],
          summary: 'List chat sessions',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Chat sessions',
              content: jsonContent(successEnvelope({
                sessions: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
        post: {
          tags: ['Chat'],
          summary: 'Create a chat session',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: false,
            content: jsonContent({
              type: 'object',
              properties: {
                title: { type: 'string', nullable: true },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Session created',
              content: jsonContent(successEnvelope({
                session: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/chat/sessions/{id}/messages`]: {
        get: {
          tags: ['Chat'],
          summary: 'List chat messages',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Messages listed',
              content: jsonContent(successEnvelope({
                messages: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
        post: {
          tags: ['Chat'],
          summary: 'Append a chat message',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string' },
                content: { type: 'string' },
                thoughts: {
                  type: 'array',
                  items: { type: 'string' },
                },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Message appended',
              content: jsonContent(successEnvelope({
                message: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/preferences`]: {
        get: {
          tags: ['Preferences'],
          summary: 'Read user preferences',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          responses: {
            200: {
              description: 'Preferences document',
              content: jsonContent(successEnvelope({
                preferences: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
        post: {
          tags: ['Preferences'],
          summary: 'Upsert one preference group',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['preferenceType', 'content'],
              properties: {
                preferenceType: {
                  type: 'string',
                  enum: ['language', 'aesthetic', 'env', 'workflow', 'ui_theme'],
                },
                content: { type: 'object', additionalProperties: true },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Preference stored',
              content: jsonContent(successEnvelope({
                preference: { type: 'object', additionalProperties: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/preferences/bulk`]: {
        post: {
          tags: ['Preferences'],
          summary: 'Bulk-update preferences',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['preferences'],
              properties: {
                preferences: { type: 'object', additionalProperties: true },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Preferences updated',
              content: jsonContent(successEnvelope({
                count: { type: 'integer' },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runs/{runId}`]: {
        get: {
          tags: ['Runs'],
          summary: 'Get a run record',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Run record',
              content: jsonContent(successEnvelope({
                run: { type: 'object', additionalProperties: true },
              })),
            },
            404: {
              description: 'Run not found',
              content: jsonContent(errorEnvelope),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runs/{runId}/events`]: {
        get: {
          tags: ['Runs'],
          summary: 'List run events',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Run events',
              content: jsonContent(successEnvelope({
                events: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/runs/{runId}/artifacts`]: {
        get: {
          tags: ['Runs'],
          summary: 'Get run artifacts',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          parameters: [
            { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Artifacts payload',
              content: jsonContent(successEnvelope({
                artifacts: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true },
                },
                rolloutPaths: { type: 'array', items: { type: 'string' }, nullable: true },
              })),
            },
          },
        },
      },
      [`${INTEGRATION_BASE_PATH}/approvals/grants`]: {
        post: {
          tags: ['Approvals'],
          summary: 'Create an approval grant',
          security: [{ bearerAuth: [] }, { serviceApiKey: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: 'object',
              required: ['runId', 'toolName', 'decision'],
              properties: {
                runId: { type: 'string' },
                toolName: { type: 'string' },
                decision: { type: 'string', enum: ['approve', 'deny'] },
                reason: { type: 'string', nullable: true },
                params: { type: 'object', additionalProperties: true, nullable: true },
                paramsHash: { type: 'string', nullable: true },
                userId: { type: 'string', nullable: true },
              },
            }),
          },
          responses: {
            200: {
              description: 'Grant created',
              content: jsonContent(successEnvelope({
                grant: {
                  type: 'object',
                  properties: {
                    grantId: { type: 'string' },
                    token: { type: 'string', nullable: true },
                    expiresAt: { type: 'string' },
                    paramsHash: { type: 'string' },
                  },
                },
              })),
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Selina access token from the auth flow.',
        },
        serviceApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Machine-to-machine key configured via SELINA_SERVICE_API_KEY or SELINA_SERVICE_API_KEYS.',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', nullable: true },
            name: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            provider: { type: 'string', nullable: true },
          },
        },
        IntegrationCodeRunRequest: {
          type: 'object',
          required: ['prompt', 'targetFile'],
          properties: {
            prompt: { type: 'string', maxLength: 1000 },
            targetFile: { type: 'string', description: 'Relative workspace path only.' },
            effortLevel: { type: 'string', enum: ['quick', 'standard', 'deep'], default: 'standard' },
            socketId: { type: 'string', nullable: true, description: 'Optional. Include it if you also want socket.io progress streaming.' },
            userId: { type: 'string', nullable: true, description: 'Optional for bearer auth. Required for service-authenticated user-scoped runs when X-Acting-User-Id is not set.' },
          },
        },
        CodeRunResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            code: { type: 'string', nullable: true },
            astGraph: { type: 'object', additionalProperties: true, nullable: true },
            retries: { type: 'integer', nullable: true },
            effortLevel: { type: 'string', nullable: true },
            crossFileCoherenceEnabled: { type: 'boolean', nullable: true },
            stagedFile: { $ref: '#/components/schemas/StagedFile', nullable: true },
          },
        },
        StagedFile: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            status: { type: 'string' },
            originalContent: { type: 'string', nullable: true },
            proposedContent: { type: 'string', nullable: true },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
      },
    },
  };
}

export function apiDocsHtml() {
  return `<!doctype html>
<html>
  <head>
    <title>Vibe Hub Integration API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: '/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;
}
