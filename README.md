<div align="center">
  <img src="docs/assets/selina-banner.png" alt="Vibe-Hub Banner" width="100%" />

  # Vibe-Hub Brain Engine

  **An autonomous, scale-ready AI coding orchestrator with deterministic routing, isolated memory, and a guarded Virtual File System.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Node](https://img.shields.io/badge/node-22.x-brightgreen)](https://nodejs.org/)
  [![npm](https://img.shields.io/badge/npm-%3E%3D10-orange)](https://www.npmjs.com/)
</div>

## Overview

Vibe-Hub is a secure, multi-tenant workspace for AI-assisted software development. The repository is split into two production environments: `apps/server-bridge` (which hosts the autonomous "Brain" orchestrator, memory indexing, sandboxing, and MCP integrations) and `apps/user-interface` (a React/Vite control surface for reviewing diffs, logs, and agent state).

The current engine architecture emphasizes strict security boundaries, scalable ingestion, and deterministic workflows.

## Key Architectural Features

### 1. Multi-Agent Orchestration
Code-generation and analytical tasks are intelligently routed through specialized experts:
- **Router & Manager**: Directs user intent, delegates steps, and coordinates long-running flows.
- **Code, UI, & Debug Experts**: Specialized prompts for focused, token-efficient execution.
- **Security Auditor**: Verifies operations prior to persisting changes.
- **Creative & Design Experts**: Handles visual assets, motion design, and design system enforcement.

### 2. Semantic Memory & RAG Layers
A resilient Retrieval-Augmented Generation (RAG) system built to isolate context and stay within token budgets:
- **Cross-Tenant Isolation**: Memory lookups enforce strict `tenantId` bounds to prevent knowledge leaks.
- **AST Indexing**: Generates syntax-aware chunking and background vector embeddings via `asyncPool` concurrency.
- **Token Squeezing**: Dynamically budgets prompt windows, favoring raw file sources over hallucinated "learned" memory in high-risk code changes.
- **Aggressive Caching**: Extensive caching layers memoize retrieval plans, token budgets, evidence packets, and file hashing to guarantee low p95 latency under concurrent loads.

### 3. Hardened Security Sandbox
Safety-first operations ensure zero-trust interactions between the orchestrator and the underlying filesystem:
- **Restricted VFS**: File patching blocks hidden directories (e.g., `.git`, `.env`) and paths containing directory traversal attacks.
- **Risky Command Blocks**: Regex-enforced sequences detect and instantly block dangerous commands (`rm -rf`, reverse shells) before execution.
- **Fail-Closed Operations**: Missing source attributions or poisoned contexts throw hard orchestrator exceptions rather than guessing blindly.

### 4. Full Audit & Observability
- **Audit Mode**: Durable `jsonl` traces record every model invocation, RAG packet, tool call, token estimate, and outcome.
- **Anomaly Detection**: Flags oversized prompts, suspicious uploads, and contradictory Git hashes natively in the audit logs.

## Repository Layout

- `apps/server-bridge/` - Backend server hosting the Brain orchestrator, memory indexers, security policies, auth, and MCP bindings.
- `apps/user-interface/` - Frontend control surface built with React and Vite.
- `docs/` - Product, architecture, setup, and technical reference docs.
- `scripts/` - Maintenance, security, and release-gate utilities.
- `tests/` - Load and validation tooling.

## Development Commands

```bash
# Setup
npm ci

# Start local environments
npm run dev
npm run dev:ui
npm run dev:server

# Build & validate
npm run build:ui
npm run validate
npm run sanitize
npm run security:audit
```

## Environment Expectations

- Node.js 22.x
- npm 10 or newer
- Postgres (for semantic memory and ledger persistence)
- Docker (for isolated sandbox execution paths)

## Documentation Entry Points

- [Engineering Principles](ENGINEERING_PRINCIPLES.md)
- [System Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Audit Mode Guidelines](docs/AUDIT_MODE.md)
- [Scaling Plan](docs/SCALING_PLAN.md)
- [Development Setup](docs/DEVELOPMENT_SETUP.md)

## Contributing

We welcome contributions! Please review our architecture docs and setup guides before making changes. The core philosophy of this engine is that **orchestration, sandboxing, and approval-gated writes must remain strictly isolated and deeply testable.**

## License

Licensed under the MIT License.
