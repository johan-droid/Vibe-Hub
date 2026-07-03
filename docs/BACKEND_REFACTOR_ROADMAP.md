# Vibe Hub Backend Refactor Roadmap

This roadmap is the execution map for turning `apps/server-bridge` from a fast-moving prototype backend into a production-grade, observable, secure, maintainable service.

## North-star architecture

The backend should be organized around explicit runtime boundaries:

```txt
HTTP edge / WebSocket edge
  -> Auth, session, tenant, CSRF, rate-limit, request context
  -> API routers
  -> Application services
  -> Domain modules
  -> Infrastructure adapters: database, Redis, GitHub, LLM providers, sandbox, MCP
```

The current code works, but too much bootstrapping, routing, orchestration, WebSocket state, webhook handling, rate limits, and diagnostics are concentrated in `apps/server-bridge/index.js`. Refactoring must be surgical: no large rewrite, no behavior loss, no weakened security gates.

## Execution phases

### Phase 1 — Runtime safety and deployment determinism

Goal: every Render/GHCR/Vercel deployment either starts correctly or fails with a clear, actionable error.

Tasks:

1. Strengthen environment validation.
2. Validate URL/origin groups consistently: `UI_ORIGIN`, `UI_ALLOWED_ORIGINS`, `FRONTEND_ORIGINS`, `API_ORIGIN`.
3. Validate production secrets for minimum entropy and reject obvious placeholders.
4. Centralize production cookie topology decisions.
5. Make readiness report degraded dependencies clearly instead of hiding failures.
6. Keep Docker images minimal: no daemon, no Docker CLI, no Git unless required at runtime.

Definition of done:

- Broken production env fails during boot with a precise error.
- Auth cookie policy is derived from deployment topology.
- CI image scans have less false noise because the runtime image has fewer packages.

### Phase 2 — Auth/session reliability

Goal: no login loop, no stale client state, no broken cross-origin cookies.

Tasks:

1. Make OAuth callback idempotent and recover from already-consumed handoff codes.
2. Ensure `/api/auth/status`, `/api/me`, and refresh semantics return consistent user payloads.
3. Add explicit session lifecycle states: active, refreshed, revoked, expired, suspicious.
4. Add integration tests for:
   - OAuth handoff success
   - stale handoff fallback
   - refresh-token rotation
   - logout current device
   - logout all devices
5. Ensure frontend route guards wait for server session verification before redirecting.

Definition of done:

- Reload after login preserves dashboard session.
- Callback duplicate execution does not log the user out.
- Cross-origin Render/Vercel login works with `SameSite=None; Secure` when required.

### Phase 3 — Router decomposition

Goal: reduce `index.js` into a composition root only.

Target file map:

```txt
apps/server-bridge/server/create-app.js
apps/server-bridge/server/create-http-server.js
apps/server-bridge/server/register-core-middleware.js
apps/server-bridge/server/register-auth-routes.js
apps/server-bridge/server/register-runtime-routes.js
apps/server-bridge/server/register-webhook-routes.js
apps/server-bridge/server/register-orchestrator-routes.js
apps/server-bridge/server/register-error-handlers.js
apps/server-bridge/server/websocket-gateway.js
apps/server-bridge/server/socketio-gateway.js
```

Tasks:

1. Move CORS/helmet/body/cookie/request logging into `register-core-middleware.js`.
2. Move `/health`, `/ready`, `/metrics`, `/swagger.json`, `/api-docs` into runtime routes.
3. Move GitHub webhook handler into webhook routes.
4. Move WebSocket connection/session logic into a gateway module.
5. Keep exports testable and avoid circular imports.

Definition of done:

- `index.js` only loads config, creates app/server, registers modules, and starts/shuts down.

### Phase 4 — Database and persistence hardening

Goal: make persistence predictable under load and easy to migrate.

Tasks:

1. Split `db.js` into connection, migrations, repositories, and transaction helpers.
2. Add query timeout defaults and structured DB error mapping.
3. Convert direct SQL callers to repository functions.
4. Add schema migration checks in readiness.
5. Add tests around session/user/preference/run-store repositories.

Target map:

```txt
apps/server-bridge/db/pool.js
apps/server-bridge/db/migrations.js
apps/server-bridge/db/repositories/users.js
apps/server-bridge/db/repositories/sessions.js
apps/server-bridge/db/repositories/preferences.js
apps/server-bridge/db/repositories/runs.js
apps/server-bridge/db/errors.js
```

### Phase 5 — Orchestration and tool execution boundaries

Goal: agent execution must be secure, observable, cancellable, and quota-aware.

Tasks:

1. Treat each agent run as a durable state machine.
2. Move tool authorization, schema validation, policy validation, cost controls, and audit logging into one execution pipeline.
3. Add run cancellation and retry semantics.
4. Split user-interactive work from background jobs.
5. Add OpenTelemetry spans for model calls, tool calls, sandbox execution, GitHub calls, and DB writes.

### Phase 6 — Sandbox and MCP isolation

Goal: sandbox/MCP cannot compromise production runtime.

Tasks:

1. Default production sandbox provider to disabled unless explicitly configured.
2. Move Docker/local sandbox into an optional worker profile.
3. Use allowlisted runtime images and network-deny by default.
4. Enforce file copy allowlist and secret-file denylist.
5. Add sandbox capability diagnostics to `/ready`.

### Phase 7 — API contract and error model

Goal: all clients receive consistent, debuggable responses.

Tasks:

1. Create a shared error envelope:
   ```json
   { "success": false, "error": { "code": "...", "message": "...", "requestId": "..." } }
   ```
2. Normalize validation, auth, CSRF, rate limit, concurrency, provider, and DB errors.
3. Add OpenAPI route metadata where missing.
4. Add API compatibility tests.

### Phase 8 — CI/CD and release gates

Goal: CI should catch real regressions without blocking on non-actionable noise.

Tasks:

1. Keep unit/integration/security tests in `quality-gate`.
2. Keep image scanning strict for actionable vulnerabilities.
3. Generate SARIF for visibility.
4. Add smoke deployment checks after Render hook.
5. Add rollback notes and immutable image tag tracking.

## First implementation slice

The first slice should be small, reviewable, and high-impact:

1. Harden `utils/env.js`.
2. Introduce a runtime deployment config helper if needed.
3. Keep auth cookie behavior deterministic.
4. Remove unnecessary production image packages.
5. Add tests for environment validation.

## Non-goals

- No framework rewrite.
- No removal of existing APIs.
- No weakening auth/session security.
- No disabling security scans as the primary fix.
- No large untestable commits.
