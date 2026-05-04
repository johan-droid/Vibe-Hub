export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Selina Server Bridge API',
      version: '6.0.0',
      description: 'Versioned API for auth, orchestration, VFS review, runtime diagnostics, metrics, and webhooks.',
    },
    servers: [
      { url: '/api/v6', description: 'Current API' },
      { url: '/api', description: 'Legacy compatibility alias' },
    ],
    paths: {
      '/csrf-token': {
        get: {
          summary: 'Issue a CSRF token for state-changing requests',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'CSRF token issued' } },
        },
      },
      '/me': {
        get: {
          summary: 'Get authenticated user profile',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Current user' }, 401: { description: 'Unauthorized' } },
        },
      },
      '/code': {
        post: {
          summary: 'Start code orchestration',
          security: [{ bearerAuth: [] }, { csrfToken: [] }],
          parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
          responses: { 200: { description: 'Agent completed' }, 202: { description: 'Rollback fallback' }, 503: { description: 'Dependencies unavailable' } },
        },
      },
      '/code/jobs/{jobId}': {
        get: {
          summary: 'Get queued code orchestration job status',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Job status' }, 404: { description: 'Job not found' } },
        },
      },
      '/fs/commit': {
        post: {
          summary: 'Approve or reject a staged VFS file',
          security: [{ bearerAuth: [] }, { csrfToken: [] }],
          responses: { 200: { description: 'Commit or rejection processed' }, 403: { description: 'CSRF rejected' } },
        },
      },
      '/fs/pending': {
        get: {
          summary: 'List pending VFS review files',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Pending files' } },
        },
      },
      '/fs/stats': {
        get: {
          summary: 'Get VFS staging statistics',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'VFS stats' } },
        },
      },
      '/runtime/diagnostics': {
        get: {
          summary: 'Get model provider diagnostics',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Diagnostics' } },
        },
      },
      '/runtime/skills': {
        get: {
          summary: 'Get live skill graph',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Skill graph' } },
        },
      },
      '/audit-logs': {
        get: {
          summary: 'List authenticated user audit events',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'resourceId', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500 } },
          ],
          responses: { 200: { description: 'Audit log rows' } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
    },
  };
}

export function apiDocsHtml() {
  return `<!doctype html>
<html>
  <head>
    <title>Selina API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>SwaggerUIBundle({ url: '/swagger.json', dom_id: '#swagger-ui' });</script>
  </body>
</html>`;
}
