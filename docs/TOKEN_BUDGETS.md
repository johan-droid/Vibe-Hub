# Token Budgets

The system goal is not to eliminate LLM usage. The goal is to spend tokens only where synthesis is genuinely needed.

## Budgeting Rules

- Prefer deterministic routing and retrieval before any model call.
- Prefer source-backed evidence over learned or working memory in high-risk flows.
- Trim every prompt section independently before the final prompt is assembled.
- Never send full MCP schemas, full project trees, or raw long logs by default.
- Summarize failures, not entire transcripts.

## Current Section Budgets

These are the default V6 prompt-section budgets in `apps/server-bridge/orchestrator/context-builder.js`.

- Organizational constraints: `320`
- User preferences: `220`
- Project tree: `320`
- `package.json` summary: `220`
- User memory: `180`
- Retrieval plan: `120`
- Evidence packet: `900`
- Brain journal / learned notes: `160`
- MCP tool summary: `320`
- Linked repositories: `140`

## Layer Policy

1. Capture and canonicalization happen once and should be reusable.
2. Retrieval planning should be heuristic-first and model-free.
3. Evidence packets should be bounded before prompt assembly.
4. Stronger models should only receive the smallest useful grounded context.
5. Verification output should be truncated to the failing region or actionable slice.

## What We Avoid

- Raw prompt stuffing
- Full repo dumps in chat context
- Full JSON schemas for every tool
- Re-sending unchanged memory blobs across iterations
- Using premium calls for classification, validation, or routing
