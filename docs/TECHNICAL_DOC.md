# Technical Documentation — Vibe Hub v4.0 (Neural Protocol)

## 1. Monorepo Architecture
Vibe Hub is a consolidated monorepo using **NPM Workspaces**.

- `apps/server-bridge`: The **Secure Brain**. Handles LLM orchestration, PostgreSQL persistence, and OAuth.
- `apps/user-interface`: The **Neural Cockpit**. Handles the PWA shell, WebContainer virtualization, and Agent visualization.
- `docs/`: Centralized specification and technical standards.

---

## 2. Neural State Protocol (WebSocket)
The Brain and Cockpit communicate via a real-time, event-driven protocol using `Socket.io`.

### 2.1 Event: `state_change`
Emitted by the server during the agentic ReAct loop to provide high-fidelity status feedback.

**Structure:**
```json
{
  "state": "thinking" | "reading" | "writing" | "debugging" | "verifying" | "idle",
  "message": "Reasoning about component structure..."
}
```

### 2.2 Mental States Lifecycle
1. **Handshake**: Client connects with JWT token.
2. **Pre-Scan**: Brain scans the VFS for architecture mapping (`reading`).
3. **Execution**: Agent iterates via ReAct loop (`thinking`, `reading`, `writing`).
4. **Self-Correction**: Brain runs builds and parses logs if errors occur (`debugging`).
5. **Verification**: Final build pass to ensure integrity (`verifying`).

---

## 3. Mixture-of-Experts (MoE) Routing
The `Router` class implements a hybrid classification strategy to minimize latency.

- **Level 1 (Regex)**: Zero-latency matching against domain-specific keywords (e.g., `git`, `color`, `index.css`).
- **Level 2 (Micro-LLM)**: If L1 misses, a specialized 1-shot micro-prompt classifies the intent via Gemini 1.5 Flash.

### Domain Experts:
- **CodeExpert**: Logic, data structures, and refactoring.
- **UIExpert**: CSS, Tailwind, Layout, and Motion.
- **DebuggerExpert**: Log parsing and root-cause analysis.
- **GitExpert**: Version control and repo state.

---

## 4. Surgical Edit Engine
The platform eschews full-file overwrites in favor of **Surgical Diffs**.

### 4.1 `edit_file` Tool
Used for modifying existing files. Requires a `search` block (context) and a `replace` block (delta).
- Forces agents to read the file first to build valid search blocks.
- Reduces bandwidth and token cost for large files.
- Minimizes merge conflicts in the virtual OS.

---

## 5. Security & Isolation
- **WebContainer**: Runs code in a WebAssembly-based sandbox inside the browser.
- **Vibe Bridge**: All Gemini API traffic is proxied through the server. No client-side `import.meta.env.VITE_GEMINI_KEY`.
- **JWT Auth**: Ensures only authenticated users can trigger neural loops.

---

## 6. Development Workflow
1. **Clone & Install**: `npm install` at root.
2. **Environment**: Set up `apps/server-bridge/.env`.
3. **Run**: `npm run dev` to start both bridge and UI.
4. **Deploy**: Push to `main` to trigger the Render Blueprint rollout.
