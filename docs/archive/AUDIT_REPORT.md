# Vibe Hub Architecture Audit Report

## Executive Summary

This audit examines the Vibe Hub agent architecture across four critical domains:
1. **Orchestrator & Model Routing** - Brain of the agent
2. **Context Protocol & Memory** - MCP and memory loader
3. **Sandboxing & Code Execution** - Security isolation
4. **API & Real-time Sync** - Communication layer

---

## 1. Orchestrator & Model Routing (`orchestrator/`)

### ✅ Strengths

#### Router Architecture (`router.js`)
- **Hybrid L1/L2 routing**: Fast regex matching (L1) with LLM fallback (L2) is excellent for latency
- **Google Generative AI SDK**: Already using native `@google/generative-ai` SDK - this is correct
- **Domain coverage**: Comprehensive domains (git, debug, ui, code, manager, security, creative)

#### Expert System (`experts.js`, `expert-base.js`)
- **Specialized experts**: Well-defined expert roles with clear domain instructions
- **ReAct loop implementation**: Proper thought-action-observation cycle
- **History compression**: Neural context summarization prevents token overflow
- **Multi-agent debate**: Peer reviewer expert for quality control

#### Skill System (`skill-loader.js`, `skills/*.md`)
- **Token budgeting**: Excellent effort-level system (quick/standard/deep)
- **Priority-based loading**: Core → Memory → Domain skills → Stack-specific
- **Skill caching**: Avoids repeated file reads

### ⚠️ Critical Issues

#### 1.1 Model Service Not Using Native SDK Features (`models.js`)

**Current State:**
```javascript
// models.js uses legacy OpenAI-compatible wrapper endpoint
const response = await fetch(`${this.endpoint}/chat/completions`, {
  model, messages, max_tokens
});
```

**Problem:** 
- Not leveraging Google Generative AI SDK's native features
- Missing: structured JSON outputs, tool-calling, massive context windows
- GitHub Models endpoint doesn't support Gemini's advanced capabilities

**Recommendation:**
```javascript
// Migrate to native GoogleGenerativeAI SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

async function chat(installationId, { model = 'gemini-2.0-flash', messages, tools }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({
    model,
    tools: tools ? [{ functionDeclarations: tools }] : undefined,
    generationConfig: {
      responseMimeType: 'application/json', // For structured outputs
    },
  });
  
  // Leverage 1M+ token context window
  const result = await geminiModel.generateContent(messages);
  return result.response;
}
```

#### 1.2 Context Loss Between Experts (`expert-base.js`)

**Current State:**
```javascript
// History is instance-level, not shared
export class EmployeeBase {
  constructor(modelName = 'gemini-2.0-flash') {
    this.history = []; // Each expert has isolated history
    this.historyLimit = 12;
  }
}
```

**Problem:**
- When task hands off from "planning" expert to "react" expert, AST and file context are NOT passed by reference
- Each expert maintains separate conversation history
- No unified state management across expert transitions

**Recommendation:**
```javascript
// Create shared context store
export class SharedContext {
  constructor() {
    this.astCache = new Map(); // path -> AST
    this.fileCache = new Map(); // path -> content
    this.conversationState = {
      currentTask: null,
      completedSteps: [],
      pendingActions: [],
      decisions: [],
    };
  }
  
  // Pass by reference, not raw text
  getAST(path) { return this.astCache.get(path); }
  setAST(path, ast) { this.astCache.set(path, ast); }
}

// Update expert-base to accept shared context
async execute(prompt, systemPrompt, ..., sharedContext) {
  // Access shared AST and file context
  const ast = sharedContext.getAST(targetFile);
}
```

#### 1.3 Skills as Markdown Files (`skills/*.md`)

**Current State:**
- Skills stored as unstructured Markdown files
- Loaded via `readFileSync(join(SKILLS_DIR, `${name}.md`))`

**Problem:**
- Markdown allows hallucination-friendly free-form text
- No schema validation for skill definitions
- Difficult to version control skill changes deterministically

