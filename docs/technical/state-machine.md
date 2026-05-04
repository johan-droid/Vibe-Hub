# State Machine Technical Specification

**Component:** XState Orchestration Engine  
**Version:** 6.0  
**Last Updated:** 2026-05-04

---

## Overview

The XState state machine is the core orchestration engine that manages the agent's deterministic execution flow. It enforces strict boundaries, handles failures with retries, and triggers rollbacks when necessary.

---

## State Diagram

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ START_TASK
                           ▼
              ┌─────────────────────────┐
              │    loading_contexts     │
              │  (Load org + user ctx)  │
              └──────┬──────────┬───────┘
                     │ success  │ error
                     ▼          ▼
            ┌──────────────┐  ┌──────────────┐
            │  parsing_ast │  │ fatal_failure  │
            │ (AST parser) │  │   [FINAL]      │
            └──────┬───────┘  └──────────────┘
                   │ success
                   │ error ───────────┐
                   ▼                  │
           ┌──────────────┐          │
           │ drafting_code│          │
           │ (LLM call)   │          │
           └──────┬───────┘          │
                  │ success          │
                  │ error            │
                  ▼                  │
          ┌──────────────┐          │
          │  sandboxing  │          │
          │(GitHub Actions) │          │
          └──────┬───────┘          │
                 │ success           │
                 │ error             │
                 ▼                  │
     ┌──────────────────────┐      │
     │   evaluating_failure │      │
     │  (retry or rollback) │◄─────┘
     └──────┬──────────┬─────┘
            │ retries  │ retries
            │ < 3      │ >= 3
            ▼          ▼
    ┌──────────────┐ ┌──────────┐
    │ drafting_code│ │ rollback │
    │ (+1 retry)   │ │          │
    └──────────────┘ └────┬─────┘
                          │
                          │ (reset retries,
                          │  inject override)
                          ▼
                   ┌──────────────┐
                   │ drafting_code│
                   │ (new attempt)│
                   └──────────────┘

