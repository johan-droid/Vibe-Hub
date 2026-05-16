<div align="center">
  <img src="docs/assets/selina-banner.png" alt="Vibe-Hub Banner" width="100%" />

  # Vibe-Hub

  **An autonomous coding workspace with deterministic orchestration, a guarded VFS, and a React-based control surface**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Node](https://img.shields.io/badge/node-22.x-brightgreen)](https://nodejs.org/)
  [![npm](https://img.shields.io/badge/npm-%3E%3D10-orange)](https://www.npmjs.com/)
</div>

## Overview

Vibe-Hub is a workspace for AI-assisted software development. The repository is split into two production workspaces: `apps/server-bridge` for orchestration, auth, sandboxing, memory, and MCP integration; and `apps/user-interface` for the React/Vite frontend that surfaces diffs, agent state, and review flows.

The current implementation centers on four boundaries:

- deterministic orchestration in `apps/server-bridge/orchestrator/state-machine.js` and `apps/server-bridge/orchestrator/router.js`
- approval-gated writes in `apps/server-bridge/vfs/container.js`
- isolated execution in `apps/server-bridge/sandbox/docker_executor.js`
- user-facing review and control in `apps/user-interface/src/features/`

## What This Repository Provides

- code-generation requests routed through the server bridge and XState orchestration
- a Virtual File System that stages proposed changes before disk writes
- authenticated API surfaces for auth, code runs, VFS review, chat history, preferences, repo linking, and MCP tool calls
- a frontend workspace with editor, diff, terminal, dashboard, and agent-status surfaces
- test coverage for backend orchestration, security checks, and UI integration paths

## Repository Layout

- `apps/server-bridge/` - backend server, orchestration, auth, memory, sandbox, MCP, and VFS
- `apps/user-interface/` - frontend workspace built with React and Vite
- `docs/` - product, architecture, setup, and technical reference docs
- `scripts/` - maintenance, security, and release-gate utilities
- `tests/` - load and validation tooling

## Development Commands

The root `package.json` exposes the primary workflows:

```bash
npm ci
npm run dev
npm run dev:ui
npm run dev:server
npm run build:ui
npm run start:server
npm run validate
npm run sanitize
npm run security:audit
npm run test:security
npm run release:gate
```

## Environment Expectations

- Node.js 22.x
- npm 10 or newer
- Postgres for persistence and memory features
- Docker for sandboxed execution paths
- workspace-specific environment variables configured through the server bridge loader

## Documentation Entry Points

- [Development Setup](docs/DEVELOPMENT_SETUP.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [API Specification](docs/API_SPECIFICATION.md)
- [System Plan](docs/SYSTEM_PLAN.md)
- [Software Requirements](docs/SRS.md)

## Contributing

Start with the architecture and setup docs before making changes. The most important rule in this repository is that orchestration, sandboxing, and approval-gated writes stay separated and testable.

## License

Licensed under MIT.
