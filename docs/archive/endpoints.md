# API Endpoints Reference

**Version:** 6.0  
**Base URL:** `https://api.vibe-hub.com` (production) / `http://localhost:3001` (dev)  
**Last Updated:** 2026-05-04

---

## Authentication

All endpoints (except `/health`, OAuth) require JWT token in `Authorization` header:

```
Authorization: Bearer <token>
```

Token obtained via:
- `POST /api/auth/google` — Google OAuth
- `POST /api/auth/github` — GitHub OAuth

---

## Endpoints

### Agent Orchestration

#### `POST /api/code`
Initiate AI code generation with XState orchestration.

**Request:**
```json
{
  "prompt": "Create a function to calculate factorial",
  "userId": "user-123",
  "targetFile": "/path/to/file.js",
  "socketId": "socket_abc123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Agent completed successfully",
  "data": {
    "code": "function factorial(n) { ... }",
    "astGraph": { ... },
    "retries": 0,
    "stagedFile": {
      "filePath": "/path/to/file.js",
      "status": "pending_review"
    }
  }
}
```

**Response (Rollback Loop):**
```json
{
  "success": false,
  "message": "Agent entered rollback loop",
  "error": "Fatal failure: Sandbox execution failed",
  "fallback": {
    "domain": "code",
    "systemPrompt": "..."
  }
}
```

**WebSocket Events:**
- `agent_status` — Real-time state transitions
- `file_staged` — Code ready for review (VFS)

---

### Virtual File System

#### `POST /api/fs/commit`
Commit or reject staged VFS changes to physical disk.

**Request:**
```json
{
  "filePath": "/path/to/file.js",
  "approved": true
}
```

**Response (Approved):**
```json
{
  "success": true,
  "message": "Changes committed to disk successfully",
  "filePath": "/path/to/file.js",
  "committedAt": "2026-05-04T01:10:00Z"
}
```

**Response (Rejected):**
```json
{
  "success": true,
  "message": "Changes rejected. File not modified.",
  "filePath": "/path/to/file.js"
}
```

**Errors:**
- `400` — Missing filePath
- `404` — File not found in VFS
- `500` — Disk write failed

---

#### `GET /api/fs/pending`
Get all pending VFS files awaiting review.

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filePath": "/path/to/file.js",
      "originalContent": "...",
      "proposedContent": "...",
      "metadata": {
        "timestamp": "2026-05-04T01:00:00Z",
        "retries": 0,
        "sandboxVerified": true
      },
      "status": "pending_review",
      "stagedAt": "2026-05-04T01:00:00Z"
    }
  ]
}
```

---

#### `GET /api/fs/stats`
Get VFS statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 5,
    "pending": 2,
    "approved": 1,
    "rejected": 1,
    "committed": 1
  }
}
```

---

### Authentication

#### `GET /api/auth/google`
Initiate Google OAuth flow.

**Query Parameters:**
- `redirect` — Post-auth redirect URL

**Response:** Redirects to Google consent screen

---

#### `GET /api/auth/google/callback`
Google OAuth callback.

**Sets:**
- `token` cookie (JWT)

**Redirects:** To frontend with `?token=<jwt>`

---

#### `GET /api/auth/github`
Initiate GitHub OAuth flow.

**Query Parameters:**
- `redirect` — Post-auth redirect URL

**Response:** Redirects to GitHub consent screen

---

#### `GET /api/auth/github/callback`
GitHub OAuth callback.

**Sets:**
- `token` cookie (JWT)
- GitHub installation data in DB

---

### GitHub Integration

#### `POST /api/github/webhook`
GitHub webhook endpoint for workflow events.

**Headers:**
- `X-GitHub-Event` — Event type
- `X-Hub-Signature-256` — Signature for verification

**Events:**
- `workflow_run` — CI/CD status updates

**Broadcasts:** WebSocket `github_workflow_completed`

---

