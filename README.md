<div align="center">
  <!-- Place your banner image here -->
  <img src="docs/assets/selina-banner.png" alt="Selina Banner" width="100%" />

  # Selina

  **A High-Tier, Autonomous AI Coding Assistant and MOE**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Build Status](https://img.shields.io/github/actions/workflow/status/your-org/selina/ci.yml?branch=main)](https://github.com/your-org/selina/actions)
  [![Version](https://img.shields.io/github/package-json/v/your-org/selina)](https://github.com/your-org/selina/releases)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

</div>

## 🌌 Overview

**Selina** is a professional, multi-agent AI software engineer designed to operate autonomously. By leveraging a sophisticated Mixture of Experts (MOE) architecture and integrating directly into your development workflow via the Model Context Protocol (MCP), Selina goes beyond simple code suggestions. She plans, edits, isolates code testing in secure environments, and refines complex software architectures.

Whether you're bootstrapping a new microservice, tracking down elusive bugs, or generating highly interactive frontend UI, Selina serves as an unyielding core developer in your team.

---

## ✨ Core Features

- **Multi-Agent Swarm (MOE):** Specialized agents orchestrate tasks including project planning, code generation, debugging, security auditing, and git management.
- **Native MCP Capabilities:** Dynamically queries external systems, connects to cloud databases, and retrieves system context effortlessly using the Model Context Protocol.
- **Secure Sandboxed Execution:** Automatically runs testing routines inside an isolated Docker sandbox to guarantee generated code safety and stability.
- **Persistent Neural Memory:** Backed by PostgreSQL and `pgvector`, Selina recalls previous structural decisions, architectural patterns, and solutions to avoid repetitive mistakes.
- **Real-Time Workspace Synchronization:** Interfaces gracefully with a React Flow-based frontend, delivering transparent feedback and visualization of her decision-making directed acyclic graph (DAG).
- **Human-in-the-Loop VFS:** Staged file changes reside in an in-memory Virtual File System (VFS) to await developer approval or modification before final persistence.

---

## 🛠 Architecture & Tech Stack

Selina operates on a multi-tiered architecture structured for performance and deep context retention:

- **AI Orchestration (`apps/server-bridge`):** Built on Node.js (v18+) and Express, orchestrating multiple LLM providers (NIM, Groq, Gemini) with a highly concurrent task manager and an XState state machine.
- **Frontend Dashboard (`apps/user-interface`):** A responsive, accessible React 18 / Vite SPA managed with Zustand and styled with Tailwind CSS (Material 3 Dark Mode base).
- **Real-time Protocol:** Communicates via low-latency WebSockets (`socket.io`), streaming thoughts, console outputs, and AST parsing states dynamically.
- **Database & Semantic Indexing:** PostgreSQL, leveraging `pgvector` equipped with `hnsw` indexes for instantaneous retrieval of code patterns and organizational constraints.

---

## 🚀 Getting Started

Follow these steps to deploy Selina locally.

### 1. Prerequisites
- **Node.js** v20.x
- **npm** v10+
- **PostgreSQL** (with the `pgvector` extension)
- **Docker** (Required for the execution sandbox)
- **Redis** (Required for orchestration and session state)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/selina.git
cd selina
npm ci
```

*(Note: Selina uses npm workspaces to manage monorepo dependencies. The `postinstall` script will automatically apply necessary patches).*

### 3. Configuration

Set up your environment variables. Start by copying the template file:

```bash
cp .env.example apps/server-bridge/.env
```

Edit `apps/server-bridge/.env` to include your specific API keys, database URLs, and desired AI provider settings:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/selina
REDIS_URL=redis://localhost:6379
SELINA_MODEL_PROVIDER=nim
```

### 4. Quickstart Usage

Launch the entire stack using concurrently:

```bash
npx concurrently -n UI,BRAIN -c cyan,magenta "npm run dev:ui" "npm run dev:server"
```

This will spin up:
- The Selina Core Server Bridge on `http://localhost:3001`
- The User Interface on `http://localhost:5173`

Navigate to the UI origin to interface with Selina.

---

## 🤝 Contributing

We welcome community contributions! Please review our [Contribution Guidelines](CONTRIBUTING.md) to understand our workflow, how to report bugs, and the process for submitting Pull Requests.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
