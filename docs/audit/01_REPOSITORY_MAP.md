# Repository Map: Vibe Hub

**IMPLEMENTED** = Found in code and functional
**PARTIAL** = Partially implemented / buggy
**BROKEN** = Code exists but is fundamentally broken
**DOCS ONLY** = Mentioned but not implemented
**UNKNOWN** = Needs further investigation

## Root Files
- `package.json`: IMPLEMENTED (Contains workspaces for `apps/server-bridge` and `apps/user-interface`)
- `package-lock.json`: IMPLEMENTED
- `README.md`: IMPLEMENTED
- `ENGINEERING_PRINCIPLES.md`: IMPLEMENTED
- `scripts/`: IMPLEMENTED (Contains build, patch, evaluation, sanitize, and deployment scripts)
- `tests/`: DOCS ONLY (No root tests directory found, tests are inside workspaces)
- `.github/`: IMPLEMENTED (Workflows exist)
- `Dockerfiles`: IMPLEMENTED (Located in respective workspace directories)

## Backend (apps/server-bridge)
- `package.json`: IMPLEMENTED
- `index.js`: IMPLEMENTED (Main entrypoint)
- `db.js`: IMPLEMENTED (PostgreSQL database integration)
- `load-env.js`: IMPLEMENTED
- `orchestrator/`: IMPLEMENTED (Contains the core AI agent logic: Context compressions, state machines, skill routing, etc)
- `auth/`: IMPLEMENTED (JWT/OAuth routes and middleware)
- `vfs/`: IMPLEMENTED (Virtual File System logic)
- `sandbox/`: IMPLEMENTED (Docker/Code execution sandbox)
- `memory/`: IMPLEMENTED (Semantic search/pgvector memory management)
- `mcp/`: IMPLEMENTED (Model Context Protocol server integrations)
- `github/`: IMPLEMENTED (Out-of-band Manager Github logic)
- `utils/`: IMPLEMENTED
- `test/`: IMPLEMENTED (Comprehensive Vitest suite)

## Frontend (apps/user-interface)
- `package.json`: IMPLEMENTED
- `src/`: IMPLEMENTED (React components and features like DiffViewer, ChatInterface, ToolVisualizer)
- `public/`: IMPLEMENTED
- `e2e/`: UNKNOWN (To be audited)
- `vite.config.js`: IMPLEMENTED (Configured for PWA and API proxying)
- `eslint.config.js`: IMPLEMENTED
