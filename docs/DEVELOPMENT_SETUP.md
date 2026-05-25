# Development Setup Guide

**Selina (development codename: Vibe Hub)**  
**Version:** 6.0.0 (Current Workspace)  
**Last Updated:** 2026-05-26

## 1. Prerequisites

- Node.js 22.x
- npm 10+
- PostgreSQL (optional for full memory/persistence flows)
- Redis (optional for distributed queue/cache paths)
- Docker (optional, required for isolated sandbox execution paths)

Verify:

```bash
node --version
npm --version
```

## 2. Repository Boot

```bash
npm ci
```

Start local development:

```bash
npm run dev
```

Run apps separately:

```bash
npm run dev:ui
npm run dev:server
```

## 3. Environment Files

Copy only the templates you need:

- `apps/server-bridge/.env.example` -> `apps/server-bridge/.env`
- `apps/user-interface/.env.example` -> `apps/user-interface/.env.local`
- `.env.example` -> `.env` (optional root defaults for local tooling)

PowerShell:

```powershell
Copy-Item apps/server-bridge/.env.example apps/server-bridge/.env
Copy-Item apps/user-interface/.env.example apps/user-interface/.env.local
```

bash:

```bash
cp apps/server-bridge/.env.example apps/server-bridge/.env
cp apps/user-interface/.env.example apps/user-interface/.env.local
```

## 4. Core Commands (Current)

Root workspace commands:

```bash
npm run dev
npm run dev:ui
npm run dev:server
npm run build:ui
npm run start:server
npm run validate
npm run sanitize
npm run security:audit
npm run test:security
npm run release:gate
npm run eval:parity
```

Workspace commands:

```bash
npm --workspace=apps/user-interface run build
npm --workspace=apps/user-interface run lint
npm --workspace=apps/user-interface run test
npm --workspace=apps/user-interface run test:e2e
npm --workspace=apps/server-bridge run test
```

## 5. Local Verification Checklist

After code changes, run the smallest relevant checks first:

1. `npm run validate`
2. `npm --workspace=apps/user-interface run lint` (if UI changed)
3. `npm --workspace=apps/server-bridge run test` (if server changed)
4. `npm run security:audit` (before merge or release)

## 6. Current Project Layout

```text
apps/
  server-bridge/
    index.js
    orchestrator/
    auth/
    vfs/
    sandbox/
    memory/
    mcp/
  user-interface/
    src/
    public/
    e2e/
docs/
scripts/
tests/
```

## 7. AI Agent Notes

- Use ES modules and keep `.js` extensions on relative imports.
- Prefer deterministic checks and tool validation before costly model calls.
- Keep orchestrator edits followed by `npm run validate`.
- Do not depend on non-existent root scripts such as `npm run lint` or `npm run db:migrate`.

## 8. Troubleshooting

- Port conflict: ensure `3001` (server) and `5173` (UI) are free.
- Dependency drift: rerun `npm ci` from repo root.
- Env mismatch: regenerate local env files from `.env.example` templates.
- Failing orchestrator syntax: run `npm run validate` and inspect `apps/server-bridge/orchestrator/index.js` first.

## 9. Related Docs

- [Engineering Principles](../ENGINEERING_PRINCIPLES.md)
- [System Architecture](./TECHNICAL_ARCHITECTURE.md)
- [Audit Mode](./AUDIT_MODE.md)
- [Scaling Plan](./SCALING_PLAN.md)
