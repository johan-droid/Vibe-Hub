# Vibe-Hub Project Memory

**Last Updated:** 2026-05-04 01:45 UTC+05:30  
**Current Branch:** main  
**Latest Commit:** 4afe850  
**Status:** Priority 1 Fixes Implemented

---

## Project Overview

Vibe-Hub is a SaaS-grade agentic coding platform with strict architectural isolation. It features a deterministic XState-based orchestration engine with rollback capabilities, AST-first code analysis, offline Docker sandboxing, and a Virtual File System (VFS) with user approval gates.

### Architecture Stack

```
Frontend: React + Material 3 Design (apps/user-interface/)
Backend:  Node.js + XState (apps/server-bridge/)
Database: PostgreSQL + pgvector
Sandbox:  Docker (offline, local-only)
```

---

## Implementation Phases Completed

### ✅ Phase 0: Frontend Polish (Pre-V6)
**Status:** COMPLETE  
**Commit:** Multiple frontend fixes

Fixed unprofessional labels in UI components:
- `FileViewer.jsx`: `IDLE_SYSTEM` → "Ready"
- `Terminal.jsx`: `Idle_System` → "Standby", `GitHub_Action_Queued` → "GitHub Action Queued"
- `SwarmVisualizer.jsx`: `snake_case` labels → human-readable strings

---

### ✅ Phase 1: Structural Isolation
**Status:** COMPLETE  
**Files:** `org_core/`, `user_env/`

Created strict directory boundaries to prevent context bleeding:

```
apps/server-bridge/
├── org_core/               <- IMMUTABLE: Global constraints
│   ├── context_builder.js      # CI/CD, linting rules
│   ├── ci_cd_templates/          # GitHub Actions workflows
│   └── global_linting/          # ESLint rules
│
└── user_env/               <- FLEXIBLE: User preferences
    ├── context_builder.js      # Language, aesthetics
    └── locales/                # en, hi, or only
```

**Key Constraints:**
- Language lock: English, Hindi, Odia only (defaults to en)
- Deployment lock: `local_docker_sandbox_only`
- No cross-imports between `org_core/` and `user_env/`

---

### ✅ Phase 2: XState Machine with Rollback
**Status:** COMPLETE  
**Files:** `orchestrator/state_machine.js`, `orchestrator/router.js`

Implemented deterministic state machine with 7 states:

```
idle → loading_contexts → parsing_ast → drafting_code → sandboxing
                                              ↑              ↓
                                              └── rollback ←─┘
                                                    ↓ (after 3 failures)
                                              evaluating_failure
```

**Features:**
- **Antigravity Mechanism:** After 3 failures, injects `SYSTEM OVERRIDE` prompt
- **Hard Boundaries:** `loading_contexts` loads org + user contexts separately
- **WebSocket Streaming:** Real-time state transitions via Socket.io
- **State Messages:** User-friendly status texts ("Building semantic code graph...")

---

### ✅ Phase 3: AST-First Semantic Graph
**Status:** COMPLETE  
**Files:** `memory/loader.js`

Replaced vector embeddings with deterministic tree-sitter parsing:

```javascript
// Extracts exact imports/exports, no fuzzy matching
const graph = await semanticGraphBuilder.buildSemanticGraph(filePath);
// Returns: { file, strict_imports, strict_exports, internal_functions, ast_node_count }
```

**Libraries:** `tree-sitter`, `tree-sitter-javascript`

---

### ✅ Phase 4: Ephemeral Docker Sandbox
**Status:** COMPLETE  
**Files:** `sandbox/docker_executor.js`

Offline code execution with strict security:

```javascript
const result = await SandboxExecutor.executeLocalDockerSandbox(codeToTest);
// --rm: Auto-destroy container
// --network none: No internet access
// 10s timeout: Kills infinite loops
```

**Returns:** `{ success, output }` or `{ success: false, error_trace }`

---

### ✅ Phase 5: Prompt Orchestrator
**Status:** COMPLETE  
**Files:** `orchestrator/context.js`

Rigid prompt structure for LLM:

```
=== [IMMUTABLE ORGANIZATION CONSTRAINTS] ===
Deployment Target: local_docker_sandbox_only
...

=== [USER ENVIRONMENT PREFERENCES] ===
Aesthetics: minimalist, clean UI...

=== [DETERMINISTIC SEMANTIC GRAPH] ===
Target File: ...
Available Imports (DO NOT INVENT OTHERS):
...

=== [CURRENT TASK] ===
...

=== [CRITICAL EXECUTION FAILURE] === (only on rollback)
Your previous generation failed...
```

---

### ✅ Phase 6: LLM Client Service
**Status:** COMPLETE  
**Files:** `orchestrator/llm_client.js`

Live API integration with prompt orchestration:

```javascript
const rawCode = await llmClient.generateCode(
  orgContext,
  userContext,
  taskPrompt,
  astGraph,
  sandboxError  // null on first pass, populated on rollbacks
);
```

**Environment:**
- `GEMINI_API_KEY` or `LLM_API_KEY`
- Supports Gemini, OpenAI, Anthropic (adjustable format)
- Temperature: 0.2 (deterministic)
- Markdown stripper for safety

---

### ✅ Phase 7: WebSocket Streaming
**Status:** COMPLETE  
**Files:** `index.js`, `orchestrator/router.js`, `services/socket.js`

