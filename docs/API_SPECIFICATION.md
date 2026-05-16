# Vibe Hub Integration API

**Version:** 6.0.0  
**Updated:** 2026-05-16  
**Primary REST base:** `http://localhost:3001/api/v6/integration`  
**Swagger UI:** `http://localhost:3001/api-docs`  
**OpenAPI JSON:** `http://localhost:3001/swagger.json`

## Purpose

The backend now exposes a single integration-facing API namespace at `/api/v6/integration`.

This facade wraps the existing backend capabilities into one stable surface for:

- service-to-service integrations
- Postman testing
- headless orchestration runs
- VFS review flows
- repository, MCP, chat, preferences, runtime, and run-record access

Legacy routes such as `/api/code`, `/api/fs/*`, and `/api/v6/*` still exist for compatibility, but new integrations should use `/api/v6/integration/*`.

## Authentication

The integration API supports two auth modes:

1. `Authorization: Bearer <access-token>`
2. `X-API-Key: <service-api-key>`

### Bearer token flow

Use the normal auth bootstrap endpoints:

- `GET /api/v6/auth/status`
- `POST /api/v6/auth/handoff`
- `POST /api/v6/auth/refresh`

This is best when a human user signs in and your integration is acting on their behalf.

### Service token flow

Set one of these server env vars:

- `SELINA_SERVICE_API_KEY`
- `SELINA_SERVICE_API_KEYS`

For service-authenticated requests that need user-scoped data, include:

- `X-Acting-User-Id: <user-id>`

You can also send `userId` in the body or query string, but the header is the cleanest option for Postman and external services.

## Postman Quick Start

Create a Postman environment with:

- `baseUrl` = `http://localhost:3001`
- `serviceApiKey` = your `SELINA_SERVICE_API_KEY`
- `actingUserId` = a real user id from your system
- `accessToken` = optional bearer token if you test the user-token flow

Recommended auth header sets:

### Service auth

```http
X-API-Key: {{serviceApiKey}}
X-Acting-User-Id: {{actingUserId}}
Content-Type: application/json
```

### Bearer auth

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

## Discovery Endpoints

### `GET /api/v6/integration`

Returns the integration manifest, auth guidance, and docs URLs.

### `GET /api/v6/integration/operations`

Returns the operation catalog for all wrapped endpoints.

## Core Endpoints

### Headless code run

`POST /api/v6/integration/code/run`

This is the main backend entrypoint for external services. Unlike the legacy `/api/code` route, this one supports headless execution and does not require a live `socketId`.

Request:

```json
{
  "prompt": "Create a health-check helper and update the route to use it",
  "targetFile": "apps/server-bridge/index.js",
  "effortLevel": "standard"
}
```

Successful synchronous response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "code": "...",
    "retries": 0,
    "effortLevel": "standard",
    "stagedFile": {
      "filePath": "apps/server-bridge/index.js",
      "status": "pending_review"
    }
  }
}
```

Queued or fallback response:

```json
{
  "success": true,
  "jobId": "job_123",
  "requestId": "req_123"
}
```

or

```json
{
  "success": false,
  "error": "Fatal failure: ...",
  "rollbackCount": 1,
  "fallback": {
    "domain": "code"
  }
}
```

### Job status

`GET /api/v6/integration/code/jobs/:jobId`

Use this when queue-backed orchestration is enabled.

### Pending VFS files

`GET /api/v6/integration/vfs/pending`

Lists staged files waiting for approval.

### VFS stats

`GET /api/v6/integration/vfs/stats`

Returns aggregate staged/approved/rejected/committed counts.

### Approve or reject staged file

`POST /api/v6/integration/vfs/commit`

Request:

```json
{
  "filePath": "apps/server-bridge/index.js",
  "approved": true
}
```

Response:

```json
{
  "success": true,
  "message": "committed",
  "filePath": "apps/server-bridge/index.js"
}
```

## Secondary Backend Surfaces

### Repositories

- `POST /api/v6/integration/repos/link`
- `GET /api/v6/integration/repos`

### MCP

- `GET /api/v6/integration/mcp/tools`
- `GET /api/v6/integration/mcp/servers`
- `GET /api/v6/integration/mcp/diagnostics`
- `POST /api/v6/integration/mcp/call`

### Runtime

- `GET /api/v6/integration/runtime/diagnostics`
- `GET /api/v6/integration/runtime/experts`
- `GET /api/v6/integration/runtime/skills`
- `GET /api/v6/integration/runtime/brand`

### Audit logs

- `GET /api/v6/integration/audit-logs`

### Chat persistence

- `GET /api/v6/integration/chat/sessions`
- `POST /api/v6/integration/chat/sessions`
- `GET /api/v6/integration/chat/sessions/:id/messages`
- `POST /api/v6/integration/chat/sessions/:id/messages`

### Preferences

- `GET /api/v6/integration/preferences`
- `POST /api/v6/integration/preferences`
- `POST /api/v6/integration/preferences/bulk`

### Run records and artifacts

- `GET /api/v6/integration/runs/:runId`
- `GET /api/v6/integration/runs/:runId/events`
- `GET /api/v6/integration/runs/:runId/artifacts`

### Approval grants

- `POST /api/v6/integration/approvals/grants`

## Error Format

Validation and auth failures follow this structure:

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "INTEGRATION_AUTH_REQUIRED",
  "requestId": "req_123",
  "details": [
    {
      "field": "targetFile",
      "message": "Path must be relative"
    }
  ]
}
```

## Current Limitations

- OAuth bootstrap routes remain under `/api/v6/auth/*` because they are still the canonical session entrypoints.
- WebSocket and Socket.IO event streams are still separate from the REST facade.
- The integration API wraps the backend’s real REST capabilities; it does not invent missing terminal routes that are not mounted in the current server.

## Recommended Integration Pattern

1. Authenticate with bearer token or service API key.
2. Call `GET /api/v6/integration` once at startup to verify connectivity.
3. Use `POST /api/v6/integration/code/run` for orchestration work.
4. Review staged files with the VFS endpoints.
5. Use the MCP, repos, chat, preferences, and run-record routes as supporting services.

## Related Files

- [OpenAPI generator](../apps/server-bridge/utils/openapi.js)
- [Integration router](../apps/server-bridge/integration/router.js)
- [Postman collection](./postman/Vibe-Hub-Integration.postman_collection.json)
- [Integration guide](./INTEGRATION_API_GUIDE.md)
