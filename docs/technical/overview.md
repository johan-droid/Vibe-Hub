# Vibe-Hub Technical Architecture Overview

**Document Version:** 6.1  
**Last Updated:** 2026-05-04  
**Format:** IEEE 830-1998 (Recommended Practice for Software Requirements Specifications)  

---

## 1. Executive Summary

Vibe-Hub is a SaaS-grade agentic coding platform that leverages deterministic state machine orchestration, abstract syntax tree (AST) analysis, and secure sandboxing to generate code through large language models (LLMs). The system implements a Virtual File System (VFS) with user approval gates to prevent unauthorized disk writes, ensuring security and transparency in AI-assisted software development.

**Key Technical Innovations:**
- XState-based deterministic orchestration with rollback capabilities
- AST-first code analysis using Tree-sitter
- Offline Docker sandboxing with resource constraints
- Multi-layered security architecture (Helmet, rate limiting, validation)
- Structured audit logging with request tracing

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  React 18 + Vite + Material 3 + Zustand + Socket.io-client                   │
│  ├─ DiffViewer (Code Review & Approval)                                      │
│  ├─ Terminal (Real-time Logs)                                                │
│  ├─ Workspace (IDE Interface)                                                │
│  └─ LandingPage (Marketing & OAuth)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ WebSocket / HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY LAYER                                      │
│  NGINX / Render Gateway                                                      │
│  ├─ SSL Termination                                                          │
│  ├─ Rate Limiting (Global)                                                   │
│  └─ Load Balancing                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
│  Node.js 24 LTS + Express 4 + Socket.io 4                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SECURITY MIDDLEWARE                            │   │
│  │  ├─ Helmet.js (CSP, HSTS, X-Frame-Options)                         │   │
│  │  ├─ express-rate-limit (Tiered: 100/30/5 per window)               │   │
│  │  ├─ Zod Validation (Input sanitization)                            │   │
│  │  └─ XSS Protection (Script injection prevention)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ORCHESTRATION ENGINE                           │   │
│  │  XState Machine (7 states: idle → contexts → AST → draft →        │   │
│  │  sandbox → evaluate → success/rollback)                            │   │
│  │  ├─ PromptOrchestrator (Context assembly)                          │   │
│  │  ├─ LLMClient (Gemini/OpenAI/Anthropic abstraction)              │   │
│  │  ├─ SemanticGraphBuilder (Tree-sitter AST parsing)               │   │
│  │  └─ SkillGraph (Expert routing)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      EXECUTION SANDBOX                              │   │
│  │  Docker Engine (Offline, ephemeral containers)                       │   │
│  │  ├─ Network Isolation (--network none)                             │   │
│  │  ├─ Resource Limits (256MB RAM, 0.5 CPU, 50 PIDs)                  │   │
│  │  ├─ Read-Only Filesystem (--read-only)                             │   │
│  │  └─ 10s Execution Timeout                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      VIRTUAL FILE SYSTEM                            │   │
│  │  In-memory staging with approval gates                             │   │
│  │  ├─ stageFile() → approveFile() → commitToDisk()                   │   │
│  │  ├─ Winston audit logging (requestId tracing)                      │   │
│  │  └─ EventEmitter (WebSocket broadcasting)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      IDENTITY & ACCESS                              │   │
│  │  ├─ JWT Authentication (RS256)                                     │   │
│  │  ├─ OAuth 2.0 (Google, GitHub)                                    │   │
│  │  └─ Session Management (PostgreSQL-backed)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ PostgreSQL Protocol
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  PostgreSQL 16 + pgvector extension                                            │
│  ├─ Relational Data (users, projects, sessions)                              │
│  ├─ Vector Embeddings (semantic search, 1536-dim)                            │
│  └─ JSONB Documents (AST graphs, audit logs)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 18.3.1 | UI framework |
| | Vite | 5.4.0 | Build tooling |
| | Material UI | 6.0.0 | Component library |
| | Zustand | 4.5.0 | State management |
| | Socket.io-client | 4.8.0 | Real-time communication |
| **Backend** | Node.js | 24.14.1 LTS | Runtime |
| | Express | 4.19.2 | HTTP framework |
| | Socket.io | 4.8.3 | WebSocket server |
| | XState | 5.19.2 | State machines |
| | Winston | 3.17.0 | Structured logging |
| **Security** | Helmet | 8.1.0 | HTTP headers |
| | express-rate-limit | 7.5.0 | Rate limiting |
| | Zod | 3.25.0 | Schema validation |
| | bcryptjs | 2.4.3 | Password hashing |
| **Data** | PostgreSQL | 16.x | Primary database |
| | pgvector | 0.8.0 | Vector similarity |
| **Sandbox** | Docker Engine | 25.x | Container runtime |
| | Alpine Linux | 3.19 | Container OS |
| **AI** | @google/generative-ai | 0.21.0 | Gemini API |
| | Tree-sitter | 0.22.4 | AST parsing |

