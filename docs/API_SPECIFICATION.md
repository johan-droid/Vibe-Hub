# API Specification

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Base URL:** `http://localhost:3001/api`

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

#### Initiate OAuth Flow
```http
GET /api/auth/google
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| returnOrigin | string | Yes | URL to redirect after authentication |

**Response:** `302 Redirect` to Google OAuth

#### OAuth Callback
```http
GET /api/auth/google/callback
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Authorization code from Google |
| state | string | Yes | CSRF protection state |

**Response:** `302 Redirect` to returnOrigin with handoff code

#### Exchange Handoff Code
```http
POST /api/auth/handoff
```

**Request Body:**
```json
{
  "code": "euVvKG-vcKMWRrXswK4S6-_Op8-sj1udxEt1yAXVYPY"
}
```

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "0dca22ce-aa21-4fda-88f0-8004fddf8feb",
    "name": "ASHUTOSH SAHOO",
    "email": "sahooashutosh2022@gmail.com",
    "provider": "google",
    "avatarUrl": "https://lh3.googleusercontent.com/..."
  },
  "sessionId": "fe9cafb6-645c-42ab-bb2b-6113549a785f"
}
```

### 1.2 Session Management

#### Get Authentication Status
```http
GET /api/auth/status
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "0dca22ce-aa21-4fda-88f0-8004fddf8feb",
    "email": "sahooashutosh2022@gmail.com",
    "name": "ASHUTOSH SAHOO",
    "provider": "google"
  },
  "sessionId": "fe9cafb6-645c-42ab-bb2b-6113549a785f"
}
```

#### Logout
```http
POST /api/auth/logout
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Agent Management

### 2.1 Agent Orchestration

#### Send User Prompt
```http
POST /api/agent/prompt
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "message": "Create a dark mode toggle component",
  "context": {
    "language": "en",
    "effort": "standard",
    "projectPath": "/src/components"
  },
  "socketId": "socket_123"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "agent_loop_abc123",
  "status": "started",
  "message": "Agent started processing your request"
}
```

#### Get Agent Status
```http
GET /api/agent/status
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | No | Specific agent session ID |

**Response:**
```json
{
  "success": true,
  "status": {
    "sessionId": "agent_loop_abc123",
    "currentStatus": "sandboxing",
    "progress": 0.75,
    "message": "Testing generated code in sandbox",
    "history": [
      {
        "timestamp": "2026-05-07T00:30:00Z",
        "status": "parsing_ast",
        "message": "Analyzing code structure"
      },
      {
        "timestamp": "2026-05-07T00:30:15Z",
        "status": "drafting_code",
        "message": "Generating dark mode component"
      }
    ],
    "retries": 1,
    "maxRetries": 3
  }
}
```

#### Stop Agent Execution
```http
POST /api/agent/stop
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Request Body:**
```json
{
  "sessionId": "agent_loop_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent execution stopped"
}
```

#### Reset Agent State
```http
POST /api/agent/reset
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "message": "Agent state reset successfully"
}
```

---

## 3. Virtual File System

### 3.1 File Management

#### Get Pending Files
```http
GET /api/vfs/pending
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "file_123",
      "filePath": "src/components/DarkModeToggle.jsx",
      "status": "staged",
      "originalContent": "// Original file content",
      "proposedContent": "// New file content with dark mode",
      "diff": {
        "additions": [
          {
            "line": 5,
            "content": "const [isDark, setIsDark] = useState(false);"
          }
        ],
        "deletions": [
          {
            "line": 3,
            "content": "console.log('Hello World');"
          }
        ]
      },
      "metadata": {
        "createdAt": "2026-05-07T00:30:00Z",
        "retries": 1,
        "sandboxPassed": true,
        "size": 2048
      }
    }
  ]
}
```

#### Get File Diff
```http
GET /api/vfs/diff/:fileId
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| fileId | string | File identifier |

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "file_123",
    "filePath": "src/components/DarkModeToggle.jsx",
    "diff": {
      "unified": "@@ -3,7 +3,8 @@\n-console.log('Hello World');\n+const [isDark, setIsDark] = useState(false);\n+const toggleDarkMode = () => setIsDark(!isDark);",
      "additions": [
        {
          "line": 5,
          "content": "const [isDark, setIsDark] = useState(false);",
          "explanation": "Added dark mode state hook"
        },
        {
          "line": 6,
          "content": "const toggleDarkMode = () => setIsDark(!isDark);",
          "explanation": "Added toggle function"
        }
      ],
      "deletions": [
        {
          "line": 3,
          "content": "console.log('Hello World');",
          "explanation": "Removed debug statement"
        }
      ]
    },
    "syntaxHighlighting": {
      "language": "javascript",
      "theme": "material-dark"
    }
  }
}
```

#### Commit Approved Changes
```http
POST /api/vfs/commit
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "fileIds": ["file_123", "file_456"],
  "commitMessage": "Add dark mode toggle component"
}
```

**Response:**
```json
{
  "success": true,
  "committed": [
    {
      "fileId": "file_123",
      "filePath": "src/components/DarkModeToggle.jsx",
      "status": "committed"
    },
    {
      "fileId": "file_456",
      "filePath": "src/styles/dark-mode.css",
      "status": "committed"
    }
  ],
  "message": "Successfully committed 2 files"
}
```

#### Reject Staged Changes
```http
POST /api/vfs/reject
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |
| Content-Type | application/json |

**Request Body:**
```json
{
  "fileIds": ["file_123"],
  "reason": "Implementation needs improvement"
}
```

**Response:**
```json
{
  "success": true,
  "rejected": [
    {
      "fileId": "file_123",
      "filePath": "src/components/DarkModeToggle.jsx",
      "status": "rejected"
    }
  ],
  "message": "Rejected 1 file"
}
```

### 3.2 VFS Statistics

#### Get VFS Stats
```http
GET /api/vfs/stats
```

**Headers:**
| Header | Value |
|--------|-------|
| Authorization | Bearer {accessToken} |

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalFiles": 5,
    "stagedFiles": 3,
    "committedFiles": 2,
    "rejectedFiles": 0,
    "totalSize": 10240,
    "lastActivity": "2026-05-07T00:30:00Z",
    "sessionStats": {
      "currentSession": "agent_loop_abc123",
      "filesInSession": 3,
      "retriesInSession": 1
    }
  }
}
```

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

### 5.2 Server → Client Events

#### Agent Status Updates
```javascript
socket.on('agent_status', (data) => {
  // data: {
  //   status: 'parsing_ast' | 'drafting_code' | 'sandboxing' | 'success' | 'error',
  //   message: 'Analyzing code structure...',
  //   progress: 0.6,
  //   timestamp: '2026-05-07T00:30:00Z',
  //   sessionId: 'agent_loop_abc123'
  // }
});
```

#### File Staging Events
```javascript
socket.on('file_staged', (data) => {
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