**Recommendation:**
```javascript
// Transition to structured JSON schemas
// skills/react.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "skillName": "react",
  "version": "1.0.0",
  "systemPrompt": {
    "role": "React Component Specialist",
    "rules": [
      {
        "id": "R001",
        "priority": "critical",
        "description": "Always use functional components with hooks",
        "pattern": "class.*extends.*Component",
        "action": "reject_and_refactor"
      }
    ],
    "toolProfiles": {
      "edit_file": {
        "preConditions": ["file_must_exist", "must_read_first"],
        "postConditions": ["verify_syntax", "check_imports"]
      }
    }
  }
}
```

---

## 2. Context Protocol & Memory (`mcp-server.js` & `memory/loader.js`)

### ✅ Strengths

#### MCP Server (`mcp-server.js`)
- **MCP SDK usage**: Correctly imports from `@modelcontextprotocol/sdk`
- **Tool exposure**: Properly defines tools with input schemas
- **Stdio transport**: Appropriate for local MCP communication

#### Memory Loader (`loader.js`)
- **Dual memory system**: User memory + brain journal separation
- **Auto-compaction**: Journal compacts at 50 entries → 30 entries
- **PostgreSQL storage**: Persistent cross-session memory

### ⚠️ Critical Issues

#### 2.1 MCP Specification Compliance (`mcp-server.js`)

**Current State:**
```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'vibe_search_symbols',
      inputSchema: { type: 'OBJECT', properties: {...} } // ❌ Wrong format
    }]
  };
});
```

**Problem:**
- Input schema uses custom `{ type: 'OBJECT' }` instead of JSON Schema
- MCP specification requires standard JSON Schema format
- Virtual File System (VFS) exposure is incomplete

**Recommendation:**
```javascript
// Fix input schemas to match JSON Schema specification
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: 'vibe_read_file',
      description: 'Read a file from the virtual file system',
      inputSchema: {
        type: 'object', // lowercase, JSON Schema compliant
        properties: {
          path: { 
            type: 'string',
            description: 'File path relative to workspace root'
          }
        },
        required: ['path']
      }
    }],
    // Expose VFS resources
    resources: [{
      uri: 'vfs:///',
      name: 'Virtual File System Root',
      mimeType: 'application/x-vfs-directory'
    }]
  };
});
```

#### 2.2 Memory Loader Lacks Semantic Retrieval (`loader.js`)

**Current State:**
```javascript
export async function loadMemory(userId, projectName) {
  const result = await pool.query(
    'SELECT user_memory, brain_journal FROM project_memory WHERE ...'
  );
  // Returns entire memory blob - no intelligent retrieval
}
```

**Problem:**
- Dumps whole files into prompt window
- No semantic chunking or vector retrieval
- No AST-based grep searching optimization
- Token-inefficient for large projects

**Recommendation:**
```javascript
// Implement semantic chunking + vector retrieval
import { PgVector } from 'pgvector';

export async function loadMemory(userId, projectName, query, options = {}) {
  const { limit = 5, similarityThreshold = 0.7 } = options;
  
  if (options.useSemanticSearch && query) {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    
    // Vector similarity search
    const result = await pool.query(`
      SELECT chunk_content, similarity 
      FROM memory_chunks 
      WHERE user_id = $1 
        AND project_name = $2
        AND embedding <=> $3 < $4
      ORDER BY embedding <=> $3
      LIMIT $5
    `, [userId, projectName, queryEmbedding, 1 - similarityThreshold, limit]);
    
    return result.rows.map(r => r.chunk_content);
  }
  
  // Fallback: AST-based indexed search
  if (options.useASTIndex) {
    return await astBasedSearch(projectName, query);
  }
  
  // Legacy full-load (discouraged)
  return { userMemory: null, brainJournal: [] };
}

// Semantic chunking on save
export async function saveUserMemory(userId, projectName, content) {
  const chunks = semanticChunk(content, {
    maxChunkSize: 512, // tokens
    overlap: 50,
    chunkBy: ['paragraph', 'code-block', 'section']
  });
  
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    await pool.query(`
      INSERT INTO memory_chunks (user_id, project_name, chunk_content, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, project_name, chunk_hash) DO UPDATE
      SET chunk_content = EXCLUDED.chunk_content, embedding = EXCLUDED.embedding
    `, [userId, projectName, chunk.text, embedding]);
  }
}
```

