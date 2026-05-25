# Dataflow Schema

This document is the repo-level source of truth for how Vibe-Hub moves data through ingestion, retrieval, reasoning, execution, verification, and audit.

GitHub renders Mermaid diagrams well, but it does not provide robust native animation controls. The diagrams below are therefore GitHub-native and static-by-default. If we need motion later, the same graphs can be exported to SVG or GIF in `docs/assets/`.

## End-to-End Flow

```mermaid
flowchart LR
    A["User / Upload / Event"] --> B["Source Capture"]
    B --> C["Canonicalization + Hashing + Tags"]
    C --> D["Memory Separation"]
    D --> D1["Source Memory"]
    D --> D2["Working Memory"]
    D --> D3["Learned Memory"]
    A --> E["Deterministic Query Classifier"]
    E --> F["Retrieval Planner"]
    F --> G["Lexical + Structural Retrieval"]
    G --> H["Ranked Evidence Packet"]
    H --> I{"LLM Needed?"}
    I -->|No| J["Deterministic Action / Tool / Build / Test"]
    I -->|Yes| K["Smallest Useful Model Call"]
    K --> L["Tool Guard + Approval Gate"]
    J --> M["Verification"]
    L --> M
    M --> N["Audit Ledger + Metrics + Replay Artifacts"]
    N --> O["Memory Update Policy"]
```

## Harnessing And Retrieval Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant API as Server Bridge API
    participant H as Content Harness
    participant M as Memory Store
    participant R as Retrieval Planner
    participant E as Evidence Builder
    participant L as Model Layer
    participant V as Verification
    participant A as Audit Ledger

    U->>API: Upload content / submit task
    API->>H: Normalize, hash, tag, chunk
    H->>M: Persist source memory entries
    U->>API: Ask question or request code change
    API->>R: Classify query, pick retrieval policy
    R->>M: Fetch candidate memory
    M-->>R: Ranked source / working / learned items
    R->>E: Build bounded evidence packet
    E-->>API: Grounded context pack
    API->>L: Invoke smallest useful model only if needed
    L-->>API: Reasoned action or patch
    API->>V: Run build, test, tool verification
    V-->>A: Record pass/fail evidence
    API-->>U: Return grounded result with audit trail
```

## Runtime Modes

```mermaid
stateDiagram-v2
    [*] --> Normal
    Normal --> Degraded: Provider unavailable / rate limited
    Normal --> AuditFull: auditMode=full
    Normal --> SecurityBlocked: Auth failure / unsafe tool / approval denied
    Degraded --> Normal: Provider recovered
    AuditFull --> Normal: auditMode lowered
    SecurityBlocked --> Normal: Request corrected and re-authorized
    SecurityBlocked --> [*]: Request rejected
```

## Implementation Anchors

- Source capture and canonicalization: `apps/server-bridge/memory/content-harness.js`
- Retrieval planning and evidence packing: `apps/server-bridge/memory/rag-layers.js`
- Memory loading: `apps/server-bridge/memory/loader.js`
- Prompt construction and token budgeting: `apps/server-bridge/orchestrator/context-builder.js`
- Tool gating and orchestration: `apps/server-bridge/orchestrator/index.js`, `apps/server-bridge/mcp/`
- Durable audit artifacts: `apps/server-bridge/orchestrator/rollout_recorder.js`
