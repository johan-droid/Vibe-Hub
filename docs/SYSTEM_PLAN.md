# Vibe Hub Detailed System Plan

**Vibe-Hub: AI-Powered Agentic Coding Platform**  
**Version:** 6.1 Production Release  
**Date:** 2026-05-07  
**Status:** Production Ready  
**AI Agent Focus:** Enhanced for AI agent development workflows and vibecoding capabilities

---

## AI Agent Quick Reference

**Essential Commands for AI Agents:**
```bash
# Start development environment
npm run dev

# Validate syntax after changes
node --check <file>

# Run comprehensive tests
npm run test

# Check code quality
npm run lint

# Build for production
npm run build
```

**Critical Architecture Rules for AI Agents:**
- ✅ Always use ES modules (`import`/`export`)
- ✅ Include `.js` extensions in relative imports
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Use Docker sandbox for all code execution
- ✅ Follow V6 isolation principles
- ✅ Enforce language lock (en/hi/or only)

**AI Agent Development Tools:**
- `multi_edit` for coordinated file changes
- `grep_search` for pattern finding
- `find_by_name` for file discovery
- `node --check` for syntax validation
- `read_file` for code analysis

## Current Implementation Snapshot

- The current code path starts in `apps/server-bridge/index.js`.
- Orchestration is handled by `apps/server-bridge/orchestrator/state_machine.js` and `apps/server-bridge/orchestrator/router.js`.
- VFS staging and approval live in `apps/server-bridge/vfs/container.js`.
- Auth, chat, and preferences are routed through `apps/server-bridge/auth/routes.js`, `apps/server-bridge/orchestrator/chat_routes.js`, and `apps/server-bridge/orchestrator/preferences_routes.js`.
- The UI review surface is in `apps/user-interface/src/features/editor/components/DiffViewer.jsx` and the surrounding workspace features.

---

## 1. AI Agent Development Architecture

### 1.1 AI Agent Integration Points

**Primary AI Agent Entry Points:**
- **State Machine**: `apps/server-bridge/src/orchestrator/state_machine.js`
- **VFS Container**: `apps/server-bridge/src/vfs/container.js`
- **API Router**: `apps/server-bridge/src/orchestrator/router.js`
- **LLM Client**: `apps/server-bridge/src/orchestrator/llm_client.js`
- **Docker Sandbox**: `apps/server-bridge/src/sandbox/docker_executor.js`
- **Frontend**: `apps/user-interface/src/`

**AI Agent Workflow Integration:**
1. **Analysis Phase**: Use `read_file` and `grep_search` to understand existing code
2. **Implementation Phase**: Use `multi_edit` for coordinated changes across files
3. **Validation Phase**: Use `node --check` and `npm run test` for quality assurance
4. **Documentation Phase**: Update relevant markdown files with AI agent context

### 1.2 AI Agent Security Considerations

**AI Agent Security Boundaries:**
- **Input Validation**: All AI agent inputs validated through Zod schemas
- **Operation Limits**: Rate limiting and resource quotas for AI operations
- **Audit Logging**: Complete traceability of all AI agent actions
- **VFS Isolation**: AI agents cannot bypass VFS approval gates
- **Context Isolation**: Strict separation between org_core and user_env
- **Sandbox Enforcement**: All AI-generated code must pass Docker sandbox testing

### 1.3 AI Agent Performance Optimization

**Performance Considerations for AI Agents:**
- **Parallel Processing**: Support for concurrent AI agent operations
- **Memory Management**: Efficient context management and cleanup
- **Caching Strategy**: Intelligent caching of frequently accessed code patterns
- **Resource Monitoring**: Real-time monitoring of AI agent resource usage
- **Scalability**: Horizontal scaling for multiple AI agent sessions

## 2. V6 Architecture Implementation for AI Agents

### 2.1 State Machine Enhancement

