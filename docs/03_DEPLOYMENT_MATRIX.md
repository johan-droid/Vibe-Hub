# Deployment Matrix

Vibe Hub / Selina Core can be deployed in several configurations depending on isolation needs and scale.

## 1. Local Development (Single Machine)
The default configuration for building and testing.

*   **Requirements:**
    *   Node.js 22.x
    *   npm >= 10
    *   Docker Desktop / Engine (required for the Sandbox)
    *   Local Postgres (or a connection to a managed Postgres instance)
    *   Optional: Local Redis (if testing multi-instance logic)
*   **Workflow:**
    1.  `npm install` from the root workspace.
    2.  Set up `.env` files in both `backend/` and `frontend/`.
    3.  Run `npm run dev` from the root to start both concurrently, OR run `npm run dev:server` and `npm run dev:ui` in separate terminals.
*   **Network:** Both run on `localhost`. CORS and cookies are simplified.

## 2. Local Docker Mode
Running the entire stack locally using containers.

*   **Requirements:** Docker and Docker Compose.
*   **Workflow:**
    *   `npm run docker:build:server`
    *   `npm run docker:build:ui`
    *   Requires mapping the Docker socket (`/var/run/docker.sock`) into the backend container so `selina-server-bridge` can spawn sibling sandbox containers.
*   **Security Warning:** Mapping the Docker socket gives the backend container root-level access to the host. Do not expose this configuration publicly without extreme caution.

## 3. Split Deployment Mode (Typical SaaS Production)
Deploying the frontend as static assets to an Edge network and the backend to a PaaS.

*   **Example Setup:**
    *   **Frontend:** Vercel, Netlify, or Cloudflare Pages.
    *   **Backend:** Render, Fly.io, or AWS ECS.
    *   **Database:** Neon, Supabase, or AWS RDS (Postgres with pgvector).
    *   **Cache/Coordination:** Upstash or managed Redis.
*   **Critical Constraints:**
    *   `API_ORIGIN` and `UI_ORIGIN` must be exact matches of the deployed URLs.
    *   `AUTH_COOKIE_SAME_SITE=none` is **mandatory** because the frontend and backend live on different domains.
    *   CORS must explicitly allow the `UI_ORIGIN`. For multiple frontends, use `UI_ALLOWED_ORIGINS` / `FRONTEND_ORIGINS` backend allowlist settings to properly configure credentialed CORS across all domains.
    *   OAuth redirect URIs must point to the backend domain.

## 4. Same-Origin Deployment Mode
Serving the frontend statically from the backend server or placing both behind a single reverse proxy.

*   **Workflow:** Build the frontend (`npm run build:ui`) and configure the backend (or Nginx) to serve `frontend/dist` on the root path `/`, while routing `/api/*` to the Node service.
*   **Benefits:**
    *   Cookie `SameSite` can be set to `Lax` or `Strict`, enhancing security.
    *   Simpler CORS configuration.

## 5. Unsupported / Risky Modes
The following configurations are explicitly discouraged and may fail or introduce severe security vulnerabilities:

*   **Production without Postgres:** Fatal. Stateful auth, VFS grants, and semantic memory will crash.
*   **Production split-origin without `SameSite=None; Secure`:** Auth cookies will be dropped by modern browsers, resulting in immediate 401 loops.
*   **Production multi-instance without Redis:** WebSockets will fail to broadcast across nodes, and rate limiting will be inconsistent.
*   **Sandbox claims without Docker:** Code execution tools will fail with "Docker not found".
*   **Exposing provider keys to Frontend:** Never prefix API keys with `VITE_`.
*   **Public control plane:** Exposing `/api/runtime/diagnostics` without `CONTROL_PLANE_INTERNAL_TOKEN` leaks sensitive routing data.

## 6. Production Launch Checklist
Before routing real users to a production deployment, verify:

- [ ] Database is reachable and migrations/schema (including `pgvector`) are applied.
- [ ] Redis is configured if running >1 backend instance.
- [ ] OAuth callbacks match the exact production URLs in Google/GitHub consoles.
- [ ] Cryptographic secrets (`JWT_SECRET`, `CSRF_SECRET`, `VIBE_MASTER_KEY`) are generated securely (e.g., `openssl rand -hex 32`).
- [ ] At least one LLM provider key is active.
- [ ] Frontend `VITE_API_BASE` points correctly to the backend.
- [ ] Backend CORS origins match the frontend precisely.
- [ ] Cookie policy handles split-origins appropriately.
- [ ] Local Docker Sandbox permissions are correctly configured on the backend host.
- [ ] `npm run validate` passes locally before push.
- [ ] Health and readiness endpoints (`/health`, `/ready`) return 200 OK.
- [ ] Logs are clean of plain-text secrets.
- [ ] No `changeme` or placeholder values exist in the production environment.
