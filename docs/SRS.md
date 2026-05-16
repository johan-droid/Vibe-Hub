# Software Requirements Specification (SRS)

**Vibe-Hub: SaaS-Grade Agentic Coding Platform**  
**Version:** 6.1 Production Release  
**Date:** 2026-05-07  
**Status:** Production Ready  
**AI Agent Focus:** Enhanced for AI agent development workflows and vibecoding capabilities

---

## AI Agent Quick Reference

**Essential Commands for AI Agents:**
```bash
# Start development environment
npm run dev

# Validate syntax after changes
node --check <file>

# Run comprehensive tests
npm run test

# Check code quality
npm run lint

# Build for production
npm run build
```

**Critical Architecture Rules for AI Agents:**
- ✅ Always use ES modules (`import`/`export`)
- ✅ Include `.js` extensions in relative imports
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Use Docker sandbox for all code execution
- ✅ Follow V6 isolation principles
- ✅ Enforce language lock (en/hi/or only)

**AI Agent Development Tools:**
- `multi_edit` for coordinated file changes
- `grep_search` for pattern finding
- `find_by_name` for file discovery
- `node --check` for syntax validation
- `read_file` for code analysis

## Current Implementation Snapshot

- Current server routes are registered in `apps/server-bridge/index.js`.
- The orchestration entrypoint is `apps/server-bridge/orchestrator/state_machine.js`.
- Approval-gated writes are implemented in `apps/server-bridge/vfs/container.js`.
- Current API families include `/api/code`, `/api/fs/*`, `/api/v6/chat/*`, `/api/v6/preferences/*`, `/api/v6/mcp/*`, and `/api/auth/*`.
- The UI workspace is organized under `apps/user-interface/src/features/`.

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

This SRS defines complete technical and functional requirements for Vibe-Hub, a SaaS-grade agentic coding platform specifically designed for AI agent development workflows. The system provides comprehensive tools and documentation for effective vibecoding sessions without requiring full codebase uploads, enabling AI agents to work efficiently with the codebase while maintaining strict security and architectural boundaries.

### 1.2 Intended Audience

- **AI Agents**: Primary users for vibecoding workflows
- **Software architects and engineers**: System design and implementation
- **DevOps and security teams**: Deployment and security oversight
- **Frontend developers**: React/UI development
- **Backend developers**: Node.js/API development
- **QA and testing teams**: Quality assurance and testing

### 1.3 Product Scope

Vibe-Hub provides an AI-powered coding assistant with the following differentiators:
- **AI Agent Development Focus**: Comprehensive tools and documentation for AI agents
- **Deterministic execution**: XState state machines with rollback capabilities
- **AST-first code analysis**: Tree-sitter deterministic parsing eliminates hallucinations
- **Offline Docker sandboxing**: Prevents malicious code execution
- **Virtual File System**: User approval gates prevent unwanted disk writes
- **Strict architectural isolation**: Organization vs user context separation
- **Real-time WebSocket streaming**: Live visibility into agent reasoning
- **Multi-language support**: English, Hindi, Odia (language lock enforced)
- **GitHub Integration**: Conflict-safe PR creation and workflow monitoring

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
│  - Docker Executor (ephemeral containers + resource limits) │
│  - VFS (virtual file system + audit logging)               │
│  - LLM Client (Gemini/OpenAI/Anthropic)                   │
│  - Security (Helmet, rate limiting, Zod validation)        │
│  - Logging (Winston structured + request tracing)           │
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
3. **Sandbox Testing** — Execute code in isolated GitHub Actions runners
4. **Rollback Handling** — Retry failed attempts, pivot after 3 failures
5. **User Approval** — Stage changes in VFS, require explicit approval
6. **Real-time Streaming** — WebSocket updates during orchestration
7. **Multi-language Support** — English, Hindi, Odia (locked)
8. **GitHub Integration** — PR creation, workflow monitoring
9. **Security Hardening** — Helmet headers, rate limiting, XSS protection
10. **Audit Logging** — Structured logs with request ID tracing

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
- **Execution:** GitHub Actions runner
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

### 3.1 AI Agent Development Requirements (F-008)

**Description:** AI agent development workflow and vibecoding capabilities

**Priority:** Critical

**Functional Requirements:**

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| F-008.1 | System shall provide multi-file coordination tools for AI agents | Critical | Tool testing |
| F-008.2 | System shall support pattern recognition for architectural analysis | High | Pattern detection tests |
| F-008.3 | System shall provide real-time syntax validation for AI agents | Critical | Syntax checking tests |
| F-008.4 | System shall support semantic search across codebase | High | Search functionality tests |
| F-008.5 | System shall maintain persistent context across AI agent sessions | Medium | Session management tests |
| F-008.6 | System shall provide comprehensive AI agent documentation | Critical | Documentation review |
| F-008.7 | System shall support memory persistence for AI agent learning | Medium | Memory system tests |
| F-008.8 | System shall provide security review capabilities for AI agents | High | Security analysis tests |
| F-008.9 | System shall support performance analysis and optimization | Medium | Performance monitoring |

### 3.2 AI Agent Tool Integration (F-009)

**Description:** Integration of AI agent development tools

**Priority:** High