**AI Agent State Machine Integration:**
- **Deterministic Execution**: XState machine provides predictable state transitions
- **Rollback Mechanism**: Antigravity prompts after 3 failed attempts
- **Real-time Monitoring**: WebSocket streaming of state transitions
- **Context Injection**: Enhanced context from org_core and user_env
- **Error Recovery**: Automated error handling and recovery patterns

**AI Agent State Machine Navigation:**
```javascript
// AI agents can trigger state transitions
const stateTransitions = {
  START_TASK: 'idle → loading_contexts',
  CONTEXTS_LOADED: 'loading_contexts → parsing_ast',
  AST_PARSED: 'parsing_ast → drafting_code',
  CODE_GENERATED: 'drafting_code → sandboxing',
  SANDBOX_PASSED: 'sandboxing → success',
  SANDBOX_FAILED: 'sandboxing → evaluating_failure',
  RETRY_EXHAUSTED: 'evaluating_failure → rollback'
};
```

### 2.2 Virtual File System (VFS) for AI Agents

**AI Agent VFS Operations:**
- **Staging**: Files staged in memory before disk write
- **Approval Gates**: User approval required for all changes
- **Batch Operations**: Multi-file coordination and commits
- **Audit Trail**: Complete history of all VFS operations
- **Rollback Support**: Safe rejection of staged changes

**AI Agent VFS Workflow:**
```javascript
// AI agents interact with VFS through these operations
const vfsOperations = {
  stageFile: (filePath, content) => vfs.stageFile(filePath, content),
  approveFile: (fileId) => vfs.approveFile(fileId),
  commitToDisk: (fileIds) => vfs.commitToDisk(fileIds),
  getDiff: (fileId) => vfs.getDiff(fileId),
  batchStage: (files) => vfs.batchStage(files)
};
```

### 2.3 Docker Sandbox Integration

**AI Agent Sandbox Security:**
- **Network Isolation**: `--network none` prevents external calls
- **Resource Limits**: 256MB RAM, 0.5 CPU, 50 PIDs
- **Timeout Protection**: 10-second execution limit
- **Read-only Filesystem**: Prevents modification during execution
- **Auto-cleanup**: Ephemeral containers destroyed after execution

**AI Agent Sandbox Workflow:**
```javascript
// AI agents trigger sandbox execution
const sandboxExecution = async (code) => {
  const result = await dockerExecutor.execute({
    code,
    timeout: 10000,
    memory: '256m',
    network: 'none',
    readonly: true
  });
  
  return {
    success: result.exitCode === 0,
    output: result.stdout,
    error: result.stderr
  };
};
```

## 3. AI Agent Implementation Roadmap

### 3.1 Phase 1: AI Agent Foundation (Current)
**Status**: ✅ Complete
**Deliverables:**
- ✅ AI Agent Quick Reference in all documentation
- ✅ Multi-file coordination tools (`multi_edit`)
- ✅ Pattern recognition and search capabilities (`grep_search`)
- ✅ File discovery and navigation (`find_by_name`, `list_dir`)
- ✅ Syntax validation integration (`node --check`)
- ✅ Code analysis tools (`read_file`)
- ✅ V6 architecture enforcement
- ✅ Context isolation (org_core/user_env)
- ✅ Docker sandbox integration

### 3.2 Phase 2: AI Agent Enhancement (Next)
**Status**: 🔄 In Progress
**Deliverables:**
- [ ] Enhanced AI agent context management
- [ ] Advanced pattern recognition algorithms
- [ ] Intelligent code completion suggestions
- [ ] Automated security vulnerability scanning
- [ ] Performance optimization recommendations
- [ ] Cross-file dependency analysis
- [ ] Automated refactoring suggestions
- [ ] Code quality scoring system

### 3.3 Phase 3: Token Squeeze By Layer (Future)
**Status**: 📋 Planned
**Deliverables:**
- [ ] **Source capture:** dedupe by content hash and skip unchanged artifacts.
- [ ] **Canonicalization:** normalize once, chunk once, reuse forever.
- [ ] **Retrieval planning:** classify query type without a model.
- [ ] **Retrieval:** filter by path, tag, kind, recency, and memory class before ranking.
- [ ] **Grounding:** cap top-N evidence and hard-cap per-item tokens.
- [ ] **Reasoning:** use cheap model for compression and strong model only for hard synthesis.
- [ ] **Verification:** summarize only failing output, never full logs by default.
- [ ] **Memory retention:** store facts, decisions, and citations, not raw transcripts.
- [ ] **Acceptance:** every layer has an explicit token budget and a hard fail/trim rule.

