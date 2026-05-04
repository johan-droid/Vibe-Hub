# Vibe-Hub: AI-Powered Agentic Coding Platform

**System Specification Document**  
**Version:** 6.1 Production Release  
**Document Classification:** Technical Reference  
**Citation Format:** IEEE 830-1998 / ISO/IEC 25010:2011

---

## Abstract

Vibe-Hub is a production-grade agentic coding platform that combines deterministic state machine orchestration, abstract syntax tree analysis, and secure containerized execution to provide AI-assisted software development with human-in-the-loop oversight. The system implements a novel Virtual File System (VFS) that prevents autonomous disk writes, requiring explicit user approval for all code modifications. This document provides comprehensive technical specifications, architecture details, and operational guidelines for the Vibe-Hub platform.

**Keywords:** Agentic AI, Code Generation, State Machines, XState, Docker Sandboxing, Virtual File System, AST Analysis, LLM Orchestration

---

## 1. System Overview

### 1.1 Purpose and Scope

Vibe-Hub addresses the critical challenge of trust in AI-generated code by implementing a multi-layered safety architecture that combines:

1. **Deterministic Orchestration:** XState-based state machines ensure reproducible execution paths
2. **Sandboxed Execution:** Docker containers with resource constraints execute untrusted code
3. **Human Approval Gates:** VFS staging prevents automatic disk modifications
4. **Audit Logging:** Complete traceability of all system actions

The platform targets software developers seeking AI assistance while maintaining full control over code quality and security.

### 1.2 System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STAKEHOLDER ECOSYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DEVELOPERS ───────┐                                                       │
│   (End Users)       │    ┌──────────────┐                                   │
│   • Write prompts    │    │              │                                   │
│   • Review diffs     │◄───┤   VIBE-HUB   │◄────┐                            │
│   • Approve changes  │    │   PLATFORM   │     │                            │
│                      │    │              │     │                            │
│   ORG ADMINS ────────┤    └──────────────┘     │                            │
│   • Configure CI/CD  │            │            │                            │
│   • Set constraints  │            ▼            │                            │
│                      │    ┌──────────────┐     │                            │
│   AI OPERATORS ──────┤    │   LLM APIs   │     │                            │
│   • Monitor health   │    │  (Gemini,    │     │                            │
│   • Tune prompts     │    │   OpenAI)    │     │                            │
│                      │    └──────────────┘     │                            │
│   SECURITY TEAMS ────┤            ▲            │                            │
│   • Audit logs       │            │            │                            │
│   • Review VFS       └──────────┴────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Document Structure

| Section | Content |
|---------|---------|
| 2 | System Architecture |
| 3 | Functional Requirements |
| 4 | Non-Functional Requirements |
| 5 | Security Architecture |
| 6 | API Specification |
| 7 | Testing & Quality Assurance |
| 8 | Deployment & Operations |
| 9 | References & Standards |

---

## 2. System Architecture

### 2.1 Architectural Style

Vibe-Hub implements a **Layered Architecture** with **Event-Driven** components:

