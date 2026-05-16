# API Specification

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Base URL:** `http://localhost:3001/api`  
**AI Agent Focus:** Enhanced for AI agent integration

---

## AI Agent Quick Reference

**Essential Endpoints for AI Agents:**
- `POST /api/agent/prompt` - Start AI agent task
- `GET /api/agent/status` - Monitor agent state
- `GET /api/vfs/pending` - View staged files
- `POST /api/vfs/commit` - Commit approved changes
- `GET /api/terminal/sessions` - Terminal management

**AI Agent Authentication:**
- Use `Authorization: Bearer <token>` header
- Tokens obtained via OAuth handshake
- Session management via PostgreSQL

**WebSocket Events for AI Agents:**
- `agent_status` - State machine transitions emitted by the orchestrator
- `file_staged` - VFS updates broadcast from the server bridge
- `github_workflow_completed` - GitHub webhook completion signal

---

## Current Route Map

The current server entrypoint exposes these route families:

- Authentication: `/api/auth/*` and the current session lifecycle routes in `apps/server-bridge/auth/routes.js`
- Orchestration: `/api/code`, `/api/v6/code`, and `/api/code/jobs/:jobId`
- VFS: `/api/fs/commit`, `/api/fs/pending`, `/api/fs/stats` and their `/api/v6/*` aliases where present
- Repository management: `/api/v6/repos/link`, `/api/v6/repos/list`
- MCP: `/api/v6/mcp/tools`, `/api/v6/mcp/servers`, `/api/v6/mcp/diagnostics`, `/api/v6/mcp/call`
- Chat: `/api/v6/chat/sessions` and nested message routes
- Preferences: `/api/v6/preferences` and `/api/v6/preferences/bulk`
- GitHub webhook: `/api/github/webhook` and `/api/v6/github/webhook`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Agent Management](#2-agent-management)
3. [Virtual File System](#3-virtual-file-system)
4. [Terminal & Sessions](#4-terminal--sessions)
5. [WebSocket Events](#5-websocket-events)
6. [Error Handling](#6-error-handling)
7. [Rate Limiting](#7-rate-limiting)

---

## 1. Authentication

### 1.1 Google OAuth

The current auth implementation is session-oriented rather than token-demo oriented. The important endpoints are:

- `POST /api/auth/refresh` refreshes access tokens from cookies.
- `POST /api/auth/handoff` exchanges an OAuth handoff code for authenticated cookies and session metadata.
- `GET /api/auth/status` returns a bootstrap-safe status response for the current session.
- `POST /api/auth/logout` revokes the current session.
- `POST /api/auth/logout-all` revokes all sessions for the current user.
- `GET /api/auth/sessions` lists active sessions.
- `POST /api/auth/sessions/:id/revoke` revokes a specific non-current session.
- `GET /api/auth/history` returns the user auth history.

Example bootstrap response:

```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "user_123",
    "email": "dev@example.com",
    "name": "Developer",
    "provider": "google"
  },
  "sessionId": "session_123"
}
```

---

## 2. Agent Management

### 2.1 Agent Orchestration

#### Start Code Run
```http
POST /api/code
POST /api/v6/code
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "prompt": "Create a dark mode toggle component",
  "targetFile": "apps/user-interface/src/features/editor/components/DiffViewer.jsx",
  "socketId": "socket_123",
  "effortLevel": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "code": "...",
    "retries": 0,
    "stagedFile": { "filePath": "..." }
  }
}
```

**Flow:**
1. Request passes auth, readiness, CSRF, idempotency, and schema validation.
2. `apps/server-bridge/orchestrator/state_machine.js` drives the run.
3. `apps/server-bridge/vfs/container.js` stages the result on success.
4. `agent_status` and `file_staged` events stream state to the UI.

#### Check Code Job Status
```http
GET /api/code/jobs/:jobId
GET /api/v6/code/jobs/:jobId
```

This is only available when a queue-backed worker is enabled. If the queue is not configured, the route returns `404`.

---

## 3. Virtual File System

### 3.1 File Management for AI Agents

#### Get Pending Files
```http
GET /api/fs/pending
GET /api/v6/fs/pending
```

The response is the staged file list maintained by the VFS container. Each entry includes the original content, proposed content, metadata, and review status.

#### Commit Approved Changes
```http
POST /api/vfs/commit
POST /api/fs/commit
POST /api/v6/fs/commit
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "filePath": "apps/user-interface/src/features/editor/components/DiffViewer.jsx",
  "approved": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "committed",
  "filePath": "apps/user-interface/src/features/editor/components/DiffViewer.jsx"
}
```

### 3.2 VFS Statistics

#### Get VFS Stats
```http
GET /api/fs/stats
GET /api/v6/fs/stats
```

The stats payload summarizes staged, approved, rejected, and committed files, optionally scoped to the current user.

---

## 4. Terminal & Sessions

### 4.1 Terminal Management

#### List Terminal Sessions
```http
GET /api/terminal/sessions
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "term_123",
      "status": "active",
      "createdAt": "2026-05-07T00:30:00Z",
      "lastActivity": "2026-05-07T00:35:00Z",
      "commandCount": 5,
      "currentDirectory": "/app"
    },
    {
      "id": "term_456",
      "status": "completed",
      "createdAt": "2026-05-07T00:25:00Z",
      "completedAt": "2026-05-07T00:30:00Z",
      "commandCount": 3
    }
  ]
}
```

#### Get Terminal Output
```http
GET /api/terminal/output/:sessionId
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | string | Terminal session ID |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 50 | Maximum number of lines |
| offset | number | No | 0 | Line offset for pagination |

**Response:**
```json
{
  "success": true,
  "sessionId": "term_123",
  "output": [
    {
      "timestamp": "2026-05-07T00:30:00Z",
      "type": "command_start",
      "data": "npm test",
      "line": 1
    },
    {
      "timestamp": "2026-05-07T00:30:05Z",
      "type": "stdout",
      "data": " PASS  src/components/Button.test.js",
      "line": 2
    },
    {
      "timestamp": "2026-05-07T00:30:10Z",
      "type": "command_complete",
      "data": "Test suites: 1 passed, 1 total",
      "exitCode": 0,
      "line": 3
    }
  ],
  "hasMore": false,
  "totalLines": 3
}
```

#### Execute Terminal Command
```http
POST /api/terminal/execute
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "command": "npm install @mui/material",
  "sessionId": "term_123",
  "workingDirectory": "/app"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "term_123",
  "commandId": "cmd_789",
  "status": "executing",
  "message": "Command started execution"
}
```

---

## 5. WebSocket Events

### 5.1 Connection

#### Connect to WebSocket
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIs...'
  },
  transports: ['websocket']
});
```

#### Join User Room
```javascript
socket.emit('join_room', {
  userId: 'user_123',
  sessionId: 'agent_loop_abc123'
});
```

### 5.2 Server → Client Events for AI Agents

#### Agent Status Updates
```javascript
socket.on('agent_status', (data) => {
  // AI AGENT STATE MACHINE TRANSITIONS
  // data: {
  //   status: 'parsing_ast' | 'drafting_code' | 'sandboxing' | 'success' | 'error',
  //   message: 'Analyzing code structure...',
  //   progress: 0.6,
  //   timestamp: '2026-05-07T00:30:00Z',
  //   sessionId: 'agent_loop_abc123'
  // }
});
```

**AI Agent State Monitoring:**
- `loading_contexts`: Fetching org_core + user_env
- `parsing_ast`: Tree-sitter analysis in progress
- `drafting_code`: LLM generating code
- `sandboxing`: Docker testing code
- `success`: VFS staging complete, awaiting approval
- `error`: Failure occurred, check rollback

#### File Staging Events
```javascript
socket.on('file_staged', (data) => {
  // VFS STAGING UPDATES
  // data: {
  //   fileId: 'file_123',
  //   filePath: 'src/components/DarkModeToggle.jsx',
  //   status: 'staged' | 'modified' | 'new',
  //   diff: { additions: [], deletions: [] },
  //   metadata: {
  //     retries: 1,
  //     sandboxPassed: true,
  //     createdAt: '2026-05-07T00:30:00Z'
  //   }
  // }
});
```

**AI Agent VFS Monitoring:**
- `staged`: New file ready for review
- `modified`: Existing file changed
- `new`: Completely new file created
- `sandboxPassed`: Docker testing succeeded

#### Terminal Output Events
```javascript
socket.on('terminal_output', (data) => {
  // data: {
  //   sessionId: 'term_123',
  //   type: 'stdout' | 'stderr' | 'command_start' | 'command_complete',
  //   data: 'npm install completed successfully',
  //   timestamp: '2026-05-07T00:30:00Z',
  //   exitCode: 0 // Only for command_complete
  // }
});
```

#### Error Events
```javascript
socket.on('error', (data) => {
  // data: {
  //   code: 'SANDBOX_ERROR' | 'VFS_ERROR' | 'AGENT_ERROR',
  //   message: 'Sandbox execution failed',
  //   details: { error: 'Container timeout', duration: 10000 },
  //   timestamp: '2026-05-07T00:30:00Z',
  //   sessionId: 'agent_loop_abc123'
  // }
});
```

### 5.3 Client → Server Events

#### Send User Prompt
```javascript
socket.emit('send_prompt', {
  message: 'Create a dark mode toggle',
  context: {
    language: 'en',
    effort: 'standard'
  }
});
```

#### Approve Changes
```javascript
socket.emit('approve_changes', {
  fileIds: ['file_123', 'file_456'],
  commitMessage: 'Add dark mode functionality'
});
```

#### Reject Changes
```javascript
socket.emit('reject_changes', {
  fileIds: ['file_123'],
  reason: 'Needs refactoring'
});
```

---

## 6. Error Handling

### 6.1 Error Response Format

All API errors follow this consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "message",
      "issue": "must be between 1 and 1000 characters"
    },
    "timestamp": "2026-05-07T00:30:00Z",
    "requestId": "req_1778085601939_wp1czd69g"
  }
}
```

### 6.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict or state mismatch |
| `RATE_LIMITED` | 429 | Too many requests |
| `AGENT_ERROR` | 500 | Agent execution failed |
| `VFS_ERROR` | 500 | Virtual file system error |
| `SANDBOX_ERROR` | 500 | Sandbox execution error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 6.3 Specific Error Scenarios

#### Invalid Handoff Code
```json
{
  "success": false,
  "error": {
    "code": "INVALID_HANDOFF",
    "message": "Invalid or expired sign-in handoff",
    "timestamp": "2026-05-07T00:30:00Z"
  }
}
```

#### Agent Execution Failed
```json
{
  "success": false,
  "error": {
    "code": "AGENT_ERROR",
    "message": "Agent failed to complete request",
    "details": {
      "phase": "sandboxing",
      "retries": 3,
      "lastError": "Container timeout after 10 seconds"
    },
    "timestamp": "2026-05-07T00:30:00Z"
  }
}
```

#### VFS Conflict
```json
{
  "success": false,
  "error": {
    "code": "VFS_ERROR",
    "message": "File conflict in virtual file system",
    "details": {
      "filePath": "src/components/Button.jsx",
      "conflictType": "simultaneous_modification"
    },
    "timestamp": "2026-05-07T00:30:00Z"
  }
}
```

---

## 7. Rate Limiting

### 7.1 Rate Limit Rules

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/auth/*` | 30 requests | 15 minutes | Authentication endpoints |
| `/api/agent/prompt` | 10 requests | 1 hour | Agent prompts (expensive) |
| `/api/agent/*` | 100 requests | 15 minutes | Other agent endpoints |
| `/api/vfs/*` | 200 requests | 15 minutes | VFS operations |
| `/api/terminal/*` | 50 requests | 15 minutes | Terminal operations |
| WebSocket | 1000 messages | 15 minutes | WebSocket events |

### 7.2 Rate Limit Headers

Rate limited responses include these headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1715082000
```

### 7.3 Rate Limit Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "15 minutes",
      "retryAfter": 300
    },
    "timestamp": "2026-05-07T00:30:00Z"
  }
}
```

---

## Appendix A: Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'github';
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Agent Session Model
```typescript
interface AgentSession {
  id: string;
  userId: string;
  status: 'idle' | 'loading_contexts' | 'parsing_ast' | 'drafting_code' | 'sandboxing' | 'success' | 'error';
  message: string;
  progress: number;
  history: AgentHistoryEntry[];
  retries: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}
```

### VFS File Model
```typescript
interface VFSFile {
  id: string;
  sessionId: string;
  filePath: string;
  status: 'staged' | 'committed' | 'rejected';
  originalContent?: string;
  proposedContent?: string;
  diff: FileDiff;
  metadata: {
    createdAt: string;
    retries: number;
    sandboxPassed: boolean;
    size: number;
  };
}
```

### Terminal Session Model
```typescript
interface TerminalSession {
  id: string;
  userId: string;
  status: 'active' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  commandCount: number;
  currentDirectory: string;
  lastActivity: string;
}
```

---

## Appendix B: Authentication Flow

### OAuth 2.0 Flow Diagram

```
1. User clicks "Sign in with Google"
   ↓
2. Frontend redirects to /api/auth/google?returnOrigin=...
   ↓
3. Backend redirects to Google OAuth consent screen
   ↓
4. User authorizes application
   ↓
5. Google redirects to /api/auth/google/callback?code=...
   ↓
6. Backend exchanges code for tokens
   ↓
7. Backend creates user session and handoff code
   ↓
8. Backend redirects to frontend with handoff code
   ↓
9. Frontend exchanges handoff code for JWT tokens
   ↓
10. Frontend stores tokens and authenticates user
```

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "id": "0dca22ce-aa21-4fda-88f0-8004fddf8feb",
    "sessionId": "fe9cafb6-645c-42ab-bb2b-6113549a785f",
    "type": "access",
    "iat": 1778085604,
    "exp": 1778086204
  }
}
```

---

**End of API Specification**