### 3.4 Phase 4: AI Agent Collaboration (Future)
**Status**: 📋 Planned
**Deliverables:**
- [ ] Multi-agent collaboration protocols
- [ ] Distributed AI agent coordination
- [ ] Conflict resolution mechanisms
- [ ] Shared context management
- [ ] Collaborative code review
- [ ] Distributed task delegation
- [ ] Consensus-based decision making
- [ ] Multi-repository synchronization

## 4. AI Agent Testing Strategy

### 4.1 Unit Testing for AI Agents
```javascript
// AI agent tool testing
describe('AI Agent Tools', () => {
  test('multi_edit coordinates file changes', async () => {
    const files = await multi_edit([
      { file: 'test1.js', changes: '...' },
      { file: 'test2.js', changes: '...' }
    ]);
    expect(files.length).toBe(2);
  });
  
  test('grep_search finds patterns', async () => {
    const results = await grep_search('src', 'import.*React');
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### 4.2 Integration Testing for AI Agents
```javascript
// AI agent workflow testing
describe('AI Agent Workflow', () => {
  test('complete AI agent development cycle', async () => {
    // 1. Analysis phase
    const analysis = await analyzeCodebase('src/');
    expect(analysis.files).toBeDefined();
    
    // 2. Implementation phase
    const changes = await implementChanges(analysis);
    expect(changes.length).toBeGreaterThan(0);
    
    // 3. Validation phase
    const validation = await validateChanges(changes);
    expect(validation.success).toBe(true);
    
    // 4. Documentation phase
    const docs = await updateDocumentation(changes);
    expect(docs.updated).toBe(true);
  });
});
```

### 4.3 Performance Testing for AI Agents
```javascript
// AI agent performance benchmarks
describe('AI Agent Performance', () => {
  test('large codebase analysis performance', async () => {
    const startTime = Date.now();
    await analyzeCodebase('large-project/');
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(30000); // 30 seconds
  });
  
  test('concurrent AI agent operations', async () => {
    const concurrent = await Promise.all([
      analyzeCodebase('project1/'),
      analyzeCodebase('project2/'),
      analyzeCodebase('project3/')
    ]);
    expect(concurrent.length).toBe(3);
  });
});
```

## 4. Security & Authentication
- **OAuth CSRF Protection:** Implementations in `auth/google.js` and `auth/github.js` must securely generate the `state` parameter, verify it, and issue `HttpOnly` and `secure` (in production) cookies.
- **Middleware Safety:** `auth/middleware.js` will verify `JWT_SECRET` but allow bypass in `NODE_ENV=test` environments without process termination.
- **Cookie Parsing:** Manual cookie parsing is enforced (`cookie-parser` is deliberately excluded).

## 5. Resource Limitations
- **VFS Concurrency:** The `VFSContainer` logic uses `pLimit` to limit the queue concurrency and prevent `EMFILE` exhaustion.
- **Caching Strategy:** The backend uses an `LRUCache` within `SharedContext` to cap memory usage for ASTs and files during prolonged multi-agent debates.

## 5. Intelligence Engine
- **Generative AI SDK:** Sole reliance on the native `@google/generative-ai` SDK.
- **Swarm Operations:** Multi-agent routing logic processes requests across specialized agents via `orchestrator/index.js` and `experts.js`.

## 6. Action Plan
- [x] Create this document as the system foundation.
- [ ] Implement `NODE_ENV !== 'test'` bypass for `JWT_SECRET` in `middleware.js`.
- [ ] Remove `dockerode` and local docker references from the backend workspace to strictly enforce the GitHub Actions sandbox strategy.