1. **Presentation Layer:** React SPA with real-time WebSocket updates
2. **Application Layer:** Express.js with middleware pipeline
3. **Domain Layer:** XState machines, VFS, Sandbox executor
4. **Infrastructure Layer:** PostgreSQL, Docker, external LLM APIs

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPONENT INTERACTIONS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌─────────────────┐                               │
│  │   React    │◄────────►│   Zustand Store │                               │
│  │   Frontend │  HTTPS   │   (VFS State)   │                               │
│  └──────┬─────┘         └─────────────────┘                               │
│         │                                                                   │
│         │ Socket.io                                                         │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         EXPRESS SERVER                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │   Auth     │  │   Rate     │  │   Helmet   │  │   Zod      │  │  │
│  │  │ Middleware │──►│   Limit    │──►│   CSP      │──►│ Validate   │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                    XSTATE MACHINE                         │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │  │
│  │  │  │  Load    │  │  Parse   │  │  Draft   │  │  Sandbox │  │  │  │
│  │  │  │ Contexts │─►│   AST    │─►│   Code   │─►│   Test   │  │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └─────┬────┘  │  │  │
│  │  │                                                   │       │  │  │
│  │  │              ┌────────────────────────────────────┘       │  │  │
│  │  │              ▼ (on success)                              │  │  │
│  │  │  ┌──────────┐  ┌──────────┐                            │  │  │
│  │  │  │   VFS    │  │  Commit  │                            │  │  │
│  │  │  │  Stage   │─►│  to Disk │                            │  │  │
│  │  │  └──────────┘  └──────────┘                            │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │  │
│  │  │   LLM     │  │   AST     │  │   Docker   │                  │  │
│  │  │  Client   │  │  Parser   │  │  Sandbox   │                  │  │
│  │  └────────────┘  └────────────┘  └────────────┘                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼ SQL                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         POSTGRESQL                                  │  │
│  │  ├─ users, sessions, projects                                       │  │
│  │  ├─ semantic_memory (pgvector)                                    │  │
│  │  └─ audit_logs (JSONB)                                             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

**Normal Flow (Success):**
```
User Prompt → State Machine → Load Contexts → Parse AST → LLM Call → 
Sandbox Test → VFS Stage → User Approval → Disk Commit → Success
```

**Failure Flow (Retry):**
```
Sandbox Error → Evaluate Failure → Retry (retries < 3) → 
LLM Call with Error Context → Sandbox Test
```

**Rollback Flow (Max Retries):**
```
Sandbox Error (retries = 3) → Reset Context → Inject Error Prompt → 
Fresh LLM Call → Continue Normal Flow
```

---

## 3. Functional Requirements

### 3.1 Core Functions

| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| F-001 | Accept natural language code generation prompts | Critical | User testing |
| F-002 | Generate code via LLM with context injection | Critical | Unit tests |
| F-003 | Execute generated code in Docker sandbox | Critical | Integration tests |
| F-004 | Stage successful code in VFS for review | Critical | E2E tests |
| F-005 | Display code diffs with original content | Critical | UI review |
| F-006 | Accept user approval/rejection of changes | Critical | Click testing |
| F-007 | Commit approved changes to disk | Critical | File system tests |
| F-008 | Retry failed attempts (max 3) | High | State machine tests |
| F-009 | Trigger rollback after max retries | High | State machine tests |
| F-010 | Stream status updates via WebSocket | High | Socket.io tests |
| F-011 | Support multiple programming languages | Medium | AST parser tests |
| F-012 | Parse AST to understand dependencies | High | Tree-sitter tests |

### 3.2 State Machine Functions

**States and Transitions:**

| State | Entry Action | Exit Condition | Exit Action |
|-------|-------------|----------------|-------------|
| `idle` | - | `START_TASK` | Store task context |
| `loading_contexts` | Load org/user contexts | Success | - |
| `parsing_ast` | Parse target file AST | Success | Store AST graph |
| `drafting_code` | Call LLM with prompts | Success | Store generated code |
| `sandboxing` | Execute in Docker | Success | Mark verified |
| `evaluating_failure` | Analyze error | `retries < 3` | Increment retry |
| `rollback` | Reset state | Always | Inject error context |
| `success` | Stage in VFS | - | Emit completion |
| `fatal_failure` | Log error | - | Notify user |

### 3.3 VFS Functions

**Operations:**

| Operation | Pre-condition | Post-condition | Side Effects |
|-----------|--------------|----------------|--------------|
| `stageFile()` | Code passed sandbox | File in `pending_review` | Emit `file_staged` |
| `approveFile()` | Status is `pending_review` | Status `approved` | Emit `file_approved` |
| `rejectFile()` | Status is `pending_review` | Status `rejected` | Emit `file_rejected` |
| `commitToDisk()` | Status is `approved` | Status `committed` | Write to filesystem |

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NF-001 | LLM response time | < 30s | API latency |
| NF-002 | Sandbox execution | < 10s | Docker runtime |
| NF-003 | WebSocket latency | < 50ms | Round-trip time |
| NF-004 | Concurrent sessions | 100+ | Load testing |
| NF-005 | API response time | < 200ms | p95 latency |

