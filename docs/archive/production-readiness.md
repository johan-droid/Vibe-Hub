# Selina Production Readiness

Selina should ship as a local-first agentic coding workspace with a hardened backend, a predictable frontend shell, and traceable agent execution.

## Agent Backend

- Use the provider gateway in `apps/server-bridge/orchestrator/models.js` for all model calls.
- Keep provider secrets behind `apps/server-bridge/auth/agent-auth.js`; model, embedding, and creative services should not read API-key environment variables directly.
- Prefer `SELINA_MODEL_PROVIDER=openai` with `OPENAI_API_MODE=responses` when using OpenAI models.
- Keep Gemini, Qwen, and Anthropic as explicit provider choices.
- Use `SELINA_MODEL_FALLBACKS=openai,qwen,anthropic` only when fallback order is intentional and matching credentials are configured.
- Treat provider quota exhaustion, such as Gemini free-tier `limit: 0`, as a fallback/error condition rather than a normal retry loop.
- Treat every model call, tool call, sandbox run, and handoff as an auditable event.
- Validate every model-selected built-in and MCP tool call against its JSON schema before auth and execution.
- Keep generated code execution in the local Docker sandbox with `--network none`.
- Do not route validation to GitHub Actions, Codespaces, or cloud runners.
- Persist every serious agent run with Markdown plans/status plus a JSONL event stream.
- Keep XState retries bounded so failed generations repair, pivot, then fail cleanly instead of looping.

## Auth Gate

- `AgentAuthManager` is the central credential owner for agent model/provider credentials.
- `callWithAuthRetry` wraps authenticated HTTP calls and handles `401 -> refresh -> retry once`.
- `authorizeToolCall` enforces per-tool policy before dispatch.
- Write, execution, browser mutation, GitHub mutation, and generation tools require approval.
- Approval timeout fails closed.
- `sanitizeEnvironment()` removes secret-like variables before spawning Docker or MCP subprocesses.
- WebSocket transport stays gated by existing session/JWT auth.

## MCP And Tool Automation

- MCP tools are discovered through `mcpManager.refreshTools()` and exposed to models as `server__tool` aliases.
- The runtime validates LLM-facing schemas and validates original MCP `inputSchema` again before `tools/call`.
- `/api/v6/mcp/diagnostics` reports server status, registered tool count, last refresh time, and recent errors.
- WebSocket clients receive `tool_call` events shaped as `{ id, tool, status, metadata }` for timeline rendering.
- Tool-call metadata is redacted before streaming so API keys, tokens, cookies, passwords, and credentials do not reach the UI.
- Write-capable or unknown tools require human approval and fail closed on timeout.

## Deep Agent Runtime

- Durable run artifacts live under `apps/server-bridge/scratch/rollouts/` by default.
- `plans.md` is the source of truth for the run plan.
- `implement.md` captures implementation notes and final agent output.
- `status.md` captures the latest state for resume/debug.
- `rollout.jsonl` captures structured events for replay and audit.
- See `docs/selina-deep-agent-stack.md` for the Codex-style architecture map.

## Required Production Environment

- `DATABASE_URL`
- `JWT_SECRET`
- `CSRF_SECRET`
- `UI_ORIGIN`
- `SELINA_TOOL_APPROVAL_TIMEOUT_MS` (optional; default `120000`)
- `SELINA_FORCED_LOGIN_METHOD` (optional; `api-key` or `oauth`)
- `SELINA_MODEL_FALLBACKS` (optional comma-separated provider order)
- One model provider credential matching `SELINA_MODEL_PROVIDER`:
  - `GEMINI_API_KEY`
  - `OPENAI_API_KEY`
  - `QWEN_API_KEY`
  - `ANTHROPIC_API_KEY`

## Frontend Stack

- React 19 for the application shell.
- Vite for build and dev server.
- Tailwind CSS tokens for product UI surfaces.
- Zustand for workspace state and persistence boundaries.
- React Router for route-level navigation.
- Socket.io client for agent state streaming.
- XTerm for terminal UX.
- PWA plugin for installability and offline shell behavior.

## Frontend Additions Before Public Beta

- Add Vitest + React Testing Library for component behavior.
- Add Playwright for end-to-end dashboard, auth callback, and settings flows.
- Add axe accessibility checks for shell, settings, and code review panels.
- Add MSW for API mocking in frontend tests.
- Add Sentry or an equivalent client-side error reporter.

## Release Gates

- `npm run build --workspace=apps/user-interface`
- `npm test --workspace=apps/server-bridge`
- `node --check` on touched backend files.
- Architecture invariant tests remain green.
- Docker CLI available on `PATH`.
- `/health` returns `ready: true`.
- `/api/runtime/diagnostics` shows the intended provider and API mode.
- `/api/v6/mcp/diagnostics` reports expected MCP server and tool health.
