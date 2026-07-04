# Environment Contract

This document outlines the required, optional, and development-only environment variables for deploying Vibe Hub.
**Never commit real secrets to version control.**

## A. Runtime / Backend Core
Core settings for the `selina-server-bridge`.

```env
NODE_ENV=production
PORT=3001
TRUST_PROXY_HOPS=1
API_ORIGIN=https://api.example.com
UI_ORIGIN=https://app.example.com
UI_ALLOWED_ORIGINS=https://app.example.com
FRONTEND_ORIGINS=https://app.example.com
```
*   **Explain:**
    *   Local dev uses `localhost`.
    *   Production must use `https://`.
    *   Split UI/API origins require exact matches in `UI_ALLOWED_ORIGINS` for credentialed CORS.

## B. Frontend (`user-interface`)
Settings required during the Vite build process.

```env
VITE_API_BASE=https://api.example.com
VITE_API_URL=https://api.example.com
```
*   **Explain:**
    *   Use `VITE_API_BASE` to point the frontend to the backend API.
    *   The frontend must never receive provider API keys or database credentials.

## C. Database (PostgreSQL / pgvector)
The production persistence layer.

```env
DATABASE_URL=postgresql://user:replace-with-password@host:5432/dbname?sslmode=verify-full
DATABASE_SSL_MODE=verify-full
DATABASE_SSL_CA=
PG_POOL_MIN=2
PG_POOL_MAX=20
PG_STATEMENT_TIMEOUT_MS=30000
PG_QUERY_TIMEOUT_MS=30000
```
*   **Explain:**
    *   Production **requires** PostgreSQL.
    *   The `pgvector` extension is expected.
    *   Serverless providers (Neon/Supabase) may need specific SSL handling.
    *   Do not silently start production without a database.

## D. Redis (Multi-instance coordination)
Optional for single-process dev, required for scaled production.

```env
REDIS_URL=rediss://default:replace-with-password@host:6379
REDIS_TLS=true
REDIS_KEY_PREFIX=selina:
REDIS_MAX_RETRIES=3
```
*   **Explain:**
    *   No `REDIS_URL` implies single-process, in-memory coordination.
    *   Production multi-instance deployments **should** use Redis for rate limits, Socket.io, queues, and locks.

## E. Auth / Sessions / CSRF / Cookies
Cryptographic secrets and cookie behavior.

```env
JWT_SECRET=replace-with-32-plus-char-random-secret
CSRF_SECRET=replace-with-32-plus-char-random-secret
VIBE_MASTER_KEY=replace-with-64-hex-char-32-byte-key
SELINA_ACTION_GRANT_SECRET=replace-with-32-plus-char-random-secret
AUTH_COOKIE_SAME_SITE=none
COOKIE_SAME_SITE=none
```
*   **Explain:**
    *   Secrets must be highly random. `VIBE_MASTER_KEY` must be exactly 32 bytes encoded as 64 hex characters.
    *   Split-origin frontend/backend requires `SameSite=None; Secure`.
    *   Browser token storage is **not** the production auth model; HttpOnly cookies are.

## F. OAuth Providers
Integration with external identity providers.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://api.example.com/api/auth/github/callback
```
*   **Explain:**
    *   Redirect URIs must exactly match provider console settings.
    *   Keep client secrets backend-only. Never expose through `VITE_` envs.

## G. LLM Gateway / Provider Routing
Configuration for Selina Core intelligence.

```env
SELINA_MODEL_PROVIDER=freellmapi
SELINA_AGENT_PROVIDER=freellmapi
SELINA_LLM_GATEWAY=freellmapi
SELINA_ROUTING_STRATEGY=quota_safe

FREELLMAPI_BASE_URL=https://your-freellmapi.example.com
FREELLMAPI_API_KEY=replace-with-freellmapi-key
SELINA_FREELLMAPI_PREFLIGHT=false

GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=chat
ANTHROPIC_API_KEY=
QWEN_API_KEY=
DEEPSEEK_API_KEY=
NIM_API_KEY=
NVIDIA_API_KEY=
NVIDIA_NIM_API_KEY=

LLM_PROVIDER_TIMEOUT_MS=45000
LLM_CIRCUIT_RESET_MS=30000
LLM_CACHE_TTL_SECONDS=1800
LLM_COST_PER_1K_TOKENS=0

SELINA_GEMINI_CONTEXT_CACHE=true
SELINA_GEMINI_CACHE_MIN_TOKENS=1024
SELINA_GEMINI_CACHE_TTL_SECONDS=3600
```
*   **Explain:**
    *   Choose one active provider strategy (e.g., `freellmapi` or `gemini`).
    *   The backend validation requires at least one active provider key.

## H. Security / Control Plane
Edge protection and administrative access.

```env
EDGE_PROTECTION_REQUIRED=true
EDGE_PROVIDER=
CONTROL_PLANE_ALLOWED_CIDRS=
CONTROL_PLANE_INTERNAL_TOKEN=replace-with-32-plus-char-random-secret
ALLOW_PUBLIC_CONTROL_PLANE=false
```
*   **Explain:**
    *   Metrics and control-plane endpoints must not be public by default.
    *   If allowed, explicitly set `ALLOW_PUBLIC_CONTROL_PLANE=true` and document the risk.

## I. Rate Limits & Network
DDoS prevention and socket configuration.

```env
RATE_LIMIT_AUTH=30
RATE_LIMIT_AGENT=10
RATE_LIMIT_VFS=200
RATE_LIMIT_TERMINAL=50

WS_RATE_WINDOW_MS=900000
WS_MAX_CONNECTIONS_PER_WINDOW=1000
WS_MAX_ACTIVE_PER_IP=50
WS_MAX_ACTIVE_PER_USER=5

SOCKET_COMPRESSION_THRESHOLD=1024
SOCKET_PING_INTERVAL_MS=25000
SOCKET_PING_TIMEOUT_MS=20000

HTTP_KEEP_ALIVE_TIMEOUT_MS=65000
HTTP_HEADERS_TIMEOUT_MS=70000
```
*   **Explain:**
    *   Production values should be strict to control abuse.

## J. Sandbox / Docker
Isolation settings for executing generated code.

```env
SELINA_SANDBOX_TIMEOUT_MS=10000
```
*   **Explain:**
    *   Docker must be installed locally for the sandbox to function.
    *   Network-disabled policies must be preserved where implemented.

## K. Observability
Logging and tracing.

```env
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=selina-server-bridge
LOG_LEVEL=info
```
*   **Explain:**
    *   Logs must redact secrets.
    *   Production should utilize error tracking.

## L. GitHub Integration
For repository linking and PR creation.

```env
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=replace-with-random-secret
```
*   **Explain:**
    *   Webhook signature validation is required.
    *   Mutations remain approval-gated.

## M. Production vs. Development Behavior
*   **Production:** `NODE_ENV=production`. `DATABASE_URL`, `JWT_SECRET`, `UI_ORIGIN`, and at least one LLM key are **strictly required**. Startup fails if missing.
*   **Development:** `NODE_ENV=development`. Falls back to `localhost` and weaker defaults where safe, but a database is still strongly recommended.
