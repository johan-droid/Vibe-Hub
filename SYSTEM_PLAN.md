# Vibe Hub Detailed System Plan

## 1. Architecture Overview
The system relies on a **Hybrid Split** architecture:
- **Frontend & Backend Hosting:** React frontend (Vite) and Node.js backend (Express + WS) are hosted on Render.
- **Sandboxing & Execution:** Offloaded to GitHub Actions. Local Docker execution is disabled.

## 2. Security & Authentication
- **OAuth CSRF Protection:** Implementations in `auth/google.js` and `auth/github.js` must securely generate the `state` parameter, verify it, and issue `HttpOnly` and `secure` (in production) cookies.
- **Middleware Safety:** `auth/middleware.js` will verify `JWT_SECRET` but allow bypass in `NODE_ENV=test` environments without process termination.
- **Cookie Parsing:** Manual cookie parsing is enforced (`cookie-parser` is deliberately excluded).

## 3. Real-Time Communication
- **WebSocket:** The frontend connects via `SwarmSocket`. The backend consumes events and broadcasts execution states dynamically.
- **Event Cleanup:** Frontend hook `useAgent.js` must strictly use named functions for WS event handlers to avoid memory leaks during unmount/hot-reload.

## 4. Resource Limitations
- **VFS Concurrency:** The `VFSContainer` logic uses `pLimit` to limit the queue concurrency and prevent `EMFILE` exhaustion.
- **Caching Strategy:** The backend uses an `LRUCache` within `SharedContext` to cap memory usage for ASTs and files during prolonged multi-agent debates.

## 5. Intelligence Engine
- **Generative AI SDK:** Sole reliance on the native `@google/generative-ai` SDK.
- **Swarm Operations:** Multi-agent routing logic processes requests across specialized agents via `orchestrator/index.js` and `experts.js`.

## 6. Action Plan
- [x] Create this document as the system foundation.
- [ ] Implement `NODE_ENV !== 'test'` bypass for `JWT_SECRET` in `middleware.js`.
- [ ] Remove `dockerode` and local docker references from the backend workspace to strictly enforce the GitHub Actions sandbox strategy.
