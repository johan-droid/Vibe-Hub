# Software Requirements Specification (SRS)

**Vibe-Hub: SaaS-Grade Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-04  
**Status:** Production Ready

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Architecture Requirements](#6-architecture-requirements)
7. [Data Requirements](#7-data-requirements)
8. [Security Requirements](#8-security-requirements)

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the complete technical and functional requirements for Vibe-Hub, a SaaS-grade agentic coding platform that uses deterministic state machines, AST parsing, and isolated sandboxing to generate, verify, and commit code changes with strict user approval gates.

### 1.2 Intended Audience

- Software architects and engineers
- DevOps and security teams
- Frontend developers (React/UI)
- Backend developers (Node.js/APIs)
- QA and testing teams

### 1.3 Product Scope

Vibe-Hub provides an AI-powered coding assistant with the following differentiators:
- **Deterministic execution** (XState state machines with rollback)
- **AST-first code analysis** (eliminates hallucinations)
- **Offline Docker sandboxing** (prevents malicious code execution)
- **Virtual File System** (user approval before any disk writes)
- **Strict architectural isolation** (organization vs user contexts)
- **Real-time WebSocket streaming** (live visibility into agent reasoning)

### 1.4 Definitions and Acronyms

| Term | Definition |
|------|------------|
| **VFS** | Virtual File System - In-memory staging before disk writes |
| **AST** | Abstract Syntax Tree - Code structure representation |
| **XState** | JavaScript state management library for deterministic flows |
| **Antigravity** | Rollback mechanism after 3 failed sandbox attempts |
| **Org Context** | Immutable organizational constraints (CI/CD, linting) |
| **User Context** | Mutable user preferences (language, aesthetics) |
| **SaaS** | Software as a Service |

---

## 2. Overall Description

### 2.1 Product Perspective

Vibe-Hub is a self-contained system with three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                        │
│  React + Material 3 + Zustand + Socket.io-client            │
│  - DiffViewer (approval gate)                               │
│  - Terminal (real-time logs)                                │
│  - Activity Feed (orchestration status)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket/HTTP
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                           │
│  Node.js + Express + XState + Socket.io                      │
│  - State Machine (7 states with rollback)                   │
│  - AST Parser (tree-sitter)                                │
│  - Docker Executor (ephemeral containers)                  │
│  - VFS (virtual file system)                               │
│  - LLM Client (Gemini/OpenAI/Anthropic)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ PostgreSQL
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                            │
│  PostgreSQL + pgvector                                      │
│  - User data, projects, sessions                          │
│  - Semantic memory (embeddings)                           │
│  - AST graph storage                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions

1. **AI Code Generation** — Generate code via LLM with structured prompts
2. **AST Analysis** — Parse code dependencies deterministically
3. **Sandbox Testing** — Execute code in isolated Docker containers
4. **Rollback Handling** — Retry failed attempts, pivot after 3 failures
5. **User Approval** — Stage changes in VFS, require explicit approval
6. **Real-time Streaming** — WebSocket updates during orchestration
7. **Multi-language Support** — English, Hindi, Odia (locked)
8. **GitHub Integration** — PR creation, workflow monitoring

### 2.3 User Classes and Characteristics

| User Class | Description | Technical Skill |
|------------|-------------|-----------------|
| **End Users** | Developers using the platform | Moderate (can review code diffs) |
| **Org Admins** | Configure org-wide constraints | High (CI/CD, linting rules) |
| **Security Teams** | Audit sandbox and VFS logs | High |
| **AI Operators** | Monitor state machine health | High |

### 2.4 Operating Environment

- **Server:** Node.js 18+ LTS
- **Database:** PostgreSQL 14+ with pgvector extension
- **Docker:** Docker Desktop 4.0+ (local) or Docker Engine (production)
- **Client:** Modern browsers (Chrome, Firefox, Safari, Edge)
- **Network:** HTTPS required for production, WebSocket support

### 2.5 Design and Implementation Constraints

1. **ES Modules Only** — No CommonJS (`require`/`module.exports`)
2. **Strict Isolation** — No imports between `org_core/` and `user_env/`
3. **Language Lock** — Only en, hi, or supported
4. **Docker Only** — No cloud deployment allowed (offline requirement)
5. **VFS Gate** — No direct disk writes without user approval
6. **Low Temperature** — LLM calls use 0.2 temperature for determinism

---

## 3. System Features

### 3.1 State Machine Orchestration (F-001)

**Description:** Deterministic agent execution with XState

**Priority:** Critical

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-001.1 | System shall implement 7-state machine: idle → loading_contexts → parsing_ast → drafting_code → sandboxing → evaluating_failure → rollback/success | Critical |
| F-001.2 | System shall track retry count (max 3) before antigravity rollback | Critical |
| F-001.3 | System shall inject SYSTEM OVERRIDE prompt on rollback | High |
| F-001.4 | System shall stream state transitions via WebSocket in real-time | High |
| F-001.5 | System shall halt on fatal_failure state with error logging | Critical |

### 3.2 AST-First Code Analysis (F-002)

**Description:** Deterministic code parsing with tree-sitter

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-002.1 | System shall parse JavaScript/TypeScript files using tree-sitter | Critical |
| F-002.2 | System shall extract exact imports (no fuzzy matching) | Critical |
| F-002.3 | System shall extract exact exports | Critical |
| F-002.4 | System shall extract internal function signatures | High |
| F-002.5 | System shall reject hallucinated dependencies | Critical |

### 3.3 Docker Sandbox Execution (F-003)

**Description:** Isolated, ephemeral code testing

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-003.1 | System shall create Alpine Linux containers for each test | Critical |
| F-003.2 | System shall enforce 10-second timeout to kill infinite loops | Critical |
| F-003.3 | System shall use `--network none` to prevent external calls | Critical |
| F-003.4 | System shall auto-destroy containers after execution (`--rm`) | Critical |
| F-003.5 | System shall capture stdout/stderr for error analysis | High |
| F-003.6 | System shall return structured result: `{ success, output/error_trace }` | High |

### 3.4 Virtual File System (F-004)

**Description:** Staging area with user approval gate

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-004.1 | System shall stage verified code in memory (not disk) | Critical |
| F-004.2 | System shall preserve original content for diff comparison | Critical |
| F-004.3 | System shall broadcast staged files via WebSocket | High |
| F-004.4 | System shall require explicit user approval before disk write | Critical |
| F-004.5 | System shall support rejection (drop from VFS, no disk touch) | Critical |
| F-004.6 | System shall track audit trail: timestamps, retries, decisions | High |
| F-004.7 | System shall expose `/api/fs/commit` endpoint for approved writes | Critical |

### 3.5 LLM Integration (F-005)

**Description:** Structured prompt generation and API calls

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-005.1 | System shall build system prompts with org constraints | Critical |
| F-005.2 | System shall build user prompts with user preferences | Critical |
| F-005.3 | System shall build task prompts with AST graph | Critical |
| F-005.4 | System shall inject antigravity feedback on sandbox errors | High |
| F-005.5 | System shall support multiple LLM providers (Gemini, OpenAI, Anthropic) | Medium |
| F-005.6 | System shall strip markdown code blocks from responses | High |
| F-005.7 | System shall use temperature 0.2 for deterministic output | High |

### 3.6 WebSocket Communication (F-006)

**Description:** Real-time frontend-backend streaming

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-006.1 | System shall support Socket.io alongside existing WebSocket | High |
| F-006.2 | System shall emit `agent_status` events on state transitions | Critical |
| F-006.3 | System shall emit `file_staged` events on VFS staging | Critical |
| F-006.4 | System shall require `socketId` in API requests for tracking | High |
| F-006.5 | System shall support room-based messaging (user isolation) | Medium |

### 3.7 Context Isolation (F-007)

**Description:** Strict separation of org and user contexts

**Functional Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| F-007.1 | System shall enforce `org_core/` for organizational constraints | Critical |
| F-007.2 | System shall enforce `user_env/` for user preferences | Critical |
| F-007.3 | System shall prevent cross-imports between layers | Critical |
| F-007.4 | System shall enforce language lock (en, hi, or) | Critical |
| F-007.5 | System shall enforce deployment lock (local_docker_only) | Critical |
| F-007.6 | System shall prioritize org constraints over user prefs on conflict | Critical |

---

## 4. External Interface Requirements

### 4.1 User Interfaces

**DiffViewer Component:**
- Side-by-side diff view (original vs proposed)
- "Reject" and "Approve & Write" buttons
- File path display
- Metadata display (retries, sandbox status)
- Syntax highlighting (Material 3 dark theme)

**Terminal Component:**
- Real-time log streaming
- Agent status messages
- GitHub Action status integration
- Output stream display

**Activity Feed:**
- Orchestration progress
- State transitions
- Retry notifications
- Rollback alerts

### 4.2 Hardware Interfaces

None (browser-based application)

### 4.3 Software Interfaces

**Backend APIs:**

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/code` | POST | Initiate agent orchestration | Required |
| `/api/fs/commit` | POST | Commit approved VFS changes | Required |
| `/api/fs/pending` | GET | Get pending VFS files | Required |
| `/api/fs/stats` | GET | Get VFS statistics | Required |
| `/api/auth/google` | GET | Google OAuth | - |
| `/api/auth/github` | GET | GitHub OAuth | - |
| `/health` | GET | Health check | - |

**WebSocket Events:**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `agent_status` | Server → Client | `{ status, message, retries }` | State transition |
| `file_staged` | Server → Client | `{ filePath, original, proposed, metadata }` | VFS staging |
| `join` | Client → Server | `{ userId }` | Join user room |

### 4.4 Communications Interfaces

- **HTTP/HTTPS:** REST API calls
- **WebSocket:** Real-time bidirectional (Socket.io)
- **Database:** PostgreSQL TCP/IP
- **Docker:** Docker Engine API (local socket)

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NF-001 | State machine transitions | < 100ms |
| NF-002 | AST parsing (average file) | < 500ms |
| NF-003 | Docker sandbox execution | < 10s (timeout) |
| NF-004 | LLM API response | < 30s |
| NF-005 | WebSocket latency | < 50ms |
| NF-006 | Concurrent user sessions | 100+ |

### 5.2 Safety Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-007 | No auto-disk-write without approval | Critical |
| NF-008 | Sandbox network isolation (`--network none`) | Critical |
| NF-009 | Sandbox resource limits (CPU, memory) | High |
| NF-010 | Input sanitization (path traversal prevention) | Critical |

### 5.3 Security Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-011 | JWT token authentication | Critical |
| NF-012 | HTTPS in production | Critical |
| NF-013 | Environment variable injection (no hardcoded secrets) | Critical |
| NF-014 | CORS configuration (restrict to UI origin) | High |
| NF-015 | Docker container isolation | Critical |
| NF-016 | File path validation before disk writes | Critical |

### 5.4 Software Quality Attributes

| Attribute | Requirement | Measurement |
|-----------|-------------|-------------|
| **Availability** | 99.5% uptime | Monitoring |
| **Maintainability** | Modular architecture | Code review |
| **Portability** | Docker containerization | Deployment test |
| **Scalability** | Horizontal scaling ready | Load test |
| **Testability** | Unit + integration tests | Coverage > 80% |
| **Usability** | Clear diff visualization | User feedback |

---

## 6. Architecture Requirements

### 6.1 Design Patterns

1. **State Machine Pattern** — XState for deterministic orchestration
2. **Singleton Pattern** — VFS, LLM clients, database pools
3. **Observer Pattern** — EventEmitter for VFS, WebSocket streaming
4. **Repository Pattern** — Database abstraction
5. **Adapter Pattern** — LLM provider abstraction

### 6.2 Module Structure

```
apps/server-bridge/
├── org_core/           [IMMUTABLE - No external deps]
├── user_env/           [FLEXIBLE - No external deps]
├── orchestrator/       [INTEGRATION - Can import both]
├── memory/             [DATA ACCESS]
├── sandbox/            [ISOLATION]
├── vfs/                [STAGING]
└── auth/               [SECURITY]
```

### 6.3 State Machine Specification

```javascript
// States
idle → loading_contexts → parsing_ast → drafting_code → sandboxing
                                              ↑              ↓
                                              └── rollback ←─┘
                                                    ↓ (retries >= 3)
                                              evaluating_failure

// Transitions
START_TASK: idle → loading_contexts
fetchIsolatedContexts success: loading_contexts → parsing_ast
fetchIsolatedContexts error: loading_contexts → fatal_failure

buildSemanticGraph success: parsing_ast → drafting_code
buildSemanticGraph error: parsing_ast → fatal_failure

generateLLMCode success: drafting_code → sandboxing
generateLLMCode error: drafting_code → rollback

executeLocalDockerSandbox success: sandboxing → success
executeLocalDockerSandbox error: sandboxing → evaluating_failure

// Evaluating Failure (always transitions)
retries < maxRetries: evaluating_failure → drafting_code (+ increment retries)
retries >= maxRetries: evaluating_failure → rollback

// Rollback (always transitions)
rollback → drafting_code (reset retries, inject override prompt)

// Terminal States
success: final (stage in VFS)
fatal_failure: final (halt with error)
```

---

## 7. Data Requirements

### 7.1 Database Schema

**Tables:**

```sql
-- Users
users (id, email, name, created_at, updated_at)

-- Projects
projects (id, user_id, name, description, created_at)

-- Project Memory
project_memory (
  id, 
  user_id, 
  project_name, 
  user_memory (text), 
  brain_journal (jsonb),
  updated_at
)

-- Semantic Memory (vector search)
semantic_memory (
  id,
  user_id,
  project_name,
  content (jsonb),
  embedding (vector),
  created_at
)

-- AST Graphs
ast_graphs (
  id,
  project_name,
  file_path,
  graph_data (jsonb),
  indexed_at
)

-- GitHub Installations
github_installations (id, user_id, installation_id, account)

-- Sessions
sessions (id, user_id, token, expires_at)
```

### 7.2 Data Retention

- **Brain Journal:** Auto-compact at 100 entries, keep 50 most recent
- **Semantic Memory:** No auto-deletion (manual cleanup)
- **AST Graphs:** Refresh on file change
- **VFS Staging:** 24-hour TTL for non-pending entries

### 7.3 Backup Requirements

- **Database:** Daily automated backups
- **VFS Staging:** No backup (ephemeral, user must approve/commit)

---

## 8. Security Requirements

### 8.1 Authentication

- JWT tokens with expiration
- OAuth 2.0 (Google, GitHub)
- Token refresh mechanism

### 8.2 Authorization

- Role-based access control (future)
- User-isolated data (all queries filtered by user_id)
- Org constraint enforcement (non-negotiable rules)

### 8.3 Input Validation

| Input Type | Validation |
|------------|------------|
| File paths | Path traversal prevention, whitelist directories |
| Code content | Size limits (5MB max), syntax validation |
| API payloads | Schema validation, SQL injection prevention |
| User prompts | Length limits, content filtering |

### 8.4 Secure Execution

- **Docker Isolation:** No network, resource limits, ephemeral
- **Filesystem:** VFS staging, no direct disk writes
- **Secrets:** Environment variables only, no logging

### 8.5 Audit Logging

- State machine transitions
- VFS decisions (approve/reject)
- Disk writes (commit endpoint)
- Authentication events
- Errors and failures

---

## Appendix A: Glossary

- **Antigravity:** The rollback mechanism that forces a new architectural approach after 3 failed attempts
- **Deterministic:** Producing the same output given the same input (no randomness)
- **Ephemeral:** Short-lived, destroyed after use (Docker containers)
- **Hallucination:** AI generating false or non-existent information
- **Orchestration:** Coordinated management of multiple components
- **Staging:** Holding area before final commit (VFS concept)

## Appendix B: References

1. XState Documentation: https://xstate.js.org/
2. Tree-sitter Documentation: https://tree-sitter.github.io/
3. Socket.io Documentation: https://socket.io/
4. Material 3 Design: https://m3.material.io/
5. Docker Security: https://docs.docker.com/engine/security/

## Appendix C: Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-05-04 | Vibe-Hub Team | Initial SRS for V6 Architecture |

---

**End of SRS Document**
