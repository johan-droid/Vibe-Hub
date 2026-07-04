# Agent and Developer Rulebook

This rulebook dictates how human developers and AI agents (e.g., Jules, Codex, Claude) must interact with this repository.

## 1. Naming Rules
Consistency in nomenclature is critical for understanding the architecture.
*   **Vibe Hub:** The public product name. Use this when referring to the user-facing workspace.
*   **Selina Core:** The internal orchestration engine and agent framework.
*   **selina-server-bridge:** The specific backend Node.js service.
*   **Do not rename these.** Do not invent new terms like "Brain v7" or "MegaWorkspace".

## 2. Runtime Rules
*   **Read Before Editing:** Always inspect `package.json`, `.env.example`, and the relevant docs in `docs/` before making architectural assumptions.
*   **Surgical Patches:** When modifying large files (like `orchestrator/index.js`), prefer surgical, diff-based patches over complete rewrites to prevent accidental loss of subtle logic (like specific error handlers or timing constraints).
*   **Preserve Validation:** Do not bypass or remove existing schema validation (`zod`) on incoming requests.
*   **VFS Approval Gating:** The Virtual File System (VFS) is intentionally designed to hold changes until the human approves them. **Never** bypass this to write directly to the file system.
*   **Tool Authorization:** Never bypass the tool invocation policies (`authorizeToolCall`).
*   **Session Security:** Do not weaken the HttpOnly cookie architecture. Never move session tokens to `localStorage` or expose them to the browser JavaScript runtime in production.
*   **Secret Safety:** Never store LLM provider API keys in the browser or prefix them with `VITE_`.
*   **Sandbox Enforcement:** Do not execute generated or untrusted code directly on the host machine. Ensure it always routes through the Docker Sandbox.
*   **Fail Loudly:** Do not silence production startup failures. If a required environment variable is missing, crash immediately so it can be fixed.

## 3. Refactor Rules
*   **Separate Concerns:** Keep documentation updates distinct from logic changes.
*   **Update Tests:** If changing the behavior of a function, you must update the corresponding tests.
*   **Database Migrations:** If adding new fields to Postgres, ensure the schema generation scripts and documentation are updated.
*   **Public API Stability:** Maintain backwards compatibility for frontend-facing APIs where possible, or document breaking changes clearly.
*   **Experimental Code:** Document experimental or legacy paths clearly in comments before considering deletion.

## 4. Production Rules
*   **Fail Closed:** If a security or required configuration is missing, default to failing closed (denying access or refusing to start).
*   **Avoid Insecure Fallbacks:** Do not fall back to "allow all" CORS or unauthenticated state if a configuration is missing.
*   **Sanitize Errors:** Ensure that `500 Internal Server Error` responses do not leak stack traces or raw database queries to the client in production.
*   **Protect Control Plane:** Endpoints like `/api/runtime/diagnostics` must remain protected by administrative tokens or strict network controls.

## 5. PR and Commit Rules
When submitting changes:
*   Include a summary of the files changed.
*   State the validation results (e.g., "Ran `npm run validate` and `npm test` successfully").
*   Summarize the risk associated with the change.
*   Provide a brief rollback plan if the change causes issues in production.