Real-time XState transition streaming:

**Backend (Socket.io):**
```javascript
io.to(socketId).emit('agent_status', {
  status: state.value,
  message: mapStateToMessage(state.value),
  retries: state.context.retries
});
```

**Frontend:**
```javascript
orchestratorSocket.on('agent_status', (data) => { ... });
orchestratorSocket.on('file_staged', (data) => { ... });
```

---

### ✅ Phase 8: Virtual File System (VFS)
**Status:** COMPLETE  
**Files:** `vfs/container.js`, `store/useVfsStore.js`, `DiffViewer.jsx`

**Two-Step Commit Process:**

1. **Staging:** Agent success → WebSocket → VFS memory (NOT disk)
2. **Review:** DiffViewer shows red/green diff to user
3. **Decision:**
   - **Reject:** Drop from VFS, disk untouched
   - **Approve:** POST `/api/fs/commit` → `fs.writeFile()` → disk

**API Endpoints:**
- `POST /api/fs/commit` — Commit approved changes to physical disk
- `GET /api/fs/pending` — Get pending VFS files
- `GET /api/fs/stats` — Get VFS statistics

**Security Guarantees:**
- ✅ Agent never writes to disk automatically
- ✅ User must explicitly approve every change
- ✅ Full diff visibility before any disk operation
- ✅ Rejection is safe (no disk touch)

---

## Module System

**Standard:** ES Modules (`"type": "module"`)

```javascript
// Correct
import { x } from './file.js';
export { y };

// Incorrect (will fail)
const x = require('./file');
module.exports = y;
```

**Critical Rules:**
- Always include `.js` extension in relative imports
- Use `fileURLToPath(import.meta.url)` for `__dirname`
- Never mix CommonJS and ES modules

---

## Environment Variables

**Required:**
```
DATABASE_URL=postgresql://...
GEMINI_API_KEY=... (or LLM_API_KEY)
JWT_SECRET=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_SECRET=...
UI_ORIGIN=https://your-frontend-url.com
```

**Optional:**
```
LLM_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
LLM_MODEL=gemini-2.0-flash
```

---

## Key Architectural Decisions

1. **XState over simple state** — Deterministic, testable, rollback-capable
2. **AST over vectors** — Eliminates hallucinations in code dependencies
3. **Docker sandbox** — Offline execution, prevents malicious code, antigravity loop
4. **Strict isolation** — Prevents org constraints from bleeding into user prefs
5. **VFS approval gate** — User always in control, no surprise disk writes
6. **WebSocket streaming** — Real-time visibility into agent reasoning

---

## Testing & Verification

**Before committing:**
- [ ] `node --check <file>` passes
- [ ] ES module syntax (`import`/`export`)
- [ ] `.js` extensions on imports
- [ ] No org_core ↔ user_env cross-imports
- [ ] Docker sandbox for all execution
- [ ] Language restrictions (en/hi/or)

**Deployment checklist:**
- [ ] `npm install` in both `server-bridge/` and `user-interface/`
- [ ] `socket.io` and `socket.io-client` installed
- [ ] Environment variables configured
- [ ] Docker Desktop running (for sandbox)

---

## Current Status

**Backend:** All V6 components operational
- State machine with rollback ✓
- AST parser ✓
- Docker sandbox ✓
- LLM client ✓
- VFS with approval gate ✓
- WebSocket streaming ✓

**Frontend:** VFS integration complete
- Zustand store for VFS state ✓
- DiffViewer with approve/reject ✓
- Socket.io client ✓
- Real-time status updates ✓

**Next Steps (if any):**
- Monitor deployment logs for errors
- Collect user feedback on approval gate UX
- Consider adding file path sanitization hardening
- Evaluate Docker sandbox performance under load

---

## File Structure Reference

```
apps/server-bridge/
├── index.js                    # Express + Socket.io server
├── package.json                # ES modules, dependencies
├── db.js                       # PostgreSQL connection
├── org_core/
│   ├── context_builder.js      # Organization constraints
│   ├── ci_cd_templates/        # GitHub Actions
│   └── global_linting/         # ESLint rules
├── user_env/
│   ├── context_builder.js      # User preferences
│   └── locales/                # en, hi, or
├── orchestrator/
│   ├── state_machine.js        # XState with rollback
│   ├── router.js               # API endpoints + WebSocket
│   ├── context.js              # PromptOrchestrator
│   ├── llm_client.js           # Live API calls
│   └── skill-graph.js          # Expert routing
├── memory/
│   └── loader.js               # AST parser + legacy functions
├── sandbox/
│   └── docker_executor.js      # Ephemeral containers
└── vfs/
    └── container.js            # Virtual File System core

apps/user-interface/
├── src/
│   ├── store/
│   │   └── useVfsStore.js      # Zustand VFS state
│   ├── services/
│   │   └── socket.js           # Socket.io client
│   └── features/editor/
│       └── components/
│           └── DiffViewer.jsx   # Approval gate UI
└── package.json
```

---

## Documentation

- `CLAUDE.md` — Comprehensive developer guide with Claude skills
- `MEMORY.md` — This file (work progress for other agents)

---

## Contact & Resources

- Repository: https://github.com/johan-droid/Vibe-Hub
- Render deployment: Check dashboard for live logs
- Database: PostgreSQL via connection string in env
