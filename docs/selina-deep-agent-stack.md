# Selina Deep Agent Stack

Selina should keep its current Node.js backend and React frontend, then adopt the Codex-style quality system in layers. The goal is not a Rust rewrite; the goal is a production harness that makes every agent action planned, observable, reversible, and mechanically verified.

## Stack Direction

| Layer | Selina Implementation |
| --- | --- |
| Agent runtime | Node.js server bridge with XState orchestration |
| Model gateway | `apps/server-bridge/orchestrator/models.js` with provider selection, quota classification, explicit fallback order, and OpenAI Responses mode |
| UI protocol | WebSocket and Socket.io events today; JSON-RPC app-server protocol is a future hardening milestone |
| Durable state | Markdown run artifacts plus JSONL event streams under `apps/server-bridge/scratch/rollouts/` |
| External tools | MCP manager for user-configured tools, plus first-party tools for VFS, sandbox, browser, and GitHub |
| Sandboxing | Local Docker only, network disabled, ephemeral container execution |
| Auth gate | Central `AgentAuthManager`, `callWithAuthRetry`, tool policies, fail-closed approval, and sanitized subprocess env |
| Structural enforcement | Vitest invariant tests for layer isolation, language lock, and cloud execution disablement |
| Observability | Existing Winston/metrics hooks, plus rollout JSONL events for agent replay |

## MCP Tool Pipeline

Selina now treats MCP tools as first-class agent tools instead of side-channel utilities:

1. `mcpManager.refreshTools()` discovers server tools and maps each `server:tool` into an LLM-safe `server__tool` alias.
2. `validateToolCallArguments()` validates every model-selected tool call against the registered JSON schema before dispatch.
3. `authorizeToolCall()` applies the same auth and approval policy used by built-in tools. Unknown MCP tools fail closed as write-capable tools.
4. `onToolCall()` executes the MCP call through `mcpManager.callTool()`, which validates the original MCP `inputSchema` again at the execution boundary.
5. The WebSocket stream emits `tool_call` envelopes with `started`, `completed`, or `failed` status so the frontend Execution Timeline can show the actual tool chain.
6. The rollout recorder writes `tool_call_started`, `tool_call_finished`, and `tool_call_failed` records to `rollout.jsonl`.

The REST diagnostics endpoint `/api/v6/mcp/diagnostics` exposes server health, tool counts, last refresh time, and degraded/error state for production debugging.

## Deep Agent Pillars

### 1. Explicit Planning

Every agent run now gets durable planning files:

- `plans.md` records the current route, operating loop, and verification plan.
- `implement.md` records implementation notes and final content.
- `status.md` records the latest run state.
- `rollout.jsonl` records timestamped agent events.

These artifacts are intentionally plain text so future agents can rehydrate context without relying on chat history alone.

### 2. Scoped Delegation

Selina already has domain experts for code, UI, debugging, security, review, creative direction, architecture, motion, and visual assets. The production rule is that delegation must stay scoped: each sub-task should have a clear owner, bounded context, and a verification expectation.

The current backend supports recursive `delegate_task` tool calls. The next hardening milestone is to give delegated work separate rollout IDs so each nested agent has an independent event stream.

### 3. Persistent Memory

Selina has three durability layers:

- User/project memory in the database through `memory/loader.js`.
- Per-run Markdown and JSONL rollout artifacts.
- Frontend workspace/session state through the existing client stores.

SQLite is not required for the current stack because PostgreSQL is already present. A local SQLite StateDB can be added later if Selina needs offline metadata or portable desktop sessions.

### 4. Context Engineering

Prompt assembly must preserve the V6 hierarchy:

1. System and model instructions.
2. Organizational constraints from `org_core/`.
3. User preferences from `user_env/`.
4. Project tree, package metadata, AST graph, memory, and linked repos.
5. Tool definitions and runtime environment.
6. Current user request.

`org_core/` and `user_env/` must never import each other directly. The orchestrator remains the integration boundary.

## Execution Loop

Selina’s production loop is:

1. Plan the work and persist it.
2. Execute scoped edits and tool calls.
3. Verify with build, tests, AST checks, or local Docker sandbox execution.
4. Observe failures from command output and rollout logs.
5. Repair before continuing.
6. Update `status.md`, `implement.md`, and the JSONL stream.

The XState path now uses the local Docker sandbox for generated code instead of an unconditional success placeholder.

## Mechanical Gates

The backend test suite includes invariants for:

- No direct imports from `org_core/` into `user_env/`, or the reverse.
- Language lock is exactly `en`, `hi`, and `or`.
- GitHub Codespaces and GitHub Actions execution tools are disabled for agent execution.
- Agent sandboxing routes through `SandboxExecutor.executeLocalDockerSandbox`.
- Model, embedding, and creative API keys are reached through the central auth manager.
- Write-capable tools must pass per-tool auth and approval before execution.
- Model-selected and MCP tools must pass strict schema validation before execution.
- Tool calls must emit WebSocket audit envelopes for the UI timeline.
- Quota exhaustion is classified as non-retryable and fallbackable, preventing repeated calls into an exhausted provider.

These tests should be treated as production gates, not optional coverage.

## Frontend Stack To Implement Next

Selina’s SaaS UI should keep the current React/Vite shell and add production-grade verification:

- React Testing Library for settings, dashboard, chat, and code review workflows.
- Playwright for auth callback, project open, settings save, agent run, and terminal behavior.
- MSW for deterministic frontend API tests.
- axe accessibility checks for shell, modals, forms, and code panes.
- Browser performance budgets for first load, socket reconnect, and large diary streams.

The visual system should remain Selina-specific: quiet SaaS density, stable panels, custom logo usage, clear status language, and no decorative UI that competes with the work surface.
