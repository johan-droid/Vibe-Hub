# Vibe-Hub Technical Architecture Overview

**Document Version:** 6.1  
**Last Updated:** 2026-05-04  
**Format:** IEEE 830-1998 (Recommended Practice for Software Requirements Specifications)  

---

## 1. Executive Summary

Vibe-Hub is a SaaS-grade agentic coding platform that leverages deterministic state machine orchestration, abstract syntax tree (AST) analysis, and secure sandboxing to generate code through large language models (LLMs). The system implements a Virtual File System (VFS) with user approval gates to prevent unauthorized disk writes, ensuring security and transparency in AI-assisted software development.

**Key Technical Innovations:**
- XState-based deterministic orchestration with rollback capabilities
- AST-first code analysis using Tree-sitter
- Offline Docker sandboxing with resource constraints
- Multi-layered security architecture (Helmet, rate limiting, validation)
- Structured audit logging with request tracing

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  React 18 + Vite + Material 3 + Zustand + Socket.io-client                   │
│  ├─ DiffViewer (Code Review & Approval)                                      │
│  ├─ Terminal (Real-time Logs)                                                │
│  ├─ Workspace (IDE Interface)                                                │
│  └─ LandingPage (Marketing & OAuth)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ WebSocket / HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY LAYER                                      │
│  NGINX / Render Gateway                                                      │
│  ├─ SSL Termination                                                          │
│  ├─ Rate Limiting (Global)                                                   │
│  └─ Load Balancing                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  Node.js 24 LTS + Express 4 + Socket.io 4                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SECURITY MIDDLEWARE                            │   │
│  │  ├─ Helmet.js (CSP, HSTS, X-Frame-Options)                         │   │
│  │  ├─ express-rate-limit (Tiered: 100/30/5 per window)               │   │
│  │  ├─ Zod Validation (Input sanitization)                            │   │
│  │  └─ XSS Protection (Script injection prevention)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ORCHESTRATION ENGINE                           │   │
│  │  XState Machine (7 states: idle → contexts → AST → draft →        │   │
│  │  sandbox → evaluate → success/rollback)                            │   │
│  │  ├─ PromptOrchestrator (Context assembly)                          │   │
│  │  ├─ LLMClient (Gemini/OpenAI/Anthropic abstraction)              │   │
│  │  ├─ SemanticGraphBuilder (Tree-sitter AST parsing)               │   │
│  │  └─ SkillGraph (Expert routing)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      EXECUTION SANDBOX                              │   │
│  │  Docker Engine (Offline, ephemeral containers)                       │   │
│  │  ├─ Network Isolation (--network none)                             │   │
│  │  ├─ Resource Limits (256MB RAM, 0.5 CPU, 50 PIDs)                  │   │
│  │  ├─ Read-Only Filesystem (--read-only)                             │   │
│  │  └─ 10s Execution Timeout                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      VIRTUAL FILE SYSTEM                            │   │
│  │  In-memory staging with approval gates                             │   │
│  │  ├─ stageFile() → approveFile() → commitToDisk()                   │   │
│  │  ├─ Winston audit logging (requestId tracing)                      │   │
│  │  └─ EventEmitter (WebSocket broadcasting)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      IDENTITY & ACCESS                              │   │
│  │  ├─ JWT Authentication (RS256)                                     │   │
│  │  ├─ OAuth 2.0 (Google, GitHub)                                    │   │
│  │  └─ Session Management (PostgreSQL-backed)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ PostgreSQL Protocol
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  PostgreSQL 16 + pgvector extension                                            │
│  ├─ Relational Data (users, projects, sessions)                              │
│  ├─ Vector Embeddings (semantic search, 1536-dim)                            │
│  └─ JSONB Documents (AST graphs, audit logs)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 18.3.1 | UI framework |
| | Vite | 5.4.0 | Build tooling |
| | Material UI | 6.0.0 | Component library |
| | Zustand | 4.5.0 | State management |
| | Socket.io-client | 4.8.0 | Real-time communication |
| **Backend** | Node.js | 24.14.1 LTS | Runtime |
| | Express | 4.19.2 | HTTP framework |
| | Socket.io | 4.8.3 | WebSocket server |
| | XState | 5.19.2 | State machines |
| | Winston | 3.17.0 | Structured logging |
| **Security** | Helmet | 8.1.0 | HTTP headers |
| | express-rate-limit | 7.5.0 | Rate limiting |
| | Zod | 3.25.0 | Schema validation |
| | bcryptjs | 2.4.3 | Password hashing |
# Vibe-Hub Technical Architecture Overview

**Document Version:** 6.2
**Last Updated:** 2026-05-16

## 1. Executive Summary

Vibe-Hub is a two-workspace monorepo. `apps/server-bridge` owns orchestration, auth, memory, MCP, and the approval-gated file pipeline. `apps/user-interface` owns the React workspace that surfaces prompts, diffs, terminal output, and agent state.

The current architecture is built around four hard boundaries:

