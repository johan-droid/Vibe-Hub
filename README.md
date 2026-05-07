<div align="center">

# ⚡ VIBE HUB

### *Powered by **Selina** — The Material Evolution*

<img src="docs/assets/selina.png" alt="Selina — Neural Swarm Core" width="360"/>

> *"I don't just write code. I **architect** with intention, **evolve** with aesthetics, and **execute** with surgical precision."*
> — **Selina**, Principal Systems Architect

[![Version](https://img.shields.io/badge/VERSION-6.0__V6_ARCHITECTURE-6366f1?style=for-the-badge&logo=ghost&logoColor=white)](CHANGELOG.md)
[![Node](https://img.shields.io/badge/NODE-18+_LTS-00d4aa?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Gemini](https://img.shields.io/badge/BRAIN-Gemini_API-4285f4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![React](https://img.shields.io/badge/COCKPIT-React_18__Glass_UI-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/SANDBOX-Docker_Alpine-2496ed?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/DATABASE-PostgreSQL_14+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![License](https://img.shields.io/badge/LICENSE-MIT-ffffff?style=for-the-badge)](LICENSE)
[![Docs](https://img.shields.io/badge/DOCS-COMPLETE-10b981?style=for-the-badge&logo=gitbook&logoColor=white)](docs/README.md)

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

## 🏛️ V6 Architecture: Deterministic State Machine System

```mermaid
graph TD
    User((👤 You)) --> Dashboard["🖥️ Glass Dashboard\nReact 18 + Material 3"]

    Dashboard -- "WebSocket/HTTP" --> Bridge["🧠 Server Bridge\nNode.js 18 + XState"]

    subgraph "V6 State Machine Orchestration"
        Bridge --> StateMachine["⚡ XState Machine\n7 States with Rollback"]
        StateMachine --> Context["� Context Builder\norg_core + user_env"]
        StateMachine --> AST["🔍 AST Parser\ntree-sitter deterministic"]
        StateMachine --> LLM["🧠 LLM Client\nGemini API"]
        StateMachine --> VFS["📁 Virtual File System\nStaging + Audit"]
        StateMachine --> Sandbox["� Docker Sandbox\nAlpine isolation"]
    end

    subgraph "Data Layer"
        Bridge --> PostgreSQL["�️ PostgreSQL\nPrimary + pgvector"]
        Bridge --> Redis["⚡ Redis\nCache + Sessions"]
    end

    Dashboard --> Components["🎛️ Glass Components\nDiffViewer + Terminal"]
```

---

## ⚔️ V6 Features: Deterministic & Secure

### 🎯 XState Deterministic Orchestration
The V6 architecture uses **XState state machines** for predictable, rollback-capable agent execution:

- **7-State Flow**: `idle → loading_contexts → parsing_ast → drafting_code → sandboxing → evaluating_failure → rollback/success`
- **Deterministic Execution**: Same input always produces same output (temperature 0.2)
- **Rollback Mechanism**: After 3 failures, inject SYSTEM OVERRIDE and pivot approach
- **Real-time Streaming**: WebSocket updates for every state transition

### 🔍 AST-First Code Analysis
**tree-sitter** provides deterministic code parsing, eliminating hallucinations:

- **Exact Dependencies**: No fuzzy matching - extracts precise imports/exports
- **Function Signatures**: Identifies internal functions and their signatures
- **Structure Mapping**: Builds semantic graphs for accurate code understanding
- **Language Support**: JavaScript, TypeScript, Python, Go with more planned

### 🛡️ Docker Sandbox Security
Every code execution runs in **isolated Alpine containers** with strict security:

```
Base:       node:18-alpine    (~50MB base image)
Memory:     512MB hard cap    (no swap, prevents OOM)
CPU:        1 core max       (resource limits)
Network:    --network none   (no external calls)
Filesystem: read-only root   (noexec, nosuid)
User:       non-root UID     (no capabilities)
Timeout:    10s enforced    (SIGKILL on timeout)
Auto-cleanup: --rm          (ephemeral containers)
```

### 📁 Virtual File System (VFS)
**Staging area with user approval gates** prevents unwanted disk writes:

- **In-Memory Staging**: Code changes held in memory until approval
- **Diff Visualization**: Side-by-side comparison with syntax highlighting
- **Audit Trail**: Complete history of all changes and decisions
- **Approval Gates**: User must explicitly approve before any disk write
- **Rollback Support**: Can reject changes without touching filesystem

### 🏗️ Strict Context Isolation
**V6 enforces architectural boundaries** between organizational and user contexts:

```
apps/server-bridge/
├── org_core/          ← Global, non-negotiable rules
│   ├── context_builder.js      # CI/CD, deployment targets
│   ├── ci_cd_templates/        # Standardized workflows
│   └── global_linting/         # Enforced code standards
│
├── user_env/          ← Flexible user preferences
│   ├── context_builder.js      # Language, aesthetics, UI themes
│   └── locales/                # en, hi, or only
│
└── orchestrator/      ← Only place allowed to import from both
    ├── state_machine.js        # XState DAG with rollback
    └── router.js               # API endpoints
```

### 🌐 Real-time Glass-Morphism UI
**Modern glass-morphism dashboard** with three-panel layout:

- **Agent Status Bar**: LED indicators, session info, control buttons
- **Intent Chat Panel**: Natural language interaction with Collab-style UI
- **Code Canvas**: Diff viewer with file tabs and approval controls
- **Activity Feed**: Chronological agent activity with expandable details
- **Peek Terminal**: Bottom strip showing recent command output
- **Agent Action Overlay**: Non-blocking overlay for long-running tasks

### 🔐 Enterprise Security
**Multi-layered security architecture** for production deployment:

- **JWT Authentication**: Secure token-based auth with refresh mechanism
- **Rate Limiting**: Configurable limits per endpoint and user
- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection Prevention**: Parameterized queries and validation
- **XSS Protection**: Content Security Policy and input sanitization
- **Audit Logging**: Structured logs with request ID tracing

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
- **Node.js** 18+ LTS
- **PostgreSQL** 14+ with pgvector extension
- **Redis** 6+ (for sessions and caching)
- **Docker** Desktop (for sandbox execution)
- **Google AI API key** (Gemini API)

### 📚 Documentation
- **📖 [Complete Documentation](docs/README.md)** - Comprehensive guides
- **⚙️ [Development Setup](docs/DEVELOPMENT_SETUP.md)** - Detailed setup instructions
- **🏗️ [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)** - System design
- **🔌 [API Specification](docs/API_SPECIFICATION.md)** - REST API & WebSocket docs

### 1. One-Command Setup

```bash
# Clone and setup automatically
curl -sSL https://raw.githubusercontent.com/your-org/vibe-hub/main/scripts/setup.sh | bash

# Or manually:
git clone https://github.com/your-org/vibe-hub.git
cd vibe-hub
npm run setup
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your configuration
# Required: GEMINI_API_KEY, DATABASE_URL, JWT_SECRET
# Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET for OAuth
```

### 3. Database Setup

```bash
# Create database and enable extensions
createdb vibehub_dev
psql vibehub_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 4. Start Development

```bash
# Start all services (recommended)
npm run dev

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001/health
# Documentation: http://localhost:3001/docs
```

### 5. Verify Installation

```bash
# Check all services
npm run health-check

# Run tests
npm run test

# Verify API
curl http://localhost:3001/health
```

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