### System Health

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "active",
  "version": "4.1.0",
  "uptime": 12345.67,
  "memory": 89123456
}
```

**Auth:** None (public)

---

## WebSocket Events

### Client → Server

#### `join`
Join user-specific room for targeted messaging.

**Payload:**
```json
{
  "userId": "user-123"
}
```

---

### Server → Client

#### `agent_status`
State machine transition notification.

**Payload:**
```json
{
  "status": "drafting_code",
  "message": "Synthesizing logic with LLM...",
  "retries": 0,
  "timestamp": "2026-05-04T01:10:00Z"
}
```

**States:**
- `idle`, `loading_contexts`, `parsing_ast`
- `drafting_code`, `sandboxing`, `evaluating_failure`
- `rollback`, `success`, `fatal_failure`

---

#### `file_staged`
Code staged in VFS for user review.

**Payload:**
```json
{
  "filePath": "/path/to/file.js",
  "originalContent": "function old() { ... }",
  "proposedContent": "function new() { ... }",
  "metadata": {
    "timestamp": "2026-05-04T01:10:00Z",
    "agentVersion": "v6",
    "retries": 0,
    "sandboxVerified": true,
    "userId": "user-123"
  },
  "status": "pending_review",
  "timestamp": "2026-05-04T01:10:00Z"
}
```

**Action:** Frontend displays DiffViewer

---

#### `github_workflow_completed`
CI/CD workflow finished.

**Payload:**
```json
{
  "type": "github_workflow_completed",
  "repo": "user/repo",
  "workflowName": "CI",
  "conclusion": "success"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | OK | Success |
| `202` | Accepted | Fallback response |
| `400` | Bad Request | Missing required fields, invalid payload |
| `401` | Unauthorized | Missing/invalid JWT token |
| `404` | Not Found | Resource doesn't exist |
| `500` | Server Error | Unexpected exception |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SOCKET_ID` | socketId required for WebSocket streaming |
| `VFS_FILE_NOT_FOUND` | File not in VFS staging |
| `VFS_NOT_APPROVED` | File not approved before commit |
| `DISK_WRITE_FAILED` | Physical filesystem error |
| `LLM_API_ERROR` | LLM provider failure |
| `SANDBOX_TIMEOUT` | Docker execution exceeded 10s |
| `SANDBOX_ERROR` | Code failed in Docker container |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/code` | 10 | per minute |
| `POST /api/fs/commit` | 30 | per minute |
| `GET /api/fs/*` | 60 | per minute |

**Headers:**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Initialize Socket.io
const socket = io(API_URL, { path: '/socket.io' });

// Listen for agent status
socket.on('agent_status', (data) => {
  console.log(`Agent: ${data.message}`);
  updateUI(data.status, data.retries);
});

// Listen for staged files
socket.on('file_staged', (data) => {
  showDiffViewer(data.originalContent, data.proposedContent);
});

// Start orchestration
const response = await fetch(`${API_URL}/api/code`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    prompt: 'Create a factorial function',
    userId: 'user-123',
    targetFile: '/src/math.js',
    socketId: socket.id
  })
});

// Commit approved changes
const commit = await fetch(`${API_URL}/api/fs/commit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    filePath: '/src/math.js',
    approved: true
  })
});
```

### cURL

```bash
# Health check
curl https://api.vibe-hub.com/health

# Start orchestration
curl -X POST https://api.vibe-hub.com/api/code \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create factorial function",
    "userId": "user-123",
    "targetFile": "/src/math.js",
    "socketId": "socket_abc"
  }'

# Commit changes
curl -X POST https://api.vibe-hub.com/api/fs/commit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/src/math.js",
    "approved": true
  }'
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 6.0 | 2026-05-04 | Added VFS endpoints, WebSocket streaming |
| 5.0 | 2026-04-01 | Added XState orchestration |
| 4.0 | 2026-03-01 | Initial REST API |

---

**End of API Reference**