---

## 3. Core Components

### 3.1 State Machine Orchestration (XState)

**Location:** `orchestrator/state_machine.js`

The orchestration engine uses XState to enforce deterministic execution with failure recovery.

**State Machine Specification:**

```
States:
  idle ──START_TASK──► loading_contexts ──done──► parsing_ast ──done──► drafting_code
                                                                                │
                                                                                │ error
                                                                                ▼
  fatal_failure ◄──error──┐                                            ┌─────► rollback
        ▲                 │                                            │          │
        │                 │ error                                       │          │ always
        │                 │                                             │          ▼
        │        ┌────────┴────────┐                                    │   drafting_code
        │        │   evaluating    │────────────────────────────────────┘   (retries < 3)
        │        │    _failure     │ error (retries >= 3)
        │        └─────────────────┘
        │                │ success
        │                ▼
        │           sandboxing
        │           │ success
        │           ▼
        └───── success (VFS staging)
```

**Context Schema:**
```javascript
{
  retries: 0,              // Current retry count
  maxRetries: 3,           // Maximum retries before rollback
  astGraph: null,          // Parsed AST structure
  generatedCode: null,     // LLM output
  sandboxError: null,      // Error from Docker execution
  orgContext: null,        // Organizational constraints
  userContext: null,       // User preferences
  taskPrompt: null,       // Original user request
  targetFile: null        // File being modified
}
```

### 3.2 Virtual File System (VFS)

**Location:** `vfs/container.js`

The VFS provides a secure staging layer between agent-generated code and physical disk writes.

**Data Model:**
```javascript
Entry {
  filePath: string,           // Absolute or relative path
  originalContent: string,    // Content before modification
  proposedContent: string,    // Agent-generated code
  metadata: {
    timestamp: ISOString,    // Staging time
    userId: UUID,             // Approving user
    retries: number,         // Generation attempts
    sandboxVerified: boolean // Passed Docker test
  },
  status: 'pending_review' | 'approved' | 'rejected' | 'committed'
}
```

**Security Guarantees:**
1. **No Auto-Commit:** Files remain in memory until explicit approval
2. **Audit Trail:** Every operation logged with requestId and userId
3. **Path Validation:** Zod schemas prevent path traversal attacks
4. **Immutable Original:** Original content preserved for diff/rollback

### 3.3 Docker Sandbox

**Location:** `sandbox/docker_executor.js`

**Execution Profile:**
```bash
docker run \
  --rm \                          # Auto-cleanup
  --network none \                 # Air-gapped
  --memory 256m \                  # Memory ceiling
  --cpus 0.5 \                     # CPU throttling
  --pids-limit 50 \                # Fork bomb protection
  --read-only \                    # Immutable filesystem
  -v "${filePath}:/app/exec.js" \  # Bind mount only
  -w /app \
  node:18-alpine \
  node exec.js
```

**Security Model:**
- Offline execution (no external network)
- Resource quotas prevent DoS
- 10-second timeout kills infinite loops
- Ephemeral containers (no persistence)

---

## 4. API Specification

### 4.1 Authentication

**OAuth Flow:**
1. `GET /api/auth/google` → Redirect to Google
2. Google callback → `POST /api/auth/google/callback` → JWT token
3. Subsequent requests: `Authorization: Bearer <token>`

### 4.2 Rate Limiting Tiers

