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
- Default mode is controlled by `SELINA_AUDIT_MODE_DEFAULT` when set; otherwise requests run with mode-specific caller defaults.

## Validation

- Run `npm run validate` for syntax guards on orchestrator entrypoints.
- Use `npm run security:audit` to detect policy drift before enabling broad audit recording in shared environments.

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
