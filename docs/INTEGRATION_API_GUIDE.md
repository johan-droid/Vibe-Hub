# Integration API Guide

## What Changed

The backend is now wrapped behind a dedicated facade:

- Base URL: `http://localhost:3001/api/v6/integration`

This route family is designed for:

- external services
- automation workers
- QA and Postman testing
- headless backend orchestration

## Why Use This Instead of Legacy Routes

The older backend routes were built around the product UI and included assumptions like live socket connections and split route families. The integration facade gives you:

- one stable namespace
- one documented auth model
- headless code execution
- a simpler entrypoint for external systems

## Auth Options

### Option A: Bearer token

Use this when the integration is acting as a signed-in user.

Headers:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

### Option B: Service API key

Use this for backend-to-backend calls, cron jobs, QA tools, or Postman.

Server env:

```bash
SELINA_SERVICE_API_KEY=replace-with-a-long-random-secret
```

Headers:

```http
X-API-Key: <service-api-key>
X-Acting-User-Id: <user-id>
Content-Type: application/json
```

## Most Common Flows

### 1. Connectivity check

```bash
curl http://localhost:3001/api/v6/integration
```

### 2. Run the orchestrator from Postman or another service

```bash
curl -X POST http://localhost:3001/api/v6/integration/code/run \
  -H "X-API-Key: $SELINA_SERVICE_API_KEY" \
  -H "X-Acting-User-Id: 11111111-1111-4111-8111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Refactor the validation helper and keep tests green",
    "targetFile": "apps/server-bridge/utils/validation.js",
    "effortLevel": "standard"
  }'
```

### 3. Review staged files

```bash
curl http://localhost:3001/api/v6/integration/vfs/pending \
  -H "X-API-Key: $SELINA_SERVICE_API_KEY" \
  -H "X-Acting-User-Id: 11111111-1111-4111-8111-111111111111"
```

### 4. Commit a staged file

```bash
curl -X POST http://localhost:3001/api/v6/integration/vfs/commit \
  -H "X-API-Key: $SELINA_SERVICE_API_KEY" \
  -H "X-Acting-User-Id: 11111111-1111-4111-8111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "apps/server-bridge/utils/validation.js",
    "approved": true
  }'
```

## Endpoint Groups

### Discovery

- `GET /api/v6/integration`
- `GET /api/v6/integration/operations`

### Orchestration and VFS

- `POST /api/v6/integration/code/run`
- `GET /api/v6/integration/code/jobs/:jobId`
- `GET /api/v6/integration/vfs/pending`
- `GET /api/v6/integration/vfs/stats`
- `POST /api/v6/integration/vfs/commit`

### Supporting backend services

- repos
- MCP tools
- runtime diagnostics
- audit logs
- chat persistence
- preferences
- run history
- approval grants

## Postman Setup

Import:

- [Collection](./postman/Vibe-Hub-Integration.postman_collection.json)

Create environment variables:

- `baseUrl`
- `serviceApiKey`
- `actingUserId`
- `accessToken`

Recommended default:

```text
baseUrl = http://localhost:3001
```

## Notes for Integrators

- `targetFile` must always be a relative path.
- The integration code route is headless, so `socketId` is optional.
- If you use `X-API-Key`, user-scoped endpoints still need an acting user.
- Swagger UI is available at `/api-docs`.