1. Deterministic orchestration in `apps/server-bridge/orchestrator/state_machine.js`.
2. Approval-gated writes in `apps/server-bridge/vfs/container.js`.
3. Isolated execution in `apps/server-bridge/sandbox/docker_executor.js`.
4. User review and commit flows in `apps/user-interface/src/features/editor/components/DiffViewer.jsx` and the surrounding workspace UI.

## 2. Current System Shape

```text
UI (React/Vite)
  -> HTTP + Socket.io
Server bridge (Express)
  -> XState orchestration
  -> AST / memory / MCP / repo / auth
  -> VFS staging
  -> Docker sandbox
  -> PostgreSQL + Redis-backed coordination when enabled
```

### Key runtime files

- `apps/server-bridge/index.js` - Express bootstrap and route registration.
- `apps/server-bridge/orchestrator/router.js` - orchestration, VFS, repo, and MCP handlers.
- `apps/server-bridge/orchestrator/state_machine.js` - state transitions and rollback behavior.
- `apps/server-bridge/vfs/container.js` - in-memory staging container and audit trail.
- `apps/server-bridge/auth/routes.js` - auth and session routes.
- `apps/server-bridge/orchestrator/chat_routes.js` - chat sessions and messages.
- `apps/server-bridge/orchestrator/preferences_routes.js` - workspace preferences.
- `apps/user-interface/src/pages/Workspace.jsx` - main workspace shell.

### Current technology profile

| Layer | Current stack |
| --- | --- |
| Frontend | React 19, Vite 8, Zustand 5, Socket.io client 4.8, Playwright, Vitest |
| Backend | Node.js 22, Express 4.19, Socket.io 4.8, XState 5.31, Zod 3.25, Winston 3.17 |
| Data | PostgreSQL, pgvector, Redis-backed queues/adapters when enabled |
| Execution | Docker sandbox with network isolation and filesystem containment |

## 3. Component Boundaries

### 3.1 UI layer

The UI is organized by feature under `apps/user-interface/src/features/` rather than by generic shared folders. Important surfaces include:

- `features/editor/components/DiffViewer.jsx` for approval review.
- `features/dashboard/components/AgentStatusBar.jsx` and `ActivityFeed.jsx` for live orchestration state.
- `features/chat/components/ChatInterface.jsx` for prompt and session interactions.
- `features/terminal/components/TerminalSessionsPanel.jsx` for terminal session visibility.

### 3.2 Server bridge layer

The server bridge is the only place where orchestration, auth, sandboxing, and persistence meet. That separation is deliberate:

- `org_core/` captures immutable organizational constraints.
- `user_env/` captures mutable user preferences.
- `orchestrator/` is the integration point that is allowed to read from both.

### 3.3 Request lifecycle

1. The UI submits a prompt to `POST /api/code` or `POST /api/v6/code`.
2. The server validates auth, readiness, CSRF, idempotency, and the request schema.
3. The XState machine loads contexts, parses the target file, and drafts code.
4. The sandbox executes the proposed code in Docker.
5. On success, the VFS stages the file and emits `file_staged`.
6. The user reviews the diff and either approves or rejects the staged file.
7. Approval commits the file to disk through the VFS container.

## 4. Security and Reliability

- The VFS refuses path escapes, hidden path traversal, and oversized staging sets.
- The sandbox isolates execution with `--network none` and resource limits.
- Auth uses session lifecycle routes rather than a bare token-only model.
- Audit logs are retained for VFS and orchestration decisions.

## 5. Operational Notes

- The current workspace scripts should be treated as the source of truth over older examples.
- The current route aliases include both `/api/*` and `/api/v6/*` for the code and VFS surfaces where present.
- When this document references code paths, those paths are intended to resolve exactly in the workspace.
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=<256-bit-random>

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Frontend
UI_ORIGIN=https://vibe-hub.vercel.app
```

---

## 8. Monitoring & Observability

### 8.1 Structured Logging

**Format:** JSON with requestId tracing
```json
{
  "level": "info",
  "message": "VFS operation",
  "requestId": "req-uuid-1234",
  "type": "vfs_audit",
  "operation": "commit",
  "filePath": "src/app.js",
  "userId": "user-uuid-5678",
  "timestamp": "2026-05-04T14:30:00.000Z"
}
```

### 8.2 Health Check

**Endpoint:** `GET /health`

```json
{
  "status": "active",
  "version": "4.1.0",
  "uptime": 86400,
  "memory": 52428800
}
```

---

## 9. References

[1] Harel, D. (1987). Statecharts: A visual formalism for complex systems. *Science of Computer Programming*, 8(3), 231-274.

[2] ISO/IEC/IEEE 830-1998. *IEEE Recommended Practice for Software Requirements Specifications*.

[3] Docker Inc. (2024). *Docker Security Cheat Sheet*. https://docs.docker.com/engine/security/

[4] OWASP Foundation. (2024). *OWASP Top 10 - 2021*. https://owasp.org/Top10/

---

**Document Control:**
- **Author:** Vibe-Hub Engineering Team
- **Review Cycle:** Quarterly
- **Distribution:** Internal + Partner Engineering
