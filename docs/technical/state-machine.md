# State Machine Technical Specification

**Component:** XState orchestration engine
**Version:** current workspace implementation

## Overview

The orchestrator uses XState to make code-generation runs deterministic. Each run loads context, parses the target file, drafts code, executes the proposal in the sandbox, and either stages the result or rolls back on failure.

## State Graph

```text
idle
  -> loading_contexts
  -> parsing_ast
  -> drafting_code
  -> sandboxing
  -> success | evaluating_failure | fatal_failure
evaluating_failure
  -> drafting_code when retries < maxRetries
  -> rollback when retries >= maxRetries
rollback
  -> drafting_code
```

## State Responsibilities

### idle
- Waits for `START_TASK`.
- No request context is loaded yet.

### loading_contexts
- Loads the org and user context builders.
- Emits `agent_status` updates with the “Locking organizational and user boundaries...” message.

### parsing_ast
- Parses the target file into a semantic graph.
- The UI sees this as “Building semantic code graph...”.

### drafting_code
- Sends the assembled context to the model client.
- Carries `orgContext`, `userContext`, `astGraph`, `taskPrompt`, `targetFile`, `effortLevel`, and `sandboxError`.

### sandboxing
- Runs the proposed code through the local Docker sandbox.
- A successful sandbox run moves to `success`.
- A failed sandbox run moves to `evaluating_failure`.

### evaluating_failure
- Decides whether to retry or roll back.
- The current implementation increments retries until the maximum is reached.

### rollback
- Resets retries.
- Injects a stronger instruction to change the implementation approach.

### success
- Stages the generated file in the VFS.
- Emits `file_staged` for the UI.

### fatal_failure
- Ends the run with an unrecoverable error.

## Context Shape

```javascript
{
  userId: string | null,
  prompt: string | null,
  targetFile: string | null,
  originalCode: string,
  effortLevel: 'standard' | 'thorough' | 'minimal',
  retries: number,
  maxRetries: number,
  orgContext: object | null,
  userContext: object | null,
  astGraph: object | null,
  generatedCode: string | null,
  sandboxError: string | null,
  stagedFile: object | null,
  crossFileCoherenceEnabled: boolean
}
```

## Events

- `START_TASK` kicks off the orchestration run.
- Internal state-machine completion events move the run from one phase to the next.
- `agent_status` is emitted to the UI after each transition.

## Runtime Notes

- The state messages in `apps/server-bridge/orchestrator/router.js` are the canonical user-facing descriptions.
- The sandbox failure path is designed to be recoverable until retries are exhausted.
- The VFS stage is the last step before user approval and commit.

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
