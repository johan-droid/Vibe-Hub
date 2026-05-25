# Audit Mode

Audit mode controls how much durable execution evidence is recorded for a run.

## Modes

- `off`
  No rollout recorder is created. Use this only for low-risk or ephemeral flows.
- `standard`
  Durable rollout artifacts are recorded: plan, implementation notes, status, and event stream.
- `full`
  Standard artifacts plus retrieval details, context-budget telemetry, and additional grounded-execution evidence.

## Current Runtime Behavior

- Request validation accepts `auditMode` on code-run surfaces.
- WebSocket prompt execution accepts `auditMode` in prompt messages.
- Full mode records retrieval and context-compaction telemetry through the rollout recorder.
- Recorder output is redacted for common secret-bearing fields.

## Artifacts

Standard and full mode use the rollout directory under:

- `apps/server-bridge/scratch/rollouts/` by default
- or `SELINA_ROLLOUT_DIR` if configured

Each recorded run emits:

- `plans.md`
- `implement.md`
- `status.md`
- `rollout.jsonl`

## Security Expectations

- Audit artifacts must never contain raw secrets.
- High-risk retrievals should show whether source evidence was present.
- Tool calls, verification steps, and failure classifications should be replayable from the event stream.
