# Three-Tier State Persistence Architecture

## Overview

Vibe-Hub divides state into three tiers of persistence, all orchestrated around the auth system. This document defines what survives logout/browser close and what resets.

---

## 1. Fully Persistent (Survives Logout & Offline)

These are backed by **PostgreSQL/Redis** and retained indefinitely until explicitly deleted. They are **re-hydrated** when the user logs back in.

| Component | Storage | Behaviour After Logout/Offline |
|-----------|---------|--------------------------------|
| **User profile & preferences** | PostgreSQL (`user_env` data, language, aesthetic, LLM provider) | Retrieved from DB when a new JWT is issued. UI immediately reflects the user's saved settings. |
| **Pending VFS reviews** | Redis (backed by Pub/Sub) with 24h TTL | Files staged by a previous session remain in the staged list. The user can approve/reject them as soon as they re-authenticate. The approval gate is session-agnostic. |
| **Audit logs (stage, approve, commit, errors)** | PostgreSQL `audit_logs` table | Ever-growing; accessible via an API for compliance. No data loss. |
| **Project structure / file tree** | PostgreSQL `projects`, `files` | The workspace file explorer will reload the same files. |
| **Semantic memory (pgvector)** | PostgreSQL | Persisted vectors for code search, unaffected by auth state. |
| **GitHub installation data** | PostgreSQL | Ties user to GitHub repos; survives relogin. |
| **User sessions & auth history** | PostgreSQL `user_sessions`, `login_audit_log` | SaaS-grade session tracking with device fingerprints and audit trails. |

**Key point:** All these are tied to the **user ID**, not the session token. Once a new token is obtained, the frontend fetches fresh data.

---

## 2. Session-Resilient (Survives Logout if Re-login Within Time Window)

These rely on **short-lived state** (localStorage) that can outlast an individual HTTP session.

| Component | Storage | TTL | Behaviour |
|-----------|---------|-----|-----------|
| **Active orchestration jobs** | `last_job_id` in localStorage | 24h | The job continues on the backend (BullMQ) even if the user disconnects. If the user logs back in before the job finishes (or within 24h), they can reconnect to the WebSocket room and resume watching progress. |
| **Panel states** | `panel_states` in localStorage | 7 days | Sidebar, chat, terminal open/closed states and sizes are restored on login. |
| **Draft prompt input** | `draft_prompt` in localStorage | 7 days | Unsubmitted prompt text survives logout. |
| **Terminal filters** | `terminal_filters` in localStorage | No TTL | Filter level settings persist. |
| **WebSocket correlation** | Redis adapter keeps rooms alive; frontend can rejoin with `userId` | Server lifetime | The room exists server-side as long as the server is running. Re-joining after re-auth will stream the latest `agent_status`. |
| **VFS staged file events** | Redis Pub/Sub queue | 24h | Any `file_staged` event emitted while the user was offline will not be resent, but the file is still in Redis; a fresh `GET /api/fs/pending` will show it. |

---

## 3. Ephemeral / Resets on Logout

These are **in-memory only** and intentionally cleared for security or practicality.

| Component | Behaviour |
|-----------|-----------|
| **JWT access token** | 15-minute expiry; stored in memory/cookie. On logout or browser close, cleared. |
| **Refresh token** | 90-day expiry; HTTP-only cookie. Cleared on explicit logout. |
| **Session token** | 30-day expiry; identifies the device session. Cleared on explicit logout. |
| **Current agent state (Zustand store)** | `useAgentStore` holds live status, message, retries. It resets on page unload. This is fine because it's only a temporary view of the backend's actual state. |
| **Terminal output buffer** | Cleared unless you explicitly persist the last N lines to localStorage (optional). |
| **WebSocket connection** | Drops on logout/disconnect. Re-established after login. |
| **CSRF token** | Per-session; regenerated on login. |

---

## Frontend Implementation

### localStorage Keys (with `vibe_hub_` prefix)

**Tier 2 Keys (Session-Resilient):**
- `last_job_id` - Last submitted job for resumption (24h TTL)
- `panel_states` - Sidebar, chat, terminal open/closed
- `terminal_filters` - Filter level settings
- `draft_prompt` - Unsubmitted prompt text (7d TTL)

**Tier 3 Keys (Ephemeral):**
- `selina_access_token` - JWT access token
- `selina_refresh_token` - Refresh token
- `selina_session_token` - Session identifier
- `csrf_token` - CSRF protection token

### Logout Flow

```javascript
// Tier 3 cleanup: Clear auth tokens but preserve Tier 1 & 2
performLogoutCleanup();
```

- Clears: Auth tokens, CSRF tokens, temporary agent state
- Preserves: lastJobId, panel states, terminal filters, draft prompts

### Login Flow

```javascript
// 1. Clear expired Tier 2 items
clearExpiredTier2();

// 2. Restore panel states
restorePanelStates();

// 3. Check for pending job resumption
useJobResumption(); // Checks last_job_id, queries /api/code/jobs/:id

// 4. Fetch pending VFS files
GET /api/fs/pending

// 5. Establish WebSocket connection
```

---

## Backend API Endpoints

### Job Resumption
- `GET /api/code/jobs/:jobId` - Get job status for resumption

### Auth Management
- `POST /api/auth/logout` - Logout current session (preserves localStorage Tier 2)
- `POST /api/auth/logout-all` - Logout all sessions
- `GET /api/auth/sessions` - List active sessions
- `POST /api/auth/sessions/:id/revoke` - Revoke specific session
- `GET /api/auth/history` - Login audit history

### VFS Persistence
- `GET /api/fs/pending` - List staged files waiting for approval

---

## Summary

**What stays synced with your auth system even after logout/offline?**

- **User identity & preferences** (always reloaded on login)
- **Pending code reviews** (they wait for you in the VFS, like a pull request)
- **Past audit trails & project history**
- **Active backend jobs** (they keep running; you can catch up within 24h)
- **Panel layout** (your workspace looks the same when you return)

Vibe-Hub acts like a **persistent, session-independent platform**: you can log out, come back tomorrow, and your staged changes are still waiting for your approval. Nothing is lost. The auth system simply gives you the key to re-enter your own workspace.