---

## 3. Sandboxing & Code Execution (`sandbox/` & `creative/`)

### ✅ Strengths

#### Security Sandbox (`security-sandbox.js`)
- **Docker isolation**: Uses Docker containers for execution isolation
- **Network isolation**: `NetworkMode: 'none'` prevents external access
- **Read-only mount**: Project mounted as read-only (`:ro`)
- **UUID-based tracking**: Proper sandbox lifecycle management

#### Dockerfile.security
- **Security tools pre-installed**: Semgrep, sqlmap, OWASP ZAP
- **Minimal base image**: Ubuntu 22.04 with only necessary packages
- **Non-interactive mode**: Prevents apt prompts

### ⚠️ Critical Issues

#### 3.1 Missing Resource Limits (`security-sandbox.js`)

**Current State:**
```javascript
const container = await docker.createContainer({
  Image: SECURITY_IMAGE,
  HostConfig: {
    Binds: [`${path.resolve(repoPath)}:/workspace:ro`],
    NetworkMode: 'none',
    // ❌ NO memory limits
    // ❌ NO CPU limits
    // ❌ NO timeout configuration
  },
});
```

**Problem:**
- Runaway infinite loops can crash host server
- No memory limits → OOM kills possible
- No CPU quotas → single sandbox can monopolize resources
- No execution timeouts → commands can hang indefinitely

**Recommendation:**
```javascript
const container = await docker.createContainer({
  Image: SECURITY_IMAGE,
  HostConfig: {
    Binds: [`${path.resolve(repoPath)}:/workspace:ro`],
    NetworkMode: 'none',
    
    // Memory limits (critical!)
    Memory: 512 * 1024 * 1024, // 512MB hard limit
    MemorySwap: 512 * 1024 * 1024, // Disable swap
    MemoryReservation: 256 * 1024 * 1024, // Soft limit
    
    // CPU limits
    NanoCpus: 500000000, // 0.5 CPU cores
    CpuPeriod: 100000,
    CpuQuota: 50000,
    
    // Process limits
    PidsLimit: 50, // Max 50 processes
    
    // Security options
    SecurityOpt: [
      'no-new-privileges:true',
      'apparmor=docker-default'
    ],
    
    // Read-only root filesystem
    ReadonlyRootfs: true,
    
    // Temporary writable directories
    Tmpfs: {
      '/tmp': 'rw,noexec,nosuid,size=100m',
      '/var/tmp': 'rw,noexec,nosuid,size=50m'
    }
  },
  
  // Environment restrictions
  Env: [
    'NODE_ENV=production',
    'NPM_CONFIG_CACHE=/tmp/npm-cache'
  ]
});

// Add command execution timeout
async exec(sandboxId, command, timeoutMs = 30000) {
  const exec = await container.exec({ /* ... */ });
  const stream = await exec.start({ Detach: false, Tty: false });
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stream.destroy();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    let output = '';
    stream.on('data', (chunk) => output += chunk.toString());
    stream.on('end', () => {
      clearTimeout(timeout);
      resolve(output);
    });
    stream.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
```

#### 3.2 Token Handling Security (`github/security.js`)

**Current State:**
```javascript
async create(installationId, { owner, repo, ref, profile = 'standard' }) {
  const sandbox = await githubService.createCodespace(installationId, { /* ... */ });
  // Token handling not visible in this file
}
```

**Problem:**
- Need to verify tokens are handled in-memory only
- Must ensure tokens never written to disk
- GitHub App tokens must be rotated per-session