### 4.2 Safety Requirements

| ID | Requirement | Priority | Implementation |
|----|-------------|----------|----------------|
| NF-006 | No auto-disk-write | Critical | VFS approval gate |
| NF-007 | Sandbox network isolation | Critical | `--network none` |
| NF-008 | Resource limits (256MB/0.5CPU/50PID) | High | Docker flags |
| NF-009 | Input sanitization | Critical | Zod validation |
| NF-010 | XSS protection | High | Helmet CSP + middleware |
| NF-011 | Rate limiting | High | express-rate-limit |
| NF-012 | Helmet security headers | High | CSP, HSTS, X-Frame |

### 4.3 Security Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-013 | JWT authentication | Critical |
| NF-014 | HTTPS in production | Critical |
| NF-015 | No hardcoded secrets | Critical |
| NF-016 | CORS origin restriction | High |
| NF-017 | Docker container isolation | Critical |
| NF-018 | Path validation before writes | Critical |
| NF-019 | Request ID tracing | High |
| NF-020 | Structured JSON logging | High |
| NF-021 | Error sanitization (prod) | High |
| NF-022 | VFS audit logging | High |

### 4.4 Quality Attributes

| Attribute | Requirement | Measurement |
|-----------|-------------|-------------|
| **Availability** | 99.5% uptime | Monitoring dashboard |
| **Maintainability** | Modular architecture | Code review score |
| **Portability** | Docker containerization | Deployment test |
| **Scalability** | Horizontal ready | Load test |
| **Testability** | > 80% coverage | Coverage report |
| **Usability** | Clear diff visualization | User feedback |

---

## 5. Security Architecture

### 5.1 Threat Model

| Threat | Vector | Control | Residual Risk |
|--------|--------|---------|---------------|
| Prompt Injection | Malicious user input | Zod validation | Low |
| Code Injection | LLM generates malware | Sandbox isolation | Low |
| Path Traversal | `../../../etc/passwd` | Path validation | Negligible |
| XSS | Script in diff viewer | CSP + sanitization | Low |
| DoS | Request flood | Rate limiting | Low |
| Data Exfiltration | Network from sandbox | `--network none` | Negligible |
| Privilege Escalation | Container escape | Docker hardening | Low |

### 5.2 Security Layers

```
Layer 7: Application Security
├── Input validation (Zod)
├── XSS protection
└── CSRF tokens

Layer 6: Transport Security
├── TLS 1.3
├── Certificate pinning
└── Secure cookies

Layer 5: API Security
├── Rate limiting
├── JWT validation
└── Scope enforcement

Layer 4: Container Security
├── Rootless containers
├── Seccomp profiles
├── AppArmor/SELinux
└── Read-only filesystems

Layer 3: Network Security
├── VPC isolation
├── Security groups
└── WAF rules

Layer 2: Host Security
├── OS hardening
├── Docker bench
└── Audit logging

Layer 1: Physical Security
├── Cloud provider SLA
├── Data center controls
└── Encryption at rest
```

---

## 6. API Specification

### 6.1 Authentication

**OAuth 2.0 Flow:**
```
┌─────────┐                                    ┌─────────┐
│  User   │──(1) Login───────────────────────►│  Google │
│         │◄──(2) Auth Code──────────────────│  OAuth  │
│         │                                    └────┬────┘
│         │                                         │
│         │──(3) POST /api/auth/google/callback──►│
│         │    { code: "..." }                      │
│         │◄──(4) JWT Token───────────────────────│
│         │    { token: "eyJ..." }                  │
└────┬────┘                                         │
     │                                              │
     │──(5) Authorization: Bearer eyJ... ──────────►│
     │    All subsequent requests                   │
     │                                              │
```

