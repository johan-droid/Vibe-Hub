# Virtual File System (VFS) Technical Specification

**Component:** Secure staging layer

## Overview

The VFS is the repository’s approval gate. Agent output is staged in memory, reviewed in the UI, and only written to disk after explicit approval.

## Core Guarantees

- No disk write occurs without user approval.
- Staging is scoped to a workspace root.
- Ignored paths and hidden paths are rejected early.
- Every state change is audited.

## Implementation Model

The current container keeps a `Map` of staged files and a bounded audit log.

```javascript
{
  staging: Map<string, {
    content: string,
    metadata: {
      size: number,
      stagedAt: number,
      userId: string,
      ...extraMetadata
    }
  }>,
  totalStagedSize: number,
  auditLog: Array<{ timestamp, level, message, operation, ... }>
}
```

## Safety Rules

- Base ignores include `node_modules/`, `.git/`, `dist/`, `build/`, `.env*`, and `*.log`.
- A `.gitignore` file in the workspace root is loaded and honored.
- Files outside the workspace root are rejected.
- Symbolic links and path escapes are blocked.
- Default limits cap file size, total staging size, file count, and staging age.

## Public Methods

### `read(targetPath, userId)`
- Returns the staged content when present, otherwise reads from disk.
- Rejects ignored or unsafe paths.

### `stage(targetPath, content, metadata, userId)`
- Adds or replaces a staged file in memory.
- Stores `size`, `stagedAt`, and `userId` in metadata.
- Emits a `staged` event and records an audit entry.

### `commit(targetPath, userId, approved)`
- Requires `approved === true`.
- Writes the staged content to disk.
- Removes the entry from staging.
- Emits a `committed` event and records an audit entry.

### `commitAll(userId, approved)`
- Commits every staged file after approval.
- Collects errors per file so one failure does not hide the others.

### `reject(targetPath, userId)`
- Drops the staged file without writing to disk.
- Emits a `rejected` event and records an audit entry.

### `getPendingFilesForUser(userId)`
- Returns the current user’s staged entries in a compact form.

### `clearOldEntries()`
- Removes entries older than `maxStagingAge`.

### `getStats()`
- Returns staged-file counts, pending-approval counts, total size, and the size ceiling.

### `getAuditLog()`
- Returns a copy of the audit log for inspection.

## UI Integration

- The server emits `file_staged`, `file_approved`, `file_rejected`, and `file_committed` style events through its event surface.
- The UI review surface is the DiffViewer in `apps/user-interface/src/features/editor/components/DiffViewer.jsx`.
- The approval action flows through `POST /api/fs/commit` or the `/api/v6/fs/commit` alias.

## Operational Notes

- The VFS is intentionally small and in-memory so that approval state stays explicit and reversible.
- Staging entries older than the configured TTL are cleared automatically.
- The audit log is bounded to prevent unbounded memory growth.

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
