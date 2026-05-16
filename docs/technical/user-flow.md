# Vibe Hub User Flow

```mermaid
flowchart TD
    A[Open Workspace] --> B[Enter prompt and target file]
    B --> C[POST /api/code or /api/v6/code]
    C --> D[Orchestrator loads context]
    D --> E[Parse AST]
    E --> F[Draft code]
    F --> G[Run Docker sandbox]
    G --> H{Sandbox passed?}
    H -- No --> I[Retry or rollback]
    I --> F
    H -- Yes --> J[Stage file in VFS]
    J --> K[Show diff in DiffViewer]
    K --> L{User decision}
    L -- Reject --> M[Remove staged file]
    L -- Approve --> N[POST /api/fs/commit or /api/v6/fs/commit]
    N --> O[Commit to disk]
    M --> O
```

## Experience Notes

- The user stays in the workspace the whole time; there is no hidden commit path.
- The diff review step is the explicit approval gate.
- Rejected changes disappear from the staged queue.
- Approved changes pass through the VFS container before they touch disk.
