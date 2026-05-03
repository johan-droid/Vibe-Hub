# Virtual File System (VFS) Technical Specification

**Component:** Secure Staging Layer  
**Version:** 6.0  
**Last Updated:** 2026-05-04

---

## Overview

The Virtual File System (VFS) is an in-memory staging layer that prevents automatic disk writes. It requires explicit user approval before any code is committed to the physical filesystem, providing a critical security and UX barrier.

---

## Core Philosophy

> **Never write to disk without user approval.**

The VFS intercepts all agent-generated code and holds it in memory until the user explicitly approves the changes via the DiffViewer UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AGENT SUCCESS                           │
│                     (State Machine: success)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              VIRTUAL FILE SYSTEM (Memory Layer)                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Staging Map: filePath → Entry                        │   │
│  │                                                         │   │
│  │  Entry: {                                             │   │
│  │    filePath: string,                                  │   │
│  │    originalContent: string,  ← From disk              │   │
│  │    proposedContent: string,  ← From agent            │   │
│  │    metadata: {                                         │   │
│  │      timestamp, retries, sandboxVerified, userId       │   │
│  │    },                                                  │   │
│  │    status: 'pending_review' | 'approved' |            │   │
│  │            'rejected' | 'committed'                   │   │
│  │  }                                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  EventEmitter: 'file_staged' │ 'file_approved'                   │
│              'file_rejected' │ 'file_committed'                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼ WebSocket: 'file_staged'
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              DiffViewer Component                       │   │
│  │                                                         │   │
│  │  ┌─────────────────┐    ┌─────────────────┐            │   │
│  │  │  Current Disk   │ vs │  VFS Proposal  │            │   │
│  │  │  (Red/Green)    │    │  (Red/Green)   │            │   │
│  │  └─────────────────┘    └─────────────────┘            │   │
│  │                                                         │   │
│  │  [  Reject  ]        [  Approve & Write  ]            │   │
│  │       │                      │                         │   │
│  │       ▼                      ▼                         │   │
│  │  dropFromVfs()        POST /api/fs/commit             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼ (only on approve)
┌─────────────────────────────────────────────────────────────────┐
│                   PHYSICAL DISK (Node.js fs)                    │
│                                                                 │
│  fs.writeFile(filePath, proposedContent)                       │
│                                                                 │
│  ⚠️ ONLY the /api/fs/commit endpoint has this authority        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Entry Schema

```typescript
interface VfsEntry {
  filePath: string;              // Absolute or relative path
  originalContent: string;       // Content from physical disk
  proposedContent: string;       // Content from agent (verified)
  metadata: {
    timestamp: string;           // ISO 8601
    agentVersion: string;        // e.g., 'v6'
    retries: number;             // Retry count before success
    sandboxVerified: boolean;    // Passed Docker sandbox?
    userId?: string;             // Owner
    approvedAt?: string;          // When user approved
    rejectedAt?: string;          // When user rejected
    committedAt?: string;         // When written to disk
    rejectionReason?: string;    // Why rejected
  };
  status: 'pending_review' | 'approved' | 'rejected' | 'committed';
  stagedAt: string;              // When first staged
}
```

---

## API Reference

### Backend (vfs/container.js)

#### `stageFile(filePath, originalContent, proposedContent, metadata)`
Stages code for user review.

**Parameters:**
- `filePath` (string): Target file path
- `originalContent` (string): Current disk content
- `proposedContent` (string): Agent-generated content
- `metadata` (object): Contextual information

**Returns:** `VfsEntry`

**Emits:** `file_staged`

---

#### `getStagedFile(filePath)`
Retrieves a specific staged entry.

**Returns:** `VfsEntry | undefined`

---

#### `getPendingFiles()`
Returns all files awaiting review.

**Returns:** `VfsEntry[]`

---

#### `approveFile(filePath)`
Marks file as approved for commit.

**Throws:** If file not found or already approved/rejected/committed

**Emits:** `file_approved`

---

#### `rejectFile(filePath, reason?)`
Marks file as rejected (drops changes).

**Emits:** `file_rejected`

---

#### `commitToDisk(filePath, fsModule)`
**ONLY method that writes to physical disk.**

**Parameters:**
- `filePath` (string): Must be approved first
- `fsModule` (object): Node.js fs/promises

**Process:**
1. Validate status is 'approved'
2. Call `fs.writeFile(filePath, proposedContent)`
3. Update status to 'committed'
4. Emit `file_committed`

**Throws:** If not approved or write fails

---

#### `getStats()`
Returns VFS statistics.

**Returns:**
```javascript
{
  total: number,      // All entries
  pending: number,    // awaiting_review
  approved: number,   // approved (not yet committed)
  rejected: number,   // rejected
  committed: number   // written to disk
}
```