### 6.2 Rate Limiting Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1623456789
Retry-After: 60
```

### 6.3 Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "targetFile", "message": "Path cannot contain .." }
  ],
  "requestId": "req-550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 7. Testing & Quality Assurance

### 7.1 Test Coverage Matrix

| Component | Unit | Integration | E2E | Security |
|-----------|------|-------------|-----|----------|
| State Machine | ✅ | ✅ | ⚠️ | ✅ |
| VFS | ✅ | ✅ | ✅ | ✅ |
| API | ✅ | ✅ | ✅ | ✅ |
| Auth | ✅ | ✅ | ⚠️ | ✅ |
| Sandbox | ⚠️ | ✅ | ⚠️ | ✅ |
| LLM Client | ⚠️ | ✅ | ⚠️ | ⚠️ |
| AST Parser | ⚠️ | ✅ | ⚠️ | ✅ |

### 7.2 Security Testing

**Penetration Test Cases:**
1. Path traversal: `../../../etc/passwd` → 400 Bad Request
2. XSS injection: `<script>alert(1)</script>` → Sanitized
3. SQL injection: `'; DROP TABLE users; --` → Parameterized
4. Rate limit: 31 requests/min → 429 Too Many Requests
5. Invalid JWT: `Authorization: Bearer invalid` → 401 Unauthorized

---

## 8. Deployment & Operations

### 8.1 Infrastructure

```
┌─────────────────────────────────────────┐
│            RENDER.COM                   │
│  ┌─────────────────────────────────┐   │
│  │  Web Service (Node.js 24)       │   │
│  │  ├─ Auto-scaling: 1-3 instances │   │
│  │  ├─ Health checks: /health      │   │
│  │  └─ SSL: Auto-managed            │   │
│  └─────────────────────────────────┘   │
│                  │                       │
│  ┌─────────────────────────────────┐   │
│  │  PostgreSQL 16                  │   │
│  │  ├─ pgvector extension          │   │
│  │  ├─ Automated backups           │   │
│  │  └─ Private networking            │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 8.2 Monitoring

**Metrics:**
- Request latency (p50, p95, p99)
- Error rate (5xx, 4xx)
- LLM API costs
- Docker sandbox execution time
- VFS pending files count

**Alerts:**
- Error rate > 5%
- LLM latency > 60s
- Disk usage > 80%
- Database connections > 80%

---

## 9. References & Standards

### 9.1 Technical Standards

[1] IEEE 830-1998. *IEEE Recommended Practice for Software Requirements Specifications*.

[2] ISO/IEC 25010:2011. *Systems and software engineering — System and software Quality Requirements and Evaluation (SQuaRE)*.

[3] OWASP ASVS 4.0. *Application Security Verification Standard*.

[4] NIST SP 800-204. *Security Strategies for Microservices-based Application Systems*.

### 9.2 Technology References

[5] Khoury, A., Avila, A., Camara, B., & Tihanyi, N. (2023). *How Secure is Code Generated by ChatGPT?* arXiv:2304.09655.

[6] Docker Inc. (2024). *Docker Security Best Practices*. https://docs.docker.com/engine/security/

[7] XState Documentation. (2024). *State Machines and Statecharts*. https://xstate.js.org/docs/

[8] Tree-sitter Documentation. (2024). *Parsing System*. https://tree-sitter.github.io/tree-sitter/

### 9.3 Industry Benchmarks

[9] GitHub Copilot. *AI Pair Programmer*. https://github.com/features/copilot

[10] OpenAI Codex. *Research on LLM Code Generation*. https://openai.com/research

[11] Amazon CodeWhisperer. *AI Code Companion*. https://aws.amazon.com/codewhisperer/

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Document ID** | VH-SPEC-006.1 |
| **Version** | 6.1.0 |
| **Date** | 2026-05-04 |
| **Author** | Vibe-Hub Engineering |
| **Classification** | Technical Reference |
| **Status** | Production Release |
| **Next Review** | 2026-08-04 |

---

**Copyright © 2026 Vibe-Hub. All rights reserved.**

*This document contains proprietary and confidential information. Distribution without written permission is prohibited.*
