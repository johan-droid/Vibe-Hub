# Scaling Plan

Scalability in this repo means more than throughput. It also means keeping context size, token spend, and verification cost bounded as usage grows.

## Principles

- Move expensive work out of the hot path where possible.
- Keep read-heavy retrieval fast and bounded.
- Keep write-heavy ingestion and verification explicit and auditable.
- Degrade gracefully when providers, tools, or queues are under pressure.

## Current Scaling Levers

- Concurrency governor: `apps/server-bridge/auth/concurrency-governor.js`
- Job queue: `apps/server-bridge/orchestrator/job-queue.js`
- Worker orchestration: `apps/server-bridge/orchestrator/worker-orchestrator.js`
- Runtime cost controls: `apps/server-bridge/orchestrator/cost-controls.js`
- Metrics: `apps/server-bridge/utils/metrics.js`
- Prompt compaction: `apps/server-bridge/orchestrator/context-builder.js`

## Immediate Priorities

1. Keep prompt sections hard-capped by token budgets.
2. Limit MCP tool descriptions to compact summaries in prompt context.
3. Keep retrieval source-first and bounded for high-risk queries.
4. Continue separating hot read paths from approval-gated write paths.
5. Preserve degraded-mode behavior when providers or tool servers fail.

## Next Scaling Steps

- Add short-lived retrieval result caching with safe invalidation hooks.
- Shift heavier harnessing/indexing work to asynchronous jobs.
- Add per-layer latency and token metrics to parity reports.
- Add queue-aware degraded behavior for bursty traffic.

## Operational Verification

- Use `npm run validate` as a low-cost syntax gate for orchestration changes.
- Use `npm run release:gate` before production promotions to enforce security and quality checks.
