# Canonical Repository Map

This document is the absolute source of truth for the project structure, identity, and runtime layout.

## 1. Product Identity

| Concept | Canonical Name | Description |
|---|---|---|
| Public Product Name / Workspace | **Vibe Hub** | The user-facing agentic software workspace with IDE-like surfaces. |
| Internal Engine | **Selina Core** | The internal orchestration, intelligence, and agent engine. |
| Backend Service | **selina-server-bridge** | The backend service, API, and control plane. |
| Frontend Workspace | **user-interface** (or frontend) | The browser-based workspace UI. |
| Architecture Generation | **v6** | The current canonical architecture generation. |

*Note: You may see older terms like "Brain v5.0" in history; these are legacy terms. "Vibe Hub" is not just an IDE; it is an approval-gated, agentic workspace.*

## 2. Monorepo Layout

The repository is structured as an npm workspace.

*   **`/` (Root Workspace):** Contains global configuration, `.env.example`, `package.json` (workspaces definition), and orchestration scripts.
*   **`frontend/`:** The Vibe Hub user interface (React, Vite, Zustand, Tailwind).
*   **`backend/`:** The `selina-server-bridge` backend service (Node.js, Express, Socket.io).
    *   **`backend/auth/`:** Authentication, session management, OAuth handoffs, CSRF.
    *   **`backend/orchestrator/`:** Selina Core orchestration, expert loops, XState state machine.
    *   **`backend/orchestrator/routing/`:** LLM capability-based routing (FreeLLMAPI / direct providers).
    *   **`backend/mcp/`:** Model Context Protocol (MCP) server integration and tool management.
    *   **`backend/vfs/`:** Virtual File System, approval-gated mutations, staging.
    *   **`backend/sandbox/`:** Execution isolation (Docker).
    *   **`backend/memory/`:** Semantic vector memory (pgvector), solutions ledger, journals.
    *   **`backend/utils/`:** Utilities (environment validation, Redis, logging).
    *   **`backend/config/`:** Constants, brand configuration (`brand.js`).
*   **`scripts/`:** Validation and deployment scripts (e.g., `smoke-deploy.mjs`).
*   **`docs/`:** Architecture, deployment, and environment documentation.

## 3. Runtime Responsibility Map

### `user-interface` (Frontend)
*   **Owns:** User interaction, workspace visualization, editor surfaces, WebSocket client state, approval UI.
*   **Must not own:** Secrets, provider API keys, direct database access, executing un-sandboxed code.
*   **Critical Files:** `frontend/src/brand/selina.js`, `frontend/src/services/api.js`.
*   **Env Variables:** `VITE_API_BASE` (or `VITE_API_URL`).
*   **Failure Mode:** If `VITE_API_BASE` is wrong, the UI cannot reach the control plane.

### `selina-server-bridge` (Backend)
*   **Owns:** API endpoints, WebSocket server, VFS state, LLM routing, orchestrator initialization, session authority.
*   **Must not own:** Rendering HTML templates (it is an API).
*   **Critical Files:** `backend/index.js`, `backend/db.js`, `backend/utils/env.js`.
*   **Env Variables:** `PORT`, `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `UI_ORIGIN`.
*   **Failure Mode:** Startup crash if required environment variables (like `DATABASE_URL` or secrets) are missing.

### `Selina Core Orchestrator` (`backend/orchestrator/`)
*   **Owns:** Expert execution loop, prompt construction, tool authorization, task queues, rollout recording.
*   **Must not own:** Network listener setup (managed by `index.js`).
*   **Critical Files:** `backend/orchestrator/index.js`, `backend/orchestrator/router.js`, `backend/orchestrator/state_machine.js`.
*   **Env Variables:** `SELINA_MODEL_PROVIDER`, `SELINA_AGENT_PROVIDER`, provider keys.

### `Database & Memory` (`backend/memory/`, `backend/db.js`)
*   **Owns:** Persistence of runs, chat history, user preferences, semantic memory (pgvector).
*   **Critical Files:** `backend/db.js`.
*   **Env Variables:** `DATABASE_URL`.
*   **Failure Mode:** Without Postgres, stateful features and auth fail.

### `Sandbox` (`backend/sandbox/`)
*   **Owns:** Isolated execution of generated code via Local Docker.
*   **Must not own:** Access to the host environment or sensitive internal APIs.
*   **Env Variables:** `SELINA_SANDBOX_TIMEOUT_MS`.
*   **Failure Mode:** If Docker is not installed or unreachable, code execution tasks fail.

## 4. Production-Readiness Classification

*   **Production Path:** Postgres/pgvector persistence, HttpOnly cookie-based auth, CSRF protection, FreeLLMAPI/direct provider routing, VFS approval gating, Local Docker sandbox, exact origin CORS, Redis (for multi-instance).
*   **Compatibility Path:** Legacy token helper methods (if still referenced by older clients).
*   **Experimental Path:** Custom MCP servers, unverified direct provider integrations.
*   **Legacy Path:** References to "Brain v5.0", legacy browser-visible token storage.
*   **Dev-Only Path:** In-memory coordination (no Redis), `localhost` origins, unencrypted HTTP.

## 5. What future coding agents must not break

Future agents (like Jules, Codex, Claude) modifying this repository **MUST NOT**:

1.  Rename "Vibe Hub" or "Selina Core" ad hoc.
2.  Bypass the approval-gated VFS (Virtual File System). All mutations must go through the grant/approval flow.
3.  Weaken auth/session/cookie security (e.g., changing `HttpOnly` to `false`, or removing `SameSite=None; Secure` for split origins).
4.  Write or expose LLM provider API keys to the browser/frontend.
5.  Disable sandboxing silently or run generated code directly on the host machine.
6.  Remove Redis/Postgres paths without providing robust fallback documentation.
7.  Remove or bypass validation commands (e.g., `npm run validate`, `npm run sanitize`).
8.  Convert production errors or startup failures into silent fallbacks. Fail loudly on misconfiguration.