**Recommendation:**
```javascript
// github/security.js - Secure token handling
import crypto from 'crypto';

export class SecuritySandboxService {
  // Store tokens in volatile memory only (Map, not database)
  #ephemeralTokens = new Map();
  
  async create(installationId, { owner, repo, ref }) {
    // Generate short-lived session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
    
    // Get installation token (in-memory only)
    const octokit = await githubService.getInstallationClient(installationId);
    const { token } = await octokit.auth({ type: 'installation' });
    
    // Store in volatile memory
    this.#ephemeralTokens.set(sessionToken, {
      token,
      expiresAt,
      installationId
    });
    
    // Schedule automatic cleanup
    setTimeout(() => {
      this.#ephemeralTokens.delete(sessionToken);
    }, 16 * 60 * 1000);
    
    // Pass token via environment variable (never disk)
    const container = await docker.createContainer({
      Env: [
        `GITHUB_TOKEN=${token}`, // Injected at runtime
        `TOKEN_EXPIRES_AT=${expiresAt}`
      ],
      // ... rest of config
    });
    
    return { sandboxId: sessionToken, status: 'provisioning' };
  }
  
  // Token rotation on each exec
  async exec(sandboxId, command) {
    const tokenData = this.#ephemeralTokens.get(sandboxId);
    if (!tokenData || Date.now() > tokenData.expiresAt) {
      throw new Error('Session token expired');
    }
    
    // Rotate token if nearing expiration
    if (Date.now() > tokenData.expiresAt - (5 * 60 * 1000)) {
      await this.rotateToken(sandboxId, tokenData.installationId);
    }
    
    // Execute with fresh token
    // ...
  }
}
```

---

## 4. API & Real-time Sync (`index.js` & `db.js`)

### ✅ Strengths

#### WebSocket Implementation (`index.js`)
- **WebSocket server**: Using `ws` library for real-time communication
- **Session management**: Proper session tracking with UUID
- **Bidirectional communication**: Tool requests/responses via WebSocket
- **Authentication**: Token-based WebSocket authentication

#### Database Layer (`db.js`)
- **Connection pooling**: Using `pg.Pool` for efficient connections
- **SSL in production**: Proper SSL configuration
- **Schema design**: Appropriate tables for users, sessions, memory

### ⚠️ Critical Issues

#### 4.1 Mixed HTTP/WebSocket Architecture (`index.js`)

**Current State:**
```javascript
// index.js - REST endpoints alongside WebSocket
app.post('/api/copilot/chat', async (req, res) => {
  // Standard HTTP request - will timeout on long operations
  res.json({ choices: [...] });
});

// WebSocket for agent sessions
wss.on('connection', (ws, req) => {
  ws.on('message', async (raw) => {
    // Agent execution happens here
    const result = await orchestrator.handlePrompt(prompt, ...);
  });
});
```

**Problem:**
- `/api/copilot/chat` uses synchronous HTTP - will timeout for long refactors
- No streaming support for HTTP endpoints
- Client must poll or maintain WebSocket for all agent interactions
- Inconsistent API patterns

**Recommendation:**
```javascript
// Option 1: Convert all agent endpoints to Server-Sent Events (SSE)
app.get('/api/agent/stream', requireAuth, async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sessionId = uuid();
  const orchestrator = new AgentOrchestrator();
  
  // Stream events to client
  const emitEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    const result = await orchestrator.handlePrompt(
      req.query.prompt,
      'standard',
      async (toolName, args) => {
        emitEvent('tool_call', { name: toolName, args });
        // Wait for client response via separate channel
        return await waitForToolResponse(sessionId, toolName);
      },
      (thought) => emitEvent('thought', { message: thought }),
      // ... other callbacks
    );
    
    emitEvent('complete', { result });
  } catch (error) {
    emitEvent('error', { message: error.message });
  } finally {
    res.end();
  }
});

// Option 2: Full WebSocket migration (preferred for Vibe Hub)
// Remove REST endpoints for agent operations entirely
// All agent communication via WebSocket with structured message types

// Enhanced WebSocket message protocol
ws.on('message', async (raw) => {
  const msg = JSON.parse(raw);
  
  switch (msg.type) {
    case 'agent_execute': {
      // Start agent execution with streaming
      const executionId = uuid();
      
      // Send immediate acknowledgment
      ws.send(JSON.stringify({
        type: 'execution_started',
        executionId,
        estimatedDuration: estimateComplexity(msg.prompt)
      }));
      
      // Execute with real-time streaming
      const result = await orchestrator.handlePrompt(
        msg.prompt,
        msg.effortLevel,
        async (toolName, args) => {
          // Stream tool calls immediately
          ws.send(JSON.stringify({
            type: 'tool_call',
            executionId,
            callId: uuid(),
            name: toolName,
            args
          }));
          // Wait for response...
        },
        (thought) => {
          ws.send(JSON.stringify({
            type: 'thought',
            executionId,
            message: thought
          }));
        },
        // ... other callbacks
      );
      
      // Final result
      ws.send(JSON.stringify({
        type: 'execution_complete',
        executionId,
        result
      }));
      break;
    }
  }
});
```