Terminal States:
┌──────────┐  ┌──────────────┐
│ success  │  │ fatal_failure│
│ [FINAL]  │  │   [FINAL]    │
└──────────┘  └──────────────┘
```

---

## State Definitions

### idle
- **Purpose:** Waiting for task initiation
- **Context:** Empty/default values
- **Events:** `START_TASK` → `loading_contexts`

### loading_contexts
- **Purpose:** Load org_core and user_env contexts separately
- **Service:** `fetchIsolatedContexts`
- **Actions on Success:** Assign `orgContext`, `userContext`
- **Actions on Error:** → `fatal_failure`

### parsing_ast
- **Purpose:** Build deterministic AST graph
- **Service:** `buildSemanticGraph`
- **Actions on Success:** Assign `astGraph`
- **Actions on Error:** → `fatal_failure`

### drafting_code
- **Purpose:** Generate code via LLM
- **Service:** `generateCode` (llmClient)
- **Context Passed:** orgContext, userContext, taskPrompt, astGraph, sandboxError
- **Actions on Success:** Assign `generatedCode`
- **Actions on Error:** → `rollback`

### sandboxing
- **Purpose:** Execute code in Docker sandbox
- **Service:** `triggerGitHubActionSandbox`
- **Conditions:**
  - Success → `success`
  - Error → `evaluating_failure` (assign `sandboxError`)

### evaluating_failure
- **Purpose:** Decision point for retry vs rollback
- **Transitions (always):**
  - `retries < maxRetries` → `drafting_code` (increment retries)
  - `retries >= maxRetries` → `rollback`

### rollback
- **Purpose:** Reset and force new architectural approach
- **Entry Actions:**
  - Reset `retries` to 0
  - Inject `SYSTEM OVERRIDE` prompt into `taskPrompt`
- **Transition:** Always → `drafting_code`

### success
- **Purpose:** Code verified, stage in VFS
- **Entry Actions:** Stage in VFS (`vfs.stageFile`)
- **Type:** Final state

### fatal_failure
- **Purpose:** Unrecoverable error
- **Entry Actions:** Log error, clean up
- **Type:** Final state

---

## Context Schema

```javascript
{
  userId: string | null,
  taskPrompt: string | null,
  retries: number,          // Current retry count
  maxRetries: number,       // Default: 3
  orgContext: object | null,    // From org_core/context_builder
  userContext: object | null, // From user_env/context_builder
  astGraph: object | null,      // From memory/loader
  generatedCode: string | null,
  sandboxError: string | null,  // Error trace from Docker
  targetFile: string | null,    // File being modified
  originalCode: string | '',   // Original content for diff
  stagedFile: object | null     // VFS entry after success
}
```

---

## Event Definitions

### START_TASK
- **Payload:** `{ prompt, userId, targetFile, originalCode }`
- **Source:** Frontend API call
- **Target:** `idle` → `loading_contexts`

### Transition Events (Internal)
- `onDone` — Service completion
- `onError` — Service failure
- `always` — Automatic transition

---

## Services

### fetchIsolatedContexts
```javascript
async (context) => {
  const org = await OrgContextBuilder.buildGlobalConstraints();
  const user = await UserContextBuilder.buildUserPreferences(context.userId);
  return { org, user };
}
```

### buildSemanticGraph
```javascript
async (context) => {
  if (!context.targetFile) return { parsed: false };
  return await semanticGraphBuilder.buildSemanticGraph(context.targetFile);
}
```

### generateCode
```javascript
async (context) => {
  return await llmClient.generateCode(
    context.orgContext,
    context.userContext,
    context.taskPrompt,
    context.astGraph,
    context.sandboxError
  );
}
```

### triggerGitHubActionSandbox
```javascript
async (context) => {
  return await SandboxExecutor.triggerGitHubActionSandbox(context.generatedCode);
}
```

---

## Actions

### Assign Actions
- `assign({ orgContext: (ctx, event) => event.data.org })`
- `assign({ retries: (ctx) => ctx.retries + 1 })`

### Entry Actions (rollback)
```javascript
entry: assign({
  retries: 0,
  taskPrompt: (ctx) => `${ctx.taskPrompt}
    
    SYSTEM OVERRIDE: Your previous architectural approach 
    failed completely with error: ${ctx.sandboxError}. 
    Do NOT retry the same logic. Pivot to a completely 
    different design pattern.`
})
```

---

## Guards/Conditions

### sandboxing onDone
```javascript
[
  {
    target: 'success',
    cond: (ctx, event) => event.data.success === true
  },
  {
    target: 'evaluating_failure',
    actions: assign({ sandboxError: (ctx, event) => event.data.error_trace })
  }
]
```

### evaluating_failure always
```javascript
[
  {
    target: 'rollback',
    cond: (ctx) => ctx.retries >= ctx.maxRetries
  },
  {
    target: 'drafting_code',
    actions: assign({ retries: (ctx) => ctx.retries + 1 })
  }
]
```

---

## Usage Example

```javascript
import { interpret } from 'xstate';
import agentMachine from './state_machine.js';

// Create service with listeners
const agentService = interpret(agentMachine)
  .onTransition((state) => {
    console.log('State:', state.value);
    
    // Stream to WebSocket
    io.to(socketId).emit('agent_status', {
      status: state.value,
      message: mapStateToMessage(state.value),
      retries: state.context.retries
    });
    
    // Handle completion
    if (state.value === 'success') {
      console.log('Generated code:', state.context.generatedCode);
    }
    if (state.value === 'fatal_failure') {
      console.error('Failed:', state.context.sandboxError);
    }
  });

// Start and send task
agentService.start();
agentService.send({
  type: 'START_TASK',
  prompt: 'Create a function to calculate factorial',
  userId: 'user-123',
  targetFile: '/path/to/file.js'
});
```

---

## Testing

### Unit Tests
```javascript
// Test state transitions
const service = interpret(agentMachine).start();
service.send({ type: 'START_TASK', ... });
expect(service.state.value).toBe('loading_contexts');
```

### Integration Tests
- Mock services (LLM, GitHub Actions)
- Verify full flow: idle → ... → success/fatal_failure
- Test retry logic (3 failures → rollback)

---

## Related Files

- `orchestrator/state_machine.js` — Machine definition
- `orchestrator/router.js` — Service interpreter
- `orchestrator/llm_client.js` — LLM service
- `sandbox/github_executor.js` — GitHub Actions service
- `memory/loader.js` — AST service

---

## Performance Considerations

- State transitions: < 100ms target
- No blocking operations in guards/actions
- Async services for I/O (LLM, Docker, DB)

---

**End of State Machine Technical Specification**
