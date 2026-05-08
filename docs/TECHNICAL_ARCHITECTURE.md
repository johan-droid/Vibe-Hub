# Technical Architecture Specification

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Status:** Production Ready  
**AI Agent Focus:** Enhanced for AI agent development workflows

---

## AI Agent Quick Reference

**Essential File Locations:**
- State Machine: `apps/server-bridge/src/orchestrator/state_machine.js`
- VFS Container: `apps/server-bridge/src/vfs/container.js`
- API Router: `apps/server-bridge/src/orchestrator/router.js`
- LLM Client: `apps/server-bridge/src/orchestrator/llm_client.js`
- Docker Sandbox: `apps/server-bridge/src/sandbox/docker_executor.js`

**Critical Architecture Rules for AI Agents:**
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Always use ES modules with `.js` extensions
- ✅ Use Docker sandbox for all code execution
- ✅ Follow XState deterministic patterns
- ✅ Maintain VFS approval gates

**AI Agent Development Tools:**
- `multi_edit` for coordinated file changes
- `grep_search` for pattern finding
- `find_by_name` for file discovery
- `node --check` for syntax validation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Component Architecture](#3-component-architecture)
4. [Data Flow Architecture](#4-data-flow-architecture)
5. [Security Architecture](#5-security-architecture)
6. [State Management](#6-state-management)
7. [Communication Protocols](#7-communication-protocols)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Dashboard   │ │ DiffViewer  │ │ Terminal    │           │
│  │ (Glass UI)  │ │ (Approval)  │ │ (Real-time) │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│         React + Material 3 + Zustand + Socket.io            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket/HTTP
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Orchestrator│ │ VFS         │ │ Sandbox     │           │
│  │ (XState)    │ │ (Staging)   │ │ (Docker)     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│         Node.js + Express + XState + Socket.io            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ PostgreSQL  │ │ pgvector    │ │ Redis       │           │
│  │ (Primary)   │ │ (Semantic)  │ │ (Cache)     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Core Components

| Component | Technology | Responsibility |
|-----------|------------|-----------------|
| **Frontend** | React 18 + Vite + Material 3 | Glass-morphism UI, real-time updates |
| **Backend** | Node.js 18+ + Express + XState | Orchestration, API, WebSocket |
| **Database** | PostgreSQL 14+ + pgvector | Persistent storage, semantic search |
| **Sandbox** | Docker + GitHub Actions | Isolated code execution |
| **State** | Zustand + XState | Client/server state management |

---

## 2. Architecture Principles

### 2.1 V6 Architecture Philosophy

#### Strict Context Isolation
```
apps/server-bridge/
├── org_core/          ← Global, non-negotiable rules
│   ├── context_builder.js      # CI/CD, linting, deployment
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

**Rules:**
- ❌ NO imports between `org_core/` and `user_env/`
- ✅ Orchestrator is the sole integration point
- ✅ Org constraints ALWAYS override user preferences

#### Language Lock
User preferences are hard-locked to three languages only:
- `en` (English)
- `hi` (Hindi) 
- `or` (Odia)

Any other language request defaults to `en`.

#### Deployment Lock
All deployments must use **local Docker sandbox only**. No cloud deployment permitted.

### 2.2 Design Patterns

| Pattern | Implementation | Purpose |
|---------|----------------|---------|
| **State Machine** | XState | Deterministic orchestration with rollback |
| **Repository** | Database abstraction | Clean data access layer |
| **Observer** | EventEmitter + WebSocket | Real-time updates |
| **Adapter** | LLM provider abstraction | Multi-provider support |
| **Singleton** | VFS, LLM clients | Resource management |

---

## 3. Component Architecture

### 3.1 Frontend Architecture

#### 3.1.1 Component Hierarchy
```
src/
├── components/
│   ├── Dashboard.jsx           # Main layout orchestrator
│   ├── AgentStatusBar.jsx      # Agent status & controls
│   ├── IntentChatPanel.jsx     # User interaction
│   ├── CodeCanvas.jsx          # Diff viewer
│   ├── ActivityFeed.jsx        # Agent activity log
│   ├── PeekTerminal.jsx        # Terminal strip
│   └── AgentActionOverlay.jsx  # Long-running task overlay
├── context/
│   └── ThemeContext.jsx        # Dark theme enforcement
├── hooks/
│   ├── useAgent.js            # Agent interaction
│   ├── useStore.js            # Zustand store
│   └── useJobResumption.js    # Session persistence
├── store/
│   └── useStore.js            # Global state management
└── services/
    └── api.js                 # API client with auth
```

#### 3.1.2 State Management (Zustand)
```javascript
// Global Store Structure
{
  // Authentication
  user: null,
  isAuthenticated: false,
  
  // Agent State
  agentLoopStatus: {
    status: 'idle',
    history: [],
    currentIteration: 0,
    maxRetries: 3
  },
  
  // VFS State
  vfsInstance: null,
  diffData: null,
  openFiles: [],
  
  // UI State
  isThinking: false,
  neuralStatus: {
    phase: 'idle',
    confidence: 0
  },
  
  // Terminal State
  terminalSessions: new Map(),
  activeTerminalSession: null
}
```

### 3.2 Backend Architecture

#### 3.2.1 Module Structure for AI Agents
```
apps/server-bridge/
├── orchestrator/                # AI agent orchestration layer
│   ├── state_machine.js         # XState machine (7 states)
│   ├── router.js                # API endpoints
│   ├── llm_client.js           # LLM abstraction (Gemini/OpenAI)
│   └── websocket.js             # Socket.io handlers
│
├── vfs/                         # Virtual File System
│   ├── container.js             # VFS main class - STAGING AREA
│   ├── diff_engine.js           # Change tracking
│   └── audit_logger.js          # Decision tracking
│
├── sandbox/                     # Code execution
│   ├── docker_executor.js       # Container management
│   └── github_actions.js        # CI/CD integration
│
├── memory/                      # Data access
│   ├── loader.js                # Semantic graph builder (AST)
│   ├── database.js              # PostgreSQL client
│   └── vector_store.js          # pgvector operations
│
├── org_core/                    # Immutable constraints (READ-ONLY)
│   ├── context_builder.js       # CI/CD, deployment rules
│   ├── ci_cd_templates/         # Workflow templates
│   └── global_linting/          # Code standards
│
├── user_env/                    # User preferences (FLEXIBLE)
│   ├── context_builder.js       # Language, themes
│   └── locales/                 # en, hi, or translations
│
└── utils/                       # Utilities
    ├── logger.js                # Winston structured logging
    ├── validation.js            # Zod schemas
    └── security.js              # XSS protection
```

**AI Agent Critical Path:**
1. `state_machine.js` → Orchestrates all AI operations
2. `container.js` → Stages changes before disk write
3. `docker_executor.js` → Tests code in isolation
4. `router.js` → API endpoints for frontend

#### 3.2.2 State Machine (XState) for AI Agents
```javascript
// Agent Orchestration States - AI AGENT CRITICAL PATH
const agentMachine = createMachine({
  id: 'agent',
  initial: 'idle',
  states: {
    idle: {
      on: { START_TASK: 'loading_contexts' }
    },
    loading_contexts: {
      invoke: {
        src: 'fetchIsolatedContexts',
        onDone: { target: 'parsing_ast' },
        onError: { target: 'fatal_failure' }
      }
    },
    parsing_ast: {
      invoke: {
        src: 'buildSemanticGraph',
        onDone: { target: 'drafting_code' },
        onError: { target: 'fatal_failure' }
      }
    },
    drafting_code: {
      invoke: {
        src: 'generateLLMCode',
        onDone: { target: 'sandboxing' },
        onError: { target: 'rollback' }
      }
    },
    sandboxing: {
      invoke: {
        src: 'triggerGitHubActionSandbox',
        onDone: { target: 'success' },
        onError: { target: 'evaluating_failure' }
      }
    },
    evaluating_failure: {
      always: [
        { target: 'drafting_code', cond: 'canRetry' },
        { target: 'rollback', cond: 'shouldRollback' }
      ]
    },
    rollback: {
      invoke: {
        src: 'injectAntigravityPrompt',
        onDone: { target: 'drafting_code' }
      }
    },
    success: {
      type: 'final'
    },
    fatal_failure: {
      type: 'final'
    }
  }
});
```

**AI Agent State Machine Navigation:**
- **Entry Point**: `idle` → `loading_contexts` (START_TASK event)
- **AST Analysis**: `parsing_ast` uses Tree-sitter for deterministic parsing
- **Code Generation**: `drafting_code` calls LLM with context
- **Safety Testing**: `sandboxing` runs Docker containers with `--network none`
- **Error Recovery**: `rollback` injects antigravity prompt after 3 failures
- **Success Path**: VFS staging → User approval → Disk commit

---

## 4. Data Flow Architecture

### 4.1 Request Flow for AI Agents

```
User Input (Intent Chat)
    ↓
API Gateway (/api/agent/prompt)
    ↓
XState Machine (Orchestrator) ← AI AGENT ENTRY POINT
    ↓
Context Builder (org_core + user_env) ← ISOLATION ENFORCED
    ↓
LLM Client (Gemini/OpenAI) ← CODE GENERATION
    ↓
VFS Staging (memory/vfs) ← SAFETY GATE
    ↓
Docker Sandbox (sandbox/) ← ISOLATION TESTING
    ↓
WebSocket Streaming (orchestrator/websocket) ← REAL-TIME UPDATES
    ↓
Frontend Update (Dashboard)
```

### 4.2 Data Persistence Flow for AI Agents

```
Code Generation (LLM)
    ↓
VFS Container (in-memory) ← STAGING AREA
    ↓
User Approval (DiffViewer) ← HUMAN GATE
    ↓
Database Write (PostgreSQL) ← PERSISTENCE
    ↓
Semantic Index (pgvector) ← SEARCH INDEX
    ↓
Audit Log (structured logging) ← TRACEABILITY
```

**AI Agent VFS Workflow:**
1. `stageFile()` → Add to memory, not disk
2. `approveFile()` → User approval required
3. `commitToDisk()` → Only after approval
4. `audit_logger.js` → Records all decisions

### 4.3 Real-time Communication

#### WebSocket Events (Socket.io)
```javascript
// Server → Client Events
socket.emit('agent_status', {
  status: 'parsing_ast',
  message: 'Analyzing code structure...',
  progress: 0.6
});

socket.emit('file_staged', {
  filePath: 'src/components/Button.jsx',
  diff: { additions: [], deletions: [] },
  metadata: { retries: 1, sandbox_passed: true }
});

socket.emit('terminal_output', {
  sessionId: 'term_123',
  data: 'npm test passed',
  type: 'command_complete'
});

// Client → Server Events
socket.emit('join_room', { userId: 'user_123' });
socket.emit('approve_changes', { fileIds: ['file_1', 'file_2'] });
socket.emit('send_prompt', { message: 'Add dark mode toggle' });
```

---

## 5. Security Architecture

### 5.1 Authentication & Authorization

```
Google OAuth 2.0
    ↓
JWT Token (access + refresh)
    ↓
Session Management (PostgreSQL)
    ↓
Rate Limiting (express-rate-limit)
    ↓
API Authorization (helmet, cors)
```

#### Security Layers
1. **Network Layer**: HTTPS, CORS, Helmet.js
2. **Application Layer**: JWT validation, rate limiting
3. **Data Layer**: SQL injection prevention, input validation
4. **Execution Layer**: Docker isolation, no network access
5. **Audit Layer**: Structured logging, request tracing

### 5.2 Sandbox Security

```dockerfile
# Docker Security Configuration
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
WORKDIR /app
COPY --chown=nodejs:nodejs . .
RUN --network none --read-only \
    --memory=512m --cpus=1 \
    --timeout=10s \
    npm test
```

#### Security Controls
- ✅ **Network Isolation**: `--network none`
- ✅ **Read-only Filesystem**: `--read-only`
- ✅ **Resource Limits**: Memory, CPU, timeout
- ✅ **Non-root User**: `nodejs:1001`
- ✅ **Auto-cleanup**: `--rm` on exit

### 5.3 Input Validation

```javascript
// Zod Schema Examples
const promptSchema = z.object({
  message: z.string().max(1000).min(1),
  context: z.object({
    language: z.enum(['en', 'hi', 'or']),
    effort: z.enum(['minimal', 'standard', 'thorough'])
  }).optional()
});

const fileOperationSchema = z.object({
  filePath: z.string().regex(/^[\w\-./]+$/),
  content: z.string().max(5_000_000),
  operation: z.enum(['create', 'update', 'delete'])
});
```

---

## 6. State Management

### 6.1 Client State (Zustand)

```javascript
// Store Structure
const useStore = create((set, get) => ({
  // Authentication
  user: null,
  setUser: (user) => set({ user }),
  
  // Agent Loop
  agentLoopStatus: {
    status: 'idle',
    history: [],
    currentIteration: 0
  },
  updateAgentStatus: (status) => set(state => ({
    agentLoopStatus: { ...state.agentLoopStatus, ...status }
  })),
  
  // VFS Integration
  vfsInstance: null,
  setVfsInstance: (instance) => set({ vfsInstance: instance }),
  
  // Real-time Updates
  isThinking: false,
  neuralStatus: { phase: 'idle', confidence: 0 },
  
  // Terminal Sessions
  terminalSessions: new Map(),
  addTerminalSession: (session) => set(state => ({
    terminalSessions: new Map(state.terminalSessions).set(session.id, session)
  }))
}));
```

### 6.2 Server State (XState)

```javascript
// Global State Manager
class StateManager {
  constructor() {
    this.agentService = new AgentService();
    this.vfsService = new VFSService();
    this.sandboxService = new SandboxService();
  }
  
  async handleUserPrompt(userId, message) {
    const session = this.agentService.createSession(userId);
    return await this.agentService.execute(session, message);
  }
  
  async approveChanges(userId, fileIds) {
    return await this.vfsService.commitChanges(userId, fileIds);
  }
}
```

---

## 7. Communication Protocols

### 7.1 REST API

#### Authentication Endpoints
```
POST   /api/auth/google          # Google OAuth
POST   /api/auth/github          # GitHub OAuth
POST   /api/auth/handoff         # OAuth handoff exchange
GET    /api/auth/status          # Session validation
POST   /api/auth/logout          # Session termination
```

#### Agent Endpoints
```
POST   /api/agent/prompt         # Send user prompt
GET    /api/agent/status         # Get agent status
POST   /api/agent/stop           # Stop agent execution
POST   /api/agent/reset          # Reset agent state
```

#### VFS Endpoints
```
GET    /api/vfs/pending          # Get staged files
POST   /api/vfs/commit           # Commit approved changes
POST   /api/vfs/reject           # Reject staged changes
GET    /api/vfs/diff/:fileId     # Get file diff
GET    /api/vfs/stats            # Get VFS statistics
```

### 7.2 WebSocket Protocol

#### Connection Handshake
```javascript
// Client Connection
const socket = io('http://localhost:3001', {
  auth: { token: jwt },
  transports: ['websocket']
});

// Join User Room
socket.emit('join_room', { userId: 'user_123' });
```

#### Event Types
```javascript
// Agent Status Events
socket.on('agent_status', (data) => {
  // { status, message, progress, timestamp }
});

// File Staging Events  
socket.on('file_staged', (data) => {
  // { fileId, filePath, diff, metadata }
});

// Terminal Events
socket.on('terminal_output', (data) => {
  // { sessionId, data, type, timestamp }
});

// Error Events
socket.on('error', (data) => {
  // { code, message, details, timestamp }
});
```

---

## 8. Deployment Architecture

### 8.1 Local Development

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Stack                        │
│                                                             │
│  Frontend: Vite Dev Server (http://localhost:5173)        │
│  Backend:  Node.js (http://localhost:3001)                │
│  Database: PostgreSQL (localhost:5432)                   │
│  Sandbox:  Docker Desktop (local containers)              │
│                                                             │
│  Start: npm run dev                                        │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Stack                         │
│                                                             │
│  Frontend: CDN (Static assets)                              │
│  Backend:  Node.js Cluster (PM2)                           │
│  Database: PostgreSQL (Primary + Replica)                 │
│  Cache:    Redis (Session + Caching)                       │
│  Sandbox:  Docker Swarm (Isolated containers)             │
│                                                             │
│  Monitoring: Winston + Prometheus + Grafana                │
│  Logging:    Structured JSON + ELK Stack                  │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Environment Configuration

```bash
# .env.production
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/vibehub
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# LLM Providers
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Security
UI_ORIGIN=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# Sandbox
DOCKER_HOST=unix:///var/run/docker.sock
SANDBOX_TIMEOUT=10000
```

---

## Appendix A: Technology Stack

### Frontend
- **React 18**: UI framework with hooks and concurrent features
- **Vite**: Build tool with HMR and optimized bundling
- **Material 3**: Design system with dark theme
- **Zustand**: Lightweight state management
- **Socket.io**: Real-time WebSocket client
- **Framer Motion**: Animations and transitions
- **Lucide React**: Icon library

### Backend
- **Node.js 18+**: Runtime with ES modules support
- **Express**: Web framework with middleware
- **XState**: State machine for orchestration
- **Socket.io**: Real-time WebSocket server
- **PostgreSQL**: Primary database with pgvector
- **Docker**: Container runtime for sandboxing
- **Winston**: Structured logging
- **Zod**: Runtime type validation

### Development
- **TypeScript**: Type safety (where applicable)
- **ESLint + Prettier**: Code quality
- **Vitest**: Unit and integration testing
- **NPM Workspaces**: Monorepo management

---

## Appendix B: Performance Considerations

### Frontend Optimization
- **Code Splitting**: Lazy loading for dashboard components
- **Virtual Scrolling**: For large activity feeds
- **Debouncing**: User input and API calls
- **Memoization**: React.memo and useMemo for expensive renders

### Backend Optimization
- **Connection Pooling**: PostgreSQL connection management
- **Rate Limiting**: API abuse prevention
- **Caching Strategy**: Redis for frequent queries
- **Async Processing**: Non-blocking I/O operations

### Database Optimization
- **Indexing Strategy**: Primary keys and foreign keys
- **Query Optimization**: Prepared statements and EXPLAIN analysis
- **Connection Management**: Pool size and timeout configuration
- **Backup Strategy**: Automated daily backups

---

**End of Technical Architecture Document**
