<div align="center">

# ⚡ VIBE HUB

### *Powered by **Selina** — The Material Evolution*

<img src="docs/assets/selina.png" alt="Selina — Neural Swarm Core" width="360"/>

> *"I don't just write code. I **architect** with intention, **evolve** with aesthetics, and **execute** with surgical precision."*
> — **Selina**, Principal Systems Architect

[![Version](https://img.shields.io/badge/VERSION-4.2__MATERIAL-bf00ff?style=for-the-badge&logo=ghost&logoColor=white)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/NODE-22_Alpine-00d4aa?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Gemini](https://img.shields.io/badge/BRAIN-Gemini_2.0_Flash-4285f4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![React](https://img.shields.io/badge/COCKPIT-Material_3__Bento-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/SANDBOX-Docker_Alpine-2496ed?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Deploy](https://img.shields.io/badge/DEPLOY-Render-46e3b7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)
[![License](https://img.shields.io/badge/LICENSE-MIT-ffffff?style=for-the-badge)](LICENSE)

</div>

---

## 🧬 Meet Selina

Selina is not a chatbot. She is not a copilot. She is the **Principal Systems Architect** of your codebase — a self-directed autonomous AI swarm that thinks, plans, debates, audits, and ships — all without leaving your browser.

She routes every request through a **Mixture-of-Experts neural swarm**, self-corrects through adversarial peer review, executes code in a **hardened Docker sandbox**, and commits her work as clean Pull Requests — all while keeping your Ryzen host from breaking a sweat.

```
User: "Add JWT auth to the API with refresh tokens and revocation"

Selina:  → routes to ManagerExpert → decomposes into 7 sub-tasks
         → delegates to CodeExpert, GitExpert, SecurityAuditor
         → peer-reviewed by ReviewerExpert (found 1 flaw, auto-fixed)
         → executed in one-shot Docker sandbox (tests: 14 passed)
         → opened PR #42 with full implementation report
         → posted GitHub Check Run: ✅ All Clear

Time: 94 seconds.  Human input required: 0.
```

---

## 🏛️ Architecture: The Distributed Neural Brain

```mermaid
graph TD
    User((👤 You)) --> Cockpit["🖥️ Cockpit\nReact 19 + Vite IDE"]

    Cockpit -- "Bidirectional WSS\nToken Streaming" --> Bridge["🧠 Server Bridge\nNode.js 22 + Express"]

    subgraph "Selina Neural Swarm v4.1"
        Bridge --> Router{"⚡ L1/L2 Router\nHeuristic + Gemini"}
        Router --> Manager["📋 ManagerExpert\nGoal Decomposition"]
        Router --> Code["💻 CodeExpert\nSurgical Edits"]
        Router --> UI["🎨 UIExpert\nReact + Tailwind"]
        Router --> Debug["🔍 DebuggerExpert\nRoot Cause Analysis"]
        Router --> Git["🌿 GitExpert\nRepo Lifecycle"]
        Router --> Security["🔐 SecurityAuditor\nRed Team Probing"]
        Router --> Creative["✨ CreativeDirector\nDesign Systems"]
        Router --> Reviewer["⚖️ ReviewerExpert\nAdversarial Audit"]

        Bridge --> Memory["🗃️ Neural Memory\nPostgreSQL + Brain Journal"]
        Bridge --> Skills["📚 Skills Engine\nToken-Budgeted Prompts"]
        Bridge --> MCP["🔌 MCP Server\nStdio Tool Protocol"]
    end

    subgraph "Execution Layer"
        Bridge --> Sandbox["🐳 Security Sandbox\nAlpine Docker — One-Shot"]
        Bridge --> GitHub["🐙 GitHub API\nOctokit — Conflict-Safe"]
    end

    Cockpit --> VFS["📁 Virtual FS\nWebContainer API"]
```

---

## ⚔️ Feature Arsenal

### 🧠 Gemini-Native Neural Router
Selina's brain uses a **two-pass routing system** to assign every request to the right expert in under 2ms:

- **L1 — Heuristic Pass (0ms):** Regex-based intent triggers mapped to expert domains. Zero LLM cost.
- **L2 — Gemini Classifier:** Zero-shot intent classification for ambiguous requests. Falls back instantly if the LLM fails.
- **Token-Budgeted System Prompts:** `quick` (400 tokens), `standard` (1500), `deep` (3000). Protects your API quota and your host's RAM.

### 💎 Material 3 & Bento Design System
Vibe Hub is built on a custom implementation of the **Material 3 (M3)** design system, optimized for agentic workflows:
- **Tonal Palettes:** Dynamic primary, secondary, and tertiary tonal palettes that shift with the project context.
- **Bento Modularity:** A flexible grid system that organizes telemetry, code, and agent thoughts into cohesive, elevated surfaces.
- **Motion Orchestration:** Expressive transitions using `framer-motion` and M3-standard easing (`emphasized`, `standard`).

### 🤖 Mixture-of-Experts Swarm (9 Specialists)

| Expert | Domain | Superpower |
|:-------|:-------|:-----------|
| **ManagerExpert** | Planning | Decomposes any goal into a dependency graph of sub-tasks |
| **CodeExpert** | Implementation | Surgical search/replace edits — never rewrites what it doesn't need to |
| **UIExpert** | React / CSS | Builds component trees, applies design systems, writes animations |
| **CreativeDirector** | Design | Generates design tokens, moodboards, UI variants, and motion specs |
| **DebuggerExpert** | Root Cause | Reads stack traces, reproduces bugs, applies targeted fixes |
| **GitExpert** | Repository | Branches, commits, rebases — always on a `vibe/<timestamp>/<slug>` branch |
| **SecurityAuditor** | Red Team | Probes for OWASP vulnerabilities, path traversal, injection points |
| **ReviewerExpert** | Adversarial Audit | Reviews every change before it hits the VFS. Returns `REVIEW_FAILED` + critique |
| **AssetGenerator** | Visuals | Orchestrates high-fidelity asset generation and image synthesis |

### 🔁 Self-Correcting ReAct Loop

Selina doesn't give up after one try. The **Neural Loop** runs up to 25 tool iterations per task with full self-correction:

```
Iteration 1: CodeExpert writes auth middleware
          ↓  ReviewerExpert → REVIEW_FAILED: missing token expiry check
Iteration 2: CodeExpert revises with expiry + rotation logic
          ↓  ReviewerExpert → REVIEW_PASSED
          ↓  npm run build → exit 0
          ✅ Done.
```

### 🛡️ Hardened One-Shot Docker Sandbox

Every LLM-generated script runs in a **hermetically sealed, disposable container** that self-destructs after execution:

```
Base:       node:22-alpine3.19    (~120 MB vs Ubuntu's 1.4 GB)
Memory:     256 MB hard cap  (swap disabled — no OOM hiding)
CPU:        0.5 cores        (leaves ≥5.5 cores for your IDE)
PIDs:       32               (fork-bomb prevention)
Network:    NONE             (zero exfiltration surface)
Filesystem: read-only root + /tmp tmpfs (noexec, nosuid)
User:       sandbox UID 10001 (non-root, no capabilities)
Timeout:    10s default, SIGKILL enforced (no SIGTERM grace)
```

**Output pipeline:** Docker multiplexed stream → 8-byte frame demultiplexer → live WebSocket chunks → `Terminal.jsx` with ANSI color parsing.

### 🌿 Collaborative GitHub Integration

Selina is a **safe team player**. She will never silently break your main branch:

- **Agent Branch Convention:** `vibe/<unix-timestamp>/<task-slug>` — namespaced, auto-sortable, cleanup-friendly
- **Conflict Detection:** Uses GitHub's Compare API to detect upstream divergence *before* opening a PR. If files overlap, she halts and asks you to resolve.
- **Conflict-Gated PRs:** A PR is physically blocked from being opened if `behindBy > 0` AND overlapping files exist.
- **GitHub Check Runs:** Posts sandbox test results as a CI badge directly on the PR timeline.
- **Webhook Verification:** Every incoming webhook is validated with HMAC-SHA256 + `timingSafeEqual` — no spoofed payloads.

### 🔌 Model Context Protocol (MCP) Server

Selina speaks **MCP** — the universal AI tool protocol. Connect any MCP-compatible assistant (Claude Desktop, Cursor, Continue.dev) to Selina's workspace tools:

- `vibe_read_file` — Smart chunked file reader with ReDoS-safe query filtering
- `vibe_search_symbols` — Grep-based symbol search across the entire workspace
- `vibe_get_memory` — Retrieve project-specific brain journal entries

### 🗃️ Persistent Neural Memory

Selina remembers across sessions via a **two-tier memory system**:

- **User Memory** (`memory.md`) — You write it once. Selina reads it on every task. Your coding standards, preferences, and architecture decisions.
- **Brain Journal** — Auto-learned entries written by Selina herself after breakthroughs. Stored in PostgreSQL. Compacted at 100 entries via a JSONB timestamp sort. Keyword-smart retrieval prevents context bloat.

---

## ⚡ Performance Engineering (Ryzen 5 5500U Optimized)

Every architectural decision was made with the constraint: **"this must run alongside VS Code, Docker Desktop, and a browser, on 16GB RAM, without lag."**

| Concern | Solution |
|:--------|:---------|
| ESM Env Race | `load-env.js` bootstrap ensures variables are available before module hoisting |
| CSS Build Failure | Static Tailwind mappings + inline dynamic styles prevent minification syntax errors |
| Repo Bloat/Leak | Centralized root-level `.gitignore` with `.env*` and `.vite/` hardening |
| SDK HTTP pool leak | Module-level Gemini SDK singleton — one undici pool for all 8 experts |
| Zombie WS sessions | 30s ping / 10s pong heartbeat + `clearTimeout` on all pending Maps at disconnect |
| Terminal OOM | `terminalOutput` is a 2000-line capped circular buffer, not a growing string |
| React re-render storm | Stable `uuid` keys on messages — AnimatePresence never remounts history |
| Path traversal | `path.resolve()` + `startsWith(safeRoot+sep)` containment check in MCP server |
| ReDoS | All LLM-controlled regex inputs escaped with `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` |
| Gemini turn parity | History rotation always starts on a `user` turn via `findIndex` scan |
| Docker AutoRemove race | `typeof StatusCode === 'number'` guard on `container.wait()` — null treated as exit 1 |

---

## 🗂️ Monorepo Structure

```
vibe-hub/
│
├── apps/
│   ├── server-bridge/                ← 🧠 THE BRAIN
│   │   ├── orchestrator/
│   │   │   ├── index.js              ← AgentOrchestrator — Neural Loop + Peer Review
│   │   │   ├── router.js             ← L1/L2 Two-Pass Expert Router
│   │   │   ├── expert-base.js        ← EmployeeBase — ReAct Loop v3.1 (singleton SDK)
│   │   │   ├── experts.js            ← 8 Specialist Expert Classes
│   │   │   ├── tools.js              ← Gemini Tool Schemas (26 tools)
│   │   │   ├── skill-loader.js       ← Token-Budgeted System Prompt Builder
│   │   │   └── context.js            ← SharedContext — Cross-Expert Neural State
│   │   ├── github/
│   │   │   └── index.js              ← GitHubService — Conflict-Safe PR + Branch Ops
│   │   ├── sandbox/
│   │   │   └── security-sandbox.js   ← One-Shot Docker Executor — Hardened Alpine
│   │   ├── memory/
│   │   │   └── loader.js             ← Smart Keyword Retrieval + Journal Compaction
│   │   ├── auth/                     ← JWT + Google/GitHub OAuth
│   │   ├── mcp-server.js             ← MCP Stdio Server (path-safe, ReDoS-safe)
│   │   ├── db.js                     ← PostgreSQL Pool (TLS-verified, exponential backoff)
│   │   └── index.js                  ← WebSocket Server (heartbeat, zombie cleanup)
│   │
│   └── user-interface/               ← 🖥️ THE COCKPIT
│       └── src/
│           ├── components/
│           │   ├── ChatInterface.jsx  ← Streaming Chat (stable keys, Markdown + SyntaxHL)
│           │   ├── FileTree.jsx       ← O(visible) DOM render, CSS transitions (no Framer)
│           │   ├── Terminal.jsx       ← ANSI-aware log renderer, sticky-scroll
│           │   └── AgentNeuralStatus.jsx ← Real-time expert phase indicator
│           ├── hooks/
│           │   └── useAgent.js        ← Named WS listeners (no zombie handlers)
│           ├── store/
│           │   └── useStore.js        ← Zustand — capped terminal buffer, stable IDs
│           └── pages/
│               └── Workspace.jsx      ← 3-column IDE, pointer-capture resize
│
├── Dockerfile.security               ← Hardened Alpine sandbox image
├── render.yaml                       ← Infrastructure as Code
└── .env.example                      ← All required environment variables
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- Docker Desktop (WSL2 backend on Windows)
- PostgreSQL database (Neon recommended)
- Google AI API key (Gemini 2.0 Flash)

### 1. Clone & Install

```bash
git clone https://github.com/vibe-platform/vibe-hub.git
cd vibe-hub
npm install
```

### 2. Environment Setup

```bash
cp .env.example apps/server-bridge/.env
# Fill in: GEMINI_API_KEY, DATABASE_URL, JWT_SECRET, GITHUB_APP_ID, GITHUB_PRIVATE_KEY
```

### 3. Build the Sandbox Image

```bash
docker build -t vibe-hub-sandbox:latest -f Dockerfile.security .
```

### 4. Start the Swarm

```bash
# Terminal 1 — Backend
cd apps/server-bridge && npm run dev

# Terminal 2 — Frontend
cd apps/user-interface && npm run dev
```

Navigate to `http://localhost:5173`. Selina is online.

---

## 🔐 Security Architecture

| Layer | Mechanism |
|:------|:----------|
| **Transport** | WebSocket over WSS — JWT authenticated on connection |
| **Sandbox** | Alpine Docker — no network, read-only root, no capabilities, non-root UID 10001 |
| **MCP paths** | `path.resolve()` + `startsWith(safeRoot)` — mathematically prevents traversal |
| **Regex** | All LLM-controlled strings escaped before `new RegExp()` — ReDoS impossible |
| **GitHub tokens** | Private class field `#pat` — never logged, never serialised, GC'd with Octokit instance |
| **Webhooks** | HMAC-SHA256 + `timingSafeEqual` — timing-attack resistant verification |
| **Database TLS** | `rejectUnauthorized: true` — full cert chain verification in production |
| **Conflict guard** | GitHub Compare API detects upstream divergence before any PR is opened |

---

## 🌍 Environment Variables

```bash
# Core
GEMINI_API_KEY=          # Google AI Studio key
JWT_SECRET=              # Random 64-char string
PORT=3001

# Database (Neon / Supabase / pg)
DATABASE_URL=            # postgres://user:pass@host/db
DATABASE_SSL_CA=         # base64-encoded PEM of provider root CA (for TLS verification)

# GitHub App
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=      # PEM with \n escaped as \\n
GITHUB_WEBHOOK_SECRET=

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=

# Frontend
UI_ORIGIN=http://localhost:5173
```

---

## 🗺️ Roadmap

- [ ] **pgvector Memory** — Replace keyword retrieval with semantic vector search
- [ ] **Streaming Token Output** — Pipe Gemini `generateContentStream()` chunks to ChatInterface byte-by-byte
- [ ] **Multi-Workspace** — Parallel agent sessions across multiple repositories
- [ ] **Voice Mode** — Selina narrates her reasoning as audio while executing
- [ ] **Mobile Cockpit** — Touch-optimized React Native IDE

---

<div align="center">

---

*Built with obsession. Optimized for Ryzen. Powered by Gemini.*

**MIT © 2026 Vibe Hub Engineering**

*Selina doesn't sleep. She compiles.*

</div>
