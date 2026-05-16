# Vibe-Hub Documentation

This folder is the primary technical reference for the repository. It documents the current workspace layout, the server bridge, the UI, the guarded VFS flow, and the implementation-level architecture used by the platform.

## Read This First

1. [Development Setup](./DEVELOPMENT_SETUP.md) for local setup and validation commands.
2. [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) for the current code boundaries and runtime model.
3. [API Specification](./API_SPECIFICATION.md) for the exposed HTTP and session routes.
4. [Software Requirements](../SRS.md) for product and system requirements.
5. [System Plan](../SYSTEM_PLAN.md) for implementation direction and roadmap context.

## Core Documents

- [Development Setup](./DEVELOPMENT_SETUP.md)
- [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
- [API Specification](./API_SPECIFICATION.md)
- [Software Requirements Specification](../SRS.md)
- [System Plan](../SYSTEM_PLAN.md)
- [Migration to Supabase](./MIGRATION_TO_SUPABASE.md)
- [Agent Reference](./AGENTS.md)

## Technical Deep Dives

- [Overview](./technical/overview.md)
- [Data Flow](./technical/dataflow.md)
- [State Machine](./technical/state-machine.md)
- [User Flow](./technical/user-flow.md)
- [Virtual File System](./technical/vfs.md)

## Notes on Coverage

- Files under `docs/technical/` describe how the implementation works today, not just how it is intended to work.
- The root README and the setup guide should match the current `package.json` scripts and workspace layout.
- When a doc references code paths, those paths should resolve inside `apps/server-bridge/` or `apps/user-interface/`.
- Placeholder links to files that do not exist have been removed from this index.

## Writing Standard

- Prefer explicit file paths over generic descriptions.
- Document the current route names, scripts, and component boundaries.
- Call out security constraints and approval gates whenever a workflow touches code execution or disk writes.
- Keep architecture claims aligned with the actual implementation under `apps/server-bridge/` and `apps/user-interface/`.
