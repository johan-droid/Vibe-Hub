# 🧠 Vibe Hub — Autonomous Neural Swarm Platform (v4.0)

> A production-grade, browser-native IDE powered by a server-side Mixture-of-Experts (MoE) Neural Swarm.
> The Brain thinks. The Swarm executes. The IDE visualizes.

[![Deploy](https://img.shields.io/badge/Render-Deploy-blue)](https://render.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0--Neural-indigo)](CHANGELOG.md)

---

## 🏛️ Vibe Neural Architecture

Vibe Hub uses a high-fidelity **Distributed Bridge Pattern** to ensure absolute security and world-class performance.

```mermaid
graph TD
    User((User)) --> UI[apps/user-interface]
    UI -- "WebSocket (Neural State Protocol)" --> Bridge[apps/server-bridge]
    
    subgraph "The Neural Brain (v4.0)"
    Bridge --> Router{MoE Router}
    Router -- "GitExpert" --> GE[Git Ops]
    Router -- "UIExpert" --> UE[UI/UX Ops]
    Router -- "CodeExpert" --> CE[Core Logic]
    Router -- "DebugExpert" --> DE[Triage Ops]
    Router --> Skills[Neural Skills Engine]
    Router --> Memory[(PostgreSQL Persistent Memory)]
    end
    
    UI --> WC[WebContainer Virtual OS]
    Skills -- "Instructional JSON" --> UI
    UI -- "Tool Execution Output" --> Bridge
```

### 🧠 Neural Swarm Features
- **Mixture of Experts**: Hybrid routing using L1 (Regex) and L2 (LLM) to dispatch tasks to specialized agent personas.
- **Neural State Protocol**: Real-time streaming of agent mental states: `thinking`, `analyzing`, `writing`, `verifying`.
- **Anti-Hallucination Protocol**: Enforced "Panic Protocol" that prevents agents from guessing file paths or function signatures.
- **Surgical Edit Engine**: 100% precision with `search/replace` blocks, avoiding full file overwrites.
- **Recursive Self-Correction**: Deep 5-pass loops for `npm run build` verification in the browser.
- **GitHub Foundation (v4.1)**: Deep integration with GitHub Apps, Actions, and Codespaces for cloud-native orchestration.

---

## 💡 How to Unlock Highest Value

To get the most out of the Vibe Hub Neural Swarm, treat it as a **delegated engineering partner**, not just a simple chatbot.

### 1. Give Complex, Multi-File Goals
The **ManagerExpert** can decompose high-level requests (e.g., *"Add authentication with JWT and role-based access"*) into subtasks and dispatch them to the right specialists. Provide clear acceptance criteria and integration points.

### 2. Let it Self-Correct
Thanks to the **ReAct loop**, Vibe Hub handles errors autonomously. Don’t interrupt after one failure—let the loop run. It will often recover from broken builds or hallucinated imports without help.

### 3. Teach it Once, Remember Forever
Use the **Brain Journal** for persistent memory. Explicitly tell the swarm about project-specific patterns (e.g., *"All API routes must validate with Zod"*), and it will inject those learnings into future sessions.

### 4. Lean on Git Safety & Atomic Edits
Every change is a surgical edit with an automatic **Git Checkpoint**. Safely perform risky refactors or experiment with new patterns—there’s always a rollback point.

### 5. Leverage the GitHub Ecosystem
- **Cloud Sandboxing**: Use `github_create_codespace` to offload heavy builds or integration tests to the cloud.
- **MCP Integration**: Connect external AI assistants to Vibe Hub via the **Model Context Protocol** to use its specialized tools.
- **GitHub Models**: Utilize the free high-end LLMs provided by GitHub for deep code reviews and brainstorming.

---

## 📂 Project Structure (Monorepo)

```
vibe-hub/
├── apps/
│   ├── server-bridge/       ← THE BRAIN (System-Critical)
│   │   ├── orchestrator/    ← MoE & Neural Logic
│   │   ├── auth/           ← Google & GitHub OAuth
│   │   ├── db/             ← PostgreSQL / Prisma
│   │   └── memory/         ← Neural Journal persistence
│   └── user-interface/      ← THE COCKPIT (PWA)
│       ├── src/
│       │   ├── pages/       ← Workspace & Landing v4.1
│       │   ├── components/  ← AgentStatus & Terminal Mockup
│       │   ├── vfs/         ← WebContainer Orchestration
│       │   └── hooks/       ← Neural State Listening
├── docs/
│   ├── SRS.md               ← Software Requirements
│   ├── TECHNICAL_DOC.md     ← Architectural Deep Dive
│   └── memory.md.template   ← Human-Brain Instruction Template
├── .github/                 ← CI/CD (Swarm Deployment)
└── render.yaml              ← Infrastructure as Code
```

---

## 🚀 Quick Start (Development)

### 1. Prerequisite
- Node.js 20+
- PostgreSQL instance (local or Cloud)
- Gemini API Key

### 2. Installation
```bash
git clone https://github.com/vibe-platform/vibe-hub.git
cd vibe-hub
npm install
```

### 3. Environment Set-up
Create `apps/server-bridge/.env` based on `.env.example`:
```env
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="...-..."
JWT_SECRET="...-..."
```

### 4. Launch
```bash
npm run dev
```
The Neural Brain starts at `:3001` and the IDE Cockpit at `:5173`.

---

## 🛡️ Security
- **Credential Isolation**: API keys NEVER touch the client browser.
- **Sandbox Execution**: All code runs in a secure, isolated WebContainer.
- **JWT Auth**: Every neural state change is authenticated via server-side middleware.

---

## 📄 Documentation
- [Software Requirements (SRS)](docs/SRS.md)
- [Technical Deep Dive](docs/TECHNICAL_DOC.md)
- [Neural Memory Guide](docs/memory.md.template)

---

MIT © 2026 Vibe Hub Engineering