---

### Backend API Endpoints

#### `POST /api/fs/commit`
Commit approved changes to disk.

**Request:**
```json
{
  "filePath": "/path/to/file.js",
  "approved": true
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Changes committed to disk successfully",
  "filePath": "/path/to/file.js",
  "committedAt": "2026-05-04T01:10:00Z"
}
```

**Response (Reject):**
```json
{
  "success": true,
  "message": "Changes rejected. File not modified.",
  "filePath": "/path/to/file.js"
}
```

---

#### `GET /api/fs/pending`
Get pending VFS files.

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filePath": "/path/to/file.js",
      "originalContent": "...",
      "proposedContent": "...",
      "metadata": { ... },
      "status": "pending_review"
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

### Frontend (useVfsStore.js)

#### `stageProposedChanges(filePath, originalContent, proposedContent, metadata)`
Called automatically via WebSocket when agent succeeds.

#### `discardChanges()`
Reject staged changes (calls backend to drop from VFS).

#### `commitToPhysicalDisk()`
Approve and commit to disk (calls `/api/fs/commit`).

**Usage:**
```javascript
const { commitToPhysicalDisk } = useVfsStore();
await commitToPhysicalDisk();
```

#### `fetchPendingFiles()`
Load pending files from backend.

---

## Events

### Backend Events (EventEmitter)

| Event | Payload | Description |
|-------|---------|-------------|
| `file_staged` | `VfsEntry` | New file staged for review |
| `file_approved` | `VfsEntry` | File marked for commit |
| `file_rejected` | `VfsEntry` | File rejected by user |
| `file_committed` | `VfsEntry` | File written to disk |

### Frontend Events (WebSocket)

| Event | Payload | Description |
|-------|---------|-------------|
| `file_staged` | `{ filePath, originalContent, proposedContent, metadata, status }` | Show diff viewer |

---

## Security Model

### Guarantees

1. **No Auto-Write:** Agent success does NOT write to disk
2. **Memory Only:** All staging happens in VFS memory
3. **Explicit Approval:** User must click "Approve & Write"
4. **Audit Trail:** Every decision logged with timestamps
5. **Path Validation:** File paths validated before commit

### Threat Mitigation

| Threat | Mitigation |
|--------|------------|
| Malicious agent overwrites critical files | VFS staging + user approval |
| Path traversal attack | Path validation in commit endpoint |
| Race condition | Per-file locking (single user session) |
| Data loss | Original content preserved until commit |

---

## State Flow

```
┌─────────────┐    stageFile()     ┌───────────────┐
│   (none)    │ ─────────────────→ │ pending_review│
└─────────────┘                    └───────┬───────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
            ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
            │  approved   │      │  rejected   │      │ (no action) │
            └──────┬──────┘      └─────────────┘      └─────────────┘
                   │
                   │ commitToDisk()
                   ▼
            ┌─────────────┐
            │  committed  │
            └─────────────┘
```

---

## Integration with State Machine

```javascript
// In state_machine.js
success: {
  type: 'final',
  entry: assign({
    stagedFile: (context) => {
      const entry = vfs.stageFile(
        context.targetFile,
        context.originalCode,
        context.generatedCode,
        {
          agentVersion: 'v6',
          retries: context.retries,
          sandboxVerified: true,
          userId: context.userId
        }
      );
      return entry;
    }
  })
}
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `File not found in staging` | Invalid filePath | Check VFS stats |
| `File already approved` | Double approval | Ignore or log warning |
| `Failed to write to disk` | FS error | Retry or notify user |
| `Commit unauthorized` | Not approved | Call approveFile first |

---

## Testing Strategy

### Unit Tests
- Stage → Approve → Commit flow
- Reject clears from VFS
- Stats tracking accuracy

### Integration Tests
- End-to-end: Agent success → VFS → DiffViewer → Commit
- Multiple files staged simultaneously
- Reject one, approve another

### Security Tests
- Path traversal attempts (blocked)
- Unapproved commit attempts (blocked)
- Memory cleanup on reject

---

## Performance

- **Staging:** O(1) — Map insertion
- **Retrieval:** O(1) — Map lookup
- **Memory:** Linear with staged file count
- **Cleanup:** GC on session end or explicit clear

---

## Related Files

- `vfs/container.js` — Core VFS implementation
- `store/useVfsStore.js` — Frontend Zustand store
- `features/editor/components/DiffViewer.jsx` — UI component
- `orchestrator/router.js` — Commit endpoint handlers
- `orchestrator/state_machine.js` — Success state staging

---

**End of VFS Technical Specification**
