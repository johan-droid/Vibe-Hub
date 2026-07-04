# Autonomous Stabilization & Refactor Changelog
**Date**: 2026-07-03

## Findings and Fixes

### Phase 0: Setup
- Fixed broken Vite module resolution and plugin setup in `frontend`. Vite and React plugins were missing from workspace root and dependencies causing builds to fail. Resynced dependencies and successfully generated build payload.

### Phase 1: Restore CI/CD
- Recreated missing workflows `.github/workflows/deploy.yml`, `agent-sandbox.yml`, `ai-sandbox.yml`, and `heavy-lift.yml`.
- **Branch Protection Note**: The `deploy.yml` pipeline runs tests, formatting, and security scans on push to `main`. Repository owners should configure GitHub branch protection to require the `lint-and-test` and build jobs to pass before allowing merges.

### Phase 2: Dual state-machine architecture
- Deleted `task-manager-v6.js` and legacy `task-manager.js`.
- Moved WebSocket commands (`add_task`, `run_queue`, `cancel_task`, etc.) to interface cleanly with the active BullMQ orchestration layer (`codeQueue`) and standard `v6` router pipeline.

### Phase 3: Decompose index.js
- Extracted monolithic `index.js` logic into `backend/server/` submodules (`register-core-middleware.js`, `register-auth-routes.js`, `register-runtime-routes.js`, `register-webhook-routes.js`, `register-orchestrator-routes.js`, `websocket-gateway.js`, `register-error-handlers.js`).
- Refactored `backend/index.js` to serve only as a clean entry point initializing DB, starting background workers, loading these modules, and gracefully managing shutdown.

### Phase 5: Remove native-build fragility
- Removed `better-sqlite3` from `backend/memory/index-repo.js` and `package.json` to prevent binary compilation timeouts during deployment.
- Swapped to `@libsql/client` ensuring cross-platform capability with minimal footprint.

### Phase 6: Fix Docker/Render port+healthcheck mismatch
- Updated `backend/Dockerfile` `HEALTHCHECK` to read `process.env.PORT` dynamically and point to `/health` rather than `/ready`, matching Render's deployment specification.
- Updated `frontend/Dockerfile` `HEALTHCHECK` to also parse `$PORT` effectively.

### Phase 7: Frontend bundle size
- Extracted heavy dependencies into `React.lazy()` boundaries in `Workspace.jsx` and `DiffViewer.jsx`.
- Removed dynamic imports for `src/services/api.js` to fix the `[INEFFECTIVE_DYNAMIC_IMPORT]` rollup warning and successfully reduced initial chunk payloads.

### Phase 8: Test coverage and observability gates
- Configured Vitest and `v8` coverage for both frontend and backend Workspaces.
- Updated `package.json` commands to invoke `--coverage`.
- **Note**: `OTEL_EXPORTER_OTLP_ENDPOINT` config added implicitly across existing tracing setups. Ensure this points to an active OpenTelemetry collector via `render.yaml`.

## Open Blockers / Remains Open
- **Phase 4 DB decomposition (Deferred)**: This phase was intentionally deferred. Splitting `backend/db.js` requires a dedicated migration pass because the backend test suite currently mocks `../db.js` directly, relying on it as a shared compatibility seam. Test mocks must be updated gradually in a separate effort.
- **Docker Image Build**: The `npm run docker:build` command fails due to environment-blocked limitations in the current sandbox (Docker-in-Docker overlayfs issues). However, the Dockerfiles have been statically inspected and updated to use runtime `$PORT` successfully. The image build requires verification on a real Docker host, CI, or Render.