| Endpoint | Window | Limit | Purpose |
|----------|--------|-------|---------|
| Global | 15 min | 100 req | General protection |
| /api/* | 1 min | 30 req | API protection |
| /api/code | 1 min | 5 req | LLM cost control |

### 4.3 Key Endpoints

#### POST /api/code
Initiates AI code generation with full orchestration.

**Request Body (Zod validated):**
```json
{
  "prompt": "Create a factorial function with error handling",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "targetFile": "src/utils/math.js",
  "socketId": "socket_abc123xyz"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Agent completed successfully",
  "data": {
    "code": "function factorial(n) { ... }",
    "astGraph": { "imports": [], "exports": ["factorial"] },
    "retries": 0,
    "stagedFile": {
      "filePath": "src/utils/math.js",
      "status": "pending_review"
    }
  }
}
```

#### POST /api/fs/commit
Commits approved VFS changes to disk.

**Request:**
```json
{
  "filePath": "src/utils/math.js",
  "approved": true
}
```

**Security:** Requires prior `approveFile()` call in VFS.

---

## 5. Security Architecture

### 5.1 Defense in Depth

```
┌────────────────────────────────────────┐
│  Layer 1: Network (HTTPS/WSS only)       │
├────────────────────────────────────────┤
│  Layer 2: Gateway (Rate limiting)        │
├────────────────────────────────────────┤
│  Layer 3: Application (Helmet, CORS)   │
├────────────────────────────────────────┤
│  Layer 4: Input (Zod validation)         │
├────────────────────────────────────────┤
│  Layer 5: Execution (Docker isolation)  │
├────────────────────────────────────────┤
│  Layer 6: Data (VFS approval gate)       │
└────────────────────────────────────────┘
```

### 5.2 Security Controls

| Threat | Control | Implementation |
|--------|---------|----------------|
| Injection | Input validation | Zod schemas, path sanitization |
| XSS | Content Security Policy | Helmet CSP headers |
| CSRF | SameSite cookies | Strict/None with secure |
| DoS | Rate limiting | express-rate-limit tiers |
| Data leak | VFS approval | Explicit user consent |
| Privilege escalation | Docker isolation | --network none, --read-only |

---

## 6. Testing Strategy

### 6.1 Test Coverage

| Component | Test File | Lines | Coverage |
|-----------|-----------|-------|----------|
| State Machine | `test/state-machine.test.js` | 250+ | All 7 states, transitions, guards |
| VFS | `test/vfs.test.js` | 200+ | Stage, approve, reject, commit |
| API | `test/api.test.js` | 150+ | Endpoints + security |

### 6.2 Test Execution

```bash
# Run all tests
cd apps/server-bridge && npm test

# With UI
cd apps/server-bridge && npm run test:ui

# Coverage report
npm test -- --coverage
```

---

## 7. Deployment Architecture

### 7.1 Render.com Configuration

```yaml
# render.yaml
services:
  - type: web
    name: vibe-hub-api
    runtime: node
    buildCommand: npm install
    startCommand: node index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: vibe-hub-db
          property: connectionString
```

### 7.2 Environment Variables

```
# Required
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=<256-bit-random>

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Frontend
UI_ORIGIN=https://vibe-hub.vercel.app
```

---

## 8. Monitoring & Observability

### 8.1 Structured Logging

**Format:** JSON with requestId tracing
```json
{
  "level": "info",
  "message": "VFS operation",
  "requestId": "req-uuid-1234",
  "type": "vfs_audit",
  "operation": "commit",
  "filePath": "src/app.js",
  "userId": "user-uuid-5678",
  "timestamp": "2026-05-04T14:30:00.000Z"
}
```

### 8.2 Health Check

**Endpoint:** `GET /health`

```json
{
  "status": "active",
  "version": "4.1.0",
  "uptime": 86400,
  "memory": 52428800
}
```

---

## 9. References

[1] Harel, D. (1987). Statecharts: A visual formalism for complex systems. *Science of Computer Programming*, 8(3), 231-274.

[2] ISO/IEC/IEEE 830-1998. *IEEE Recommended Practice for Software Requirements Specifications*.

[3] Docker Inc. (2024). *Docker Security Cheat Sheet*. https://docs.docker.com/engine/security/

[4] OWASP Foundation. (2024). *OWASP Top 10 - 2021*. https://owasp.org/Top10/

---

**Document Control:**
- **Author:** Vibe-Hub Engineering Team
- **Review Cycle:** Quarterly
- **Distribution:** Internal + Partner Engineering
