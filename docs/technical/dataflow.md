# Vibe-Hub Dataflow Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI as apps/user-interface
    participant Server as apps/server-bridge
    participant State as XState machine
    participant Sandbox as Docker sandbox
    participant VFS as VFS container
    participant DB as PostgreSQL

    User->>UI: Enter prompt and target file
    UI->>Server: POST /api/code or /api/v6/code
    Server->>State: START_TASK
    State->>Server: load org_core + user_env contexts
    State->>Server: parse AST and draft code
    State->>Sandbox: run proposed code in isolated container
    Sandbox-->>State: success or failure
    State->>VFS: stage file on success
    VFS-->>UI: file_staged event
    UI-->>User: Show diff and approval controls
    User->>UI: Approve or reject
    UI->>Server: POST /api/fs/commit or /api/v6/fs/commit
    Server->>VFS: approve / reject / commit
    VFS->>DB: write audit record and persistence data
    Server-->>UI: commit result
```

## Flow Notes

1. The request starts in the UI workspace, not directly in the backend.
2. The server bridge is responsible for both orchestration and the approval gate.
3. The staged file is not written to disk until the user approves the commit.
4. `agent_status` and `file_staged` are the primary real-time events used by the workspace.