#### 4.2 Database Connection Resilience (`db.js`)

**Current State:**
```javascript
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS ...`);
}
```

**Problem:**
- No connection retry logic
- No pool error handling
- No graceful degradation when DB unavailable
- Silent failure in `index.js`: `console.warn('[DB] PostgreSQL not available')`

**Recommendation:**
```javascript
import pg from 'pg';
import { EventEmitter } from 'events';

class ResilientPool extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.pool = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start at 1s, exponential backoff
    
    this.initialize();
  }
  
  async initialize() {
    try {
      this.pool = new pg.Pool({
        ...this.config,
        // Connection resilience
        max: 20, // Max clients in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        
        // Pool error handling
        allowExitOnIdle: false,
      });
      
      // Test connection
      await this.pool.query('SELECT NOW()');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      console.log('[DB] PostgreSQL connected successfully');
      
      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('[DB] Unexpected pool error:', err);
        this.isConnected = false;
        this.scheduleReconnect();
      });
      
    } catch (err) {
      console.error('[DB] Connection failed:', err.message);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('failed', new Error('Max reconnect attempts reached'));
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[DB] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.initialize(), delay);
  }
  
  async query(...args) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool.query(...args);
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
    }
  }
}

// Usage
const resilientPool = new ResilientPool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default resilientPool;
```

---

## Priority Action Items

### 🔴 Critical (Fix Immediately)

1. **Add resource limits to Docker sandbox** - Prevent server crashes from runaway code
2. **Implement secure token handling** - Ensure GitHub tokens never touch disk
3. **Fix MCP input schemas** - Comply with JSON Schema specification
4. **Add command execution timeouts** - Prevent hanging operations

### 🟡 High Priority (Next Sprint)

5. **Migrate models.js to native Google SDK** - Unlock structured outputs, tool-calling
6. **Implement shared context between experts** - Prevent context loss on handoffs
7. **Add semantic memory retrieval** - Replace full-file dumps with vector search
8. **Convert REST endpoints to SSE/WebSocket** - Eliminate timeout issues

### 🟢 Medium Priority (Future Enhancement)

9. **Convert skills to JSON schemas** - Reduce hallucination risk
10. **Add database connection resilience** - Graceful degradation
11. **Implement AST caching** - Faster context switching
12. **Add streaming responses** - Better UX for long operations

---

## Conclusion

The Vibe Hub architecture demonstrates strong foundational design with several production-ready patterns:
- ✅ Hybrid routing for low-latency expert selection
- ✅ Multi-agent debate for quality control
- ✅ WebSocket-based real-time communication
- ✅ Docker-based sandbox isolation

However, critical gaps exist in:
- ❌ Resource limits and security hardening
- ❌ Context preservation across expert transitions
- ❌ Semantic memory retrieval efficiency
- ❌ Native SDK feature utilization

Addressing the critical and high-priority items will bring Vibe Hub closer to production-grade reliability while maintaining its unique multi-agent swarm architecture.
