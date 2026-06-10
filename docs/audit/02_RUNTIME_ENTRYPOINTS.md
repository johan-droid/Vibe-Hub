# Runtime Entrypoints

**IMPLEMENTED** = Found in code and functional
**PARTIAL** = Partially implemented / buggy
**BROKEN** = Code exists but is fundamentally broken
**DOCS ONLY** = Mentioned but not implemented
**UNKNOWN** = Needs further investigation

## Backend Entrypoints
- `apps/server-bridge/index.js`: IMPLEMENTED. Starts the Express server, connects to DB, mounts routes, and initiates the socket server.
- `apps/server-bridge/orchestrator/index.js`: IMPLEMENTED. Central hub for initiating AI runs.

## Frontend Entrypoints
- `apps/user-interface/src/main.jsx`: IMPLEMENTED. Mounts the React application.
- `apps/user-interface/src/App.jsx`: IMPLEMENTED. Sets up routing and core providers.

## Worker/Background Entrypoints
- `heavy-lift.yml`: IMPLEMENTED. GitHub action for async large-scale tasks.
- BullMQ Background Workers: IMPLEMENTED. Discovered in `job-queue.test.js`.