**Functional Requirements:**

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| F-009.1 | System shall provide `multi_edit` tool for coordinated file changes | Critical | Multi-edit functionality |
| F-009.2 | System shall provide `grep_search` tool for pattern finding | Critical | Search functionality |
| F-009.3 | System shall provide `find_by_name` tool for file discovery | Critical | File navigation |
| F-009.4 | System shall provide `node --check` integration for syntax validation | Critical | Syntax validation |
| F-009.5 | System shall provide `read_file` tool for code analysis | Critical | File reading |
| F-009.6 | System shall provide `list_dir` tool for directory exploration | High | Directory listing |
| F-009.7 | System shall provide error recovery and rollback mechanisms | High | Error handling |

### 3.3 AI Agent Context Management (F-010)

**Description:** Context management and persistence for AI agents

**Priority:** High

**Functional Requirements:**

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| F-010.1 | System shall maintain AI agent context across development sessions | Critical | Session persistence |
| F-010.2 | System shall provide context isolation between different AI agents | High | Multi-agent support |
| F-010.3 | System shall support context injection from org_core and user_env | Critical | Context builder |
| F-010.4 | System shall provide context validation and sanitization | High | Security validation |
| F-010.5 | System shall support context rollback and recovery | Medium | Error recovery |
| F-010.6 | System shall provide context audit logging | High | Audit trail |

### 3.4 AI Agent Security and Validation (F-011)

**Description:** Security measures specifically for AI agent operations

**Priority:** Critical

**Functional Requirements:**

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| F-011.1 | System shall validate all AI agent inputs and operations | Critical | Input validation |
| F-011.2 | System shall prevent AI agents from bypassing VFS approval gates | Critical | VFS security |
| F-011.3 | System shall enforce V6 architectural isolation for AI agents | Critical | Architecture enforcement |
| F-011.4 | System shall monitor AI agent operations for security violations | High | Security monitoring |
| F-011.5 | System shall provide AI agent operation audit trails | Critical | Audit logging |
| F-011.6 | System shall enforce language lock (en/hi/or) for AI agents | Critical | Language enforcement |
| F-011.7 | System shall prevent AI agents from accessing sensitive system resources | High | Resource protection |

### 3.5 State Machine Orchestration (F-001)

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
- **Execution:** GitHub REST API

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
| NF-008 | GitHub Actions isolation | Critical |
| NF-009 | GitHub Actions runner limits | High |
| NF-010 | Input sanitization (path traversal prevention) | Critical |
| NF-011 | Helmet.js security headers (CSP, HSTS, X-Frame-Options) | High |
| NF-012 | Rate limiting (100/15min general, 30/min API, 5/min LLM) | High |
| NF-013 | Zod input validation schemas | High |
| NF-014 | XSS protection middleware | High |
| NF-015 | Attack monitoring and logging | Medium |

### 5.3 Security Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-016 | JWT token authentication | Critical |
| NF-017 | HTTPS in production | Critical |
| NF-018 | Environment variable injection (no hardcoded secrets) | Critical |
| NF-019 | CORS configuration (restrict to UI origin) | High |
| NF-020 | Docker container isolation (--network none, --read-only) | Critical |
| NF-021 | File path validation before disk writes | Critical |
| NF-022 | Request ID tracing for audit logs | High |
| NF-023 | Structured JSON logging (Winston) | High |
| NF-024 | Error sanitization in production (no stack traces) | High |
| NF-025 | VFS audit logging (stage, approve, reject, commit) | High |

### 5.4 Software Quality Attributes

| Attribute | Requirement | Measurement |
|-----------|-------------|-------------|
| **Availability** | 99.5% uptime | Monitoring |
| **Maintainability** | Modular architecture | Code review |
| **Portability** | GitHub Actions / Render Hybrid | Deployment test |
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
├── sandbox/            [ISOLATION - GitHub Actions + resource limits]
├── vfs/                [STAGING - Audit logging]
├── auth/               [SECURITY]
├── utils/              [UTILITIES - Logging, validation, security]
│   ├── logger.js       [Winston structured logging]
│   ├── validation.js   [Zod schemas]
│   └── security.js     [XSS protection, attack monitoring]
└── test/               [TESTING - Vitest suite]
    ├── state-machine.test.js
    ├── vfs.test.js
    └── api.test.js
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

triggerGitHubActionSandbox success: sandboxing → success
triggerGitHubActionSandbox error: sandboxing → evaluating_failure

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

- **GitHub Actions Isolation:** No network, resource limits, ephemeral
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
- **Ephemeral:** Short-lived, destroyed after use (GitHub Actions runners)
- **Hallucination:** AI generating false or non-existent information
- **Orchestration:** Coordinated management of multiple components
- **Staging:** Holding area before final commit (VFS concept)

## Appendix B: References

1. XState Documentation: https://xstate.js.org/
2. Tree-sitter Documentation: https://tree-sitter.github.io/
3. Socket.io Documentation: https://socket.io/
4. Material 3 Design: https://m3.material.io/
5. GitHub Actions Security: https://docs.github.com/en/actions/security-guides

## Appendix C: Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-05-04 | Vibe-Hub Team | Initial SRS for V6 Architecture |

---

**End of SRS Document**
