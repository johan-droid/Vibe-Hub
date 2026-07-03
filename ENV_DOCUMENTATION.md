# Environment Variables Documentation

This document provides a deep analysis of the environment variables used in the Vibe Hub project. The project is split into a `backend` and `frontend`, each with its own configuration requirements.

## 1. Backend Environment Variables (`backend/.env`)

The backend heavily relies on environment variables to configure its various subsystems, including the LLM gateway, database, orchestrator, and security.

### 1.1 LLM & Brain
These variables control how the application communicates with Large Language Models (LLMs). The project uses a unified LLM gateway (`freellmapi`).
* `SELINA_LLM_GATEWAY`: The primary gateway used (default: `freellmapi`).
* `FREELLMAPI_BASE_URL` & `FREELLMAPI_API_KEY`: Connection details for the FreeLLMAPI instance.
* `SELINA_*_PROVIDER`: Specific providers for different agent roles (e.g., `SELINA_CODING_MODEL_PROVIDER`).
* `SELINA_*_TIMEOUT_MS`: Various timeouts for LLM operations to prevent hanging requests.
* `SELINA_HISTORY_TOKEN_BUDGET` & `SELINA_MAX_OUTPUT_TOKENS`: Context window and output limitations.

### 1.2 Server & Security
Core settings for running the Node.js server securely.
* `PORT` & `NODE_ENV`: Standard Node.js environment settings.
* `JWT_SECRET` & `CSRF_SECRET`: Cryptographic secrets for securing sessions and preventing cross-site request forgery. **Must be changed in production.**
* `UI_ORIGIN`, `UI_ALLOWED_ORIGINS`, `FRONTEND_ORIGINS`: CORS configurations to dictate which frontends can talk to this API.
* `AUTH_*`: Authentication configurations (e.g., JWKS URI, issuers, audiences, TTLs) supporting Auth0/Cognito integrations.
* `VIBE_MASTER_KEY`: A 32-byte hex key for master-level operations.

### 1.3 Database & Caching
Configures the primary persistence layers.
* `DATABASE_URL`: Connection string for the PostgreSQL database (expected to be Supabase). Includes credentials and SSL mode.
* `PG_POOL_MAX`, `PG_POOL_MIN`, `PG_*_TIMEOUT_MS`: Connection pooling limits and timeouts for optimal database performance.
* `REDIS_URL`: Connection string for the Redis instance used for caching and pub/sub.

### 1.4 Observability & Operations
Variables that dictate how the system is monitored, logged, and rate-limited.
* `SENTRY_DSN` & `SENTRY_TRACES_SAMPLE_RATE`: Error tracking via Sentry.
* `LOG_LEVEL` & `LOG_FORMAT`: Controls the verbosity and format (e.g., `json`) of application logs.
* `OTEL_*`: OpenTelemetry configuration for distributed tracing.
* `RATE_LIMIT_*`: Granular rate limits (e.g., API, Orchestration, Auth) to protect the server from abuse.
* `WS_*`: WebSocket specific settings (rate windows, max connections, ping intervals) for real-time features.

### 1.5 Agent Orchestrator
Deep configuration for the agent task queue and sandbox environments.
* `CODE_QUEUE_NAME`: The name of the queue handling code generation tasks.
* `ORCHESTRATION_*`: Concurrency limits, backoff strategies, and priorities for interactive vs. background background workers.
* `SELINA_SANDBOX_PROVIDER`: Defines where code execution happens (e.g., `docker-local`).
* `*_CACHE_TTL_SECONDS`: Time-to-live settings for LLM, AST, Context, and Embedding caches to optimize redundant operations.

### 1.6 External Services (OAuth, GitHub, Vault)
* `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`: Credentials for GitHub App integration (e.g., reading repositories, creating PRs).
* `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth credentials.
* `VAULT_*`: Settings for pulling secrets dynamically from HashiCorp Vault instead of relying solely on `.env`.

---

## 2. Frontend Environment Variables (`frontend/.env`)

The frontend uses Vite, which requires environment variables to be prefixed with `VITE_` to be exposed to the client-side code.

### 2.1 API & WebSocket Connections
* `VITE_API_BASE` & `VITE_API_URL`: The base HTTP URL of the backend API (typically `http://localhost:3001` in development).
* `VITE_WS_BASE`: The base WebSocket URL for real-time agent communication and updates (`ws://localhost:3001`).

### 2.2 Application Configuration
* `VITE_AGENT_MODEL_LABEL`: A UI display string representing the current LLM being used (e.g., "OpenAI Responses").
* `VITE_TEST_MODE`: A boolean flag to enable or disable test-specific features in the UI.
* `VITE_SELINA_MAX_SURGICAL_DELTA_CHARS`: Determines the maximum size of a text replacement delta the frontend is allowed to process in one go.

### 2.3 End-to-End Testing (Playwright)
* `PLAYWRIGHT_BASE_URL`: Overrides the default base URL for Playwright tests.
* `PLAYWRIGHT_SKIP_WEB_SERVER`: If set to `true`, Playwright will assume the web server is already running and won't try to start it during the test suite.

## Best Practices
1. **Never commit `.env` or `.env.local` files to version control.** Always use `.env.example` to track necessary variable names without exposing sensitive values.
2. Ensure you rotate secrets like `JWT_SECRET`, `CSRF_SECRET`, and Database passwords periodically.
3. In production, consider injecting these variables using a secure secrets manager (like HashiCorp Vault or AWS Secrets Manager) instead of using local files.
