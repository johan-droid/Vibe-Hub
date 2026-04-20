# Software Requirements Specification (SRS) - Vibe Hub v4.0

## 1. Introduction
### 1.1 Purpose
The purpose of this document is to define the requirements for **Vibe Hub**, a neural-agentic coding platform that provides a browser-based IDE powered by a server-side Mixture-of-Experts (MoE) brain.

### 1.2 Neural Scope
Vibe Hub is a **Neural IDE**. It transcends traditional AI extensions by moving the "Thinking" layer to a secure, stateful server-side orchestrator while maintaining client-side "Execution" in a high-performance WebContainer.

---

## 2. Product Functions

### 2.1 Mixture-of-Experts (MoE) Swarm
- **Expert Dispatch**: The system must route user prompts to specialized domain experts (Code, UI, Debug, Git).
- **Consolidated Reasoning**: The orchestrator must build a unified mental context using the **Neural Skills Engine** (core constitution).

### 2.2 Neural State Feedback
- **Mental Visibility**: The system must stream granular agent states (`thinking`, `reading`, `writing`, `verifying`) to the UI via WebSocket.
- **Inner Monologue**: Agents must justify their hypotheses in a hidden thought block before executing tools.

### 2.3 Surgical Code Modification
- **Precision Edits**: Modifications MUST use `edit_file` (search/replace) to maintain maximum file integrity and minimize tokens.
- **Verification Loop**: Every edit must be followed by a `read_file` verification and a build check (if effort level > quick).

### 2.4 Persistent Memory (Neural Journal)
- **Shared Context**: Agents must read a `memory.md` project context at the start of every session.
- **Brain Journal**: Insights learned during debugging (e.g., "React 19 params are promises") must be persisted in PostgreSQL.

---

## 3. System Requirements

### 3.1 Security & Boundaries
- **Zero-Key UI**: No API keys or sensitive credentials may be stored or transmitted to the client.
- **Authenticated States**: Every neural state change must be signed by the Brain's JWT middleware.

### 3.2 Performance
- **Streaming Latency**: WebSocket state changes must appear in the UI under 50ms of server emission.
- **Surgical Delta**: Edits should prioritize minimal line changes to reduce LLM context window pressure.

### 3.3 Platform Deployment (Monorepo)
- **Monorepo Separation**: Backend logic handles LLM/DB, Frontend handles VFS/UI.
- **Environment Parity**: The system must support `.env` files for both root and app-specific contexts.

---

## 4. User Interaction Requirements

### 4.1 Effort Levels
- **Quick**: 1 reasoning pass, core skills only.
- **Standard**: 3 self-correction passes, full domain expertise.
- **Deep**: 5 iterative repair passes, cross-file coherence checks.

### 4.2 Interactive Status
- UI must provide a rolling activity log ("Reading package.json...", "Surgically editing App.jsx...") alongside the agent thought process.
