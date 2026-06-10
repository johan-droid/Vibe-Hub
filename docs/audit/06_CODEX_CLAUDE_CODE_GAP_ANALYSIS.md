# Codex / Claude Code Gap Analysis

This document identifies gaps between the current Selina / Vibe Hub implementation and a serious autonomous coding platform like Claude Code or GitHub Copilot Workspace.

## 1. Context and File Discovery
- **Current Capability**: Uses VFS and explicit AST mappings (via pgvector).
- **Blocker**: Heavily reliant on pre-indexed Postgres schemas; lacks dynamic `rg` (ripgrep) or semantic token crawling across unindexed files.
- **Fixed Now**: Validated existing VFS.
- **Next Recommended Work**: Implement a local ripgrep/AST crawling agent that doesn't rely entirely on the remote vector DB.

## 2. Sandbox Execution
- **Current Capability**: Isolated Docker containers.
- **Blocker**: Missing persistent session states (e.g. running a dev server, editing a file, and seeing the hot-reload output without tearing down the container).
- **Fixed Now**: Validated sandbox policy tests.
- **Next Recommended Work**: Migrate from short-lived Docker runs to Firecracker microVMs or long-running DevContainers.

## 3. Tool Safety and Schema Validation
- **Current Capability**: MCP integrations (Neon, Stitch, Render).
- **Blocker**: Lacks explicit human-in-the-loop "dry run" visualizers for destructive SQL/Render commands before execution.
- **Fixed Now**: NA.
- **Next Recommended Work**: Implement a standard "Blast Radius" score for every MCP action.

## 4. Model Abstraction
- **Current Capability**: `SelinaRouter` can switch between OpenAI, Groq, Nim, Gemini.
- **Blocker**: Rate limit fallback loops can still thrash if the primary model fails context length checks.
- **Fixed Now**: Verified budget managers and quota guards.
- **Next Recommended Work**: Implement smart chunking that dynamically trims history based on the active model's specific context window during fallback.
