# AI Agent Development Guide for Vibe-Hub

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Purpose:** Comprehensive vibecoding instructions for AI agents

---

## Quick Reference for AI Agents

### Essential Commands
```bash
# Start development
npm run dev

# Validate syntax
node --check <file>

# Run tests
npm run test

# Check linting
npm run lint

# Build for production
npm run build
```

### Critical Architecture Rules
- ✅ Always use ES modules (`import`/`export`)
- ✅ Include `.js` extensions in relative imports
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Use Docker sandbox for all code execution
- ✅ Enforce language lock (en/hi/or only)
- ✅ Follow V6 isolation principles

### Key File Locations
- **State Machine**: `apps/server-bridge/src/orchestrator/state_machine.js`
- **VFS Container**: `apps/server-bridge/src/vfs/container.js`
- **API Router**: `apps/server-bridge/src/orchestrator/router.js`
- **LLM Client**: `apps/server-bridge/src/orchestrator/llm_client.js`
- **Docker Sandbox**: `apps/server-bridge/src/sandbox/docker_executor.js`
- **Frontend**: `apps/user-interface/src/`

---

## AI Agent Development Workflow

### Phase 1: Code Analysis & Understanding

#### 1.1 Read Existing Code
```bash
# Use read_file tool to understand implementation
read_file file_path="apps/server-bridge/src/orchestrator/state_machine.js"

# Read multiple files in parallel
read_file file_path="apps/server-bridge/src/vfs/container.js"
read_file file_path="apps/server-bridge/src/orchestrator/router.js"
```

#### 1.2 Search for Patterns
```bash
# Find similar implementations
grep_search SearchPath="apps/server-bridge/src" Query="import.*from.*org_core"

# Find state machine patterns
grep_search SearchPath="apps/server-bridge/src" Query="createMachine"

# Find VFS operations
grep_search SearchPath="apps/server-bridge/src" Query="stageFile|approveFile|commitToDisk"
```

#### 1.3 Explore Project Structure
```bash
# List directory contents
list_dir DirectoryPath="apps/server-bridge/src/orchestrator"

# Find specific file types
find_by_name SearchDirectory="apps/server-bridge/src" Pattern="**/*.js"

# Find test files
find_by_name SearchDirectory="tests" Pattern="**/*.test.js"
```

### Phase 2: Implementation

#### 2.1 Use Multi-Edit for Coordinated Changes
```javascript
// Example: Adding new API endpoint
// Use multi_edit tool for related changes across files

// 1. Add route to router.js
app.post('/api/feature/new-endpoint', requireAuth, async (req, res) => {
  try {
    const result = await performNewFeature(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Add handler function
async function performNewFeature(data) {
  // Implementation logic
}

// 3. Update API documentation
// Add endpoint to API_SPECIFICATION.md
```

#### 2.2 Follow V6 Architecture Rules
```javascript
// ✅ CORRECT: Isolated imports
import { contextBuilder } from '../org_core/context_builder.js';
import { userPreferences } from '../user_env/context_builder.js';

// ❌ WRONG: Cross-import between org_core and user_env
import { userPreferences } from '../user_env/context_builder.js'; // From org_core file
```

#### 2.3 Implement State Machine Changes
```javascript
// Add new state to XState machine
const agentMachine = createMachine({
  id: 'agent',
  initial: 'idle',
  states: {
    idle: {
      on: { START_TASK: 'loading_contexts' }
    },
    loading_contexts: {
      invoke: {
        src: 'fetchIsolatedContexts',
        onDone: { target: 'parsing_ast' },
        onError: { target: 'fatal_failure' }
      }
    },
    // Add new state here
    new_state: {
      invoke: {
        src: 'performNewOperation',
        onDone: { target: 'success' },
        onError: { target: 'rollback' }
      }
    },
    // ... existing states
  }
});
```

### Phase 3: Validation & Testing

#### 3.1 Syntax Validation
```bash
# Check all modified files
node --check apps/server-bridge/src/orchestrator/state_machine.js
node --check apps/server-bridge/src/vfs/container.js
node --check apps/server-bridge/src/orchestrator/router.js
```

#### 3.2 Architecture Validation
```bash
# Check for V6 violations
grep_search SearchPath="apps/server-bridge/src" Query="import.*user_env.*org_core"
grep_search SearchPath="apps/server-bridge/src" Query="require\("
grep_search SearchPath="apps/server-bridge/src" Query="module\.exports"
```

#### 3.3 Run Tests
```bash
# Run all tests
npm run test

# Run specific test file
npm test -- tests/unit/backend/state-machine.test.js

# Run tests with coverage
npm run test:coverage
```

#### 3.4 Lint Check
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Phase 4: Documentation

#### 4.1 Update API Documentation
```markdown
# Add to docs/API_SPECIFICATION.md
#### New Feature Endpoint
```http
POST /api/feature/new-endpoint
```

**Request Body:**
```json
{
  "param1": "value1",
  "param2": "value2"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "result": "operation completed" }
}
```
```

#### 4.2 Update Architecture Documentation
```markdown
# Add to docs/TECHNICAL_ARCHITECTURE.md
### New Feature Component
- **Purpose**: Describe what the feature does
- **Location**: `apps/server-bridge/src/features/new_feature.js`
- **Dependencies**: List dependencies
- **Security**: Any security considerations
```

---

## AI Agent Best Practices

### Before Making Changes
1. **Read existing code** - Use `read_file` to understand current implementation
2. **Check architecture** - Verify V6 isolation rules are followed
3. **Search patterns** - Use `grep_search` to find similar implementations
4. **Validate syntax** - Run `node --check` before committing

### During Development
1. **Use multi_edit** - Make coordinated changes across multiple files
2. **Test incrementally** - Run `npm test` after significant changes
3. **Monitor state machine** - Watch XState transitions in logs
4. **Security review** - Check for credential exposure, path traversal

### After Changes
1. **Syntax validation** - `node --check` all modified files
2. **Lint checking** - `npm run lint` to ensure code quality
3. **Test suite** - `npm run test` to verify functionality
4. **Documentation** - Update relevant markdown files

---

## Common AI Agent Tasks

### Adding New API Endpoint
```javascript
// 1. Add route to orchestrator/router.js
app.post('/api/feature/action', requireAuth, async (req, res) => {
  try {
    const result = await performAction(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Add handler function
async function performAction(data) {
  // Validate input
  const validatedData = actionSchema.parse(data);
  
  // Perform business logic
  const result = await businessLogic(validatedData);
  
  return result;
}

// 3. Add tests
test('API endpoint works correctly', async () => {
  const response = await request(app)
    .post('/api/feature/action')
    .set('Authorization', 'Bearer valid-token')
    .send({ param: 'value' });
    
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
});
```

### Modifying State Machine
```javascript
// Add new state to existing machine
const newMachine = createMachine({
  // ... existing configuration
  states: {
    // ... existing states
    processing_data: {
      invoke: {
        src: 'processData',
        onDone: { target: 'success' },
        onError: { target: 'rollback' }
      }
    }
  }
});

// Add new service function
async function processData(context) {
  // Process data logic
  return processedData;
}
```

### Working with VFS
```javascript
// Stage a file for review
const fileId = await vfs.stageFile(
  'src/components/NewComponent.jsx',
  originalContent,
  proposedContent
);

// Add metadata
await vfs.addMetadata(fileId, {
  retries: 0,
  sandboxPassed: false,
  createdAt: new Date().toISOString()
});

// Approve file (user action)
await vfs.approveFile(fileId);

// Commit to disk
await vfs.commitToDisk(fileId);
```

### Docker Sandbox Integration
```javascript
// Execute code in sandbox
const result = await SandboxExecutor.executeLocalDockerSandbox({
  code: generatedCode,
  timeout: 10000,
  memory: '256m',
  network: 'none'
});

// Handle results
if (result.success) {
  // Code passed sandbox testing
  await vfs.updateMetadata(fileId, { sandboxPassed: true });
} else {
  // Code failed, trigger rollback
  throw new Error(`Sandbox failed: ${result.error}`);
}
```

---

## Troubleshooting Guide for AI Agents

### Common Issues

#### Syntax Errors
```bash
# Check syntax
node --check <file>

# Common syntax issues:
# - Missing .js extension in imports
# - Using require() instead of import
# - Missing semicolons in strict mode
```

#### V6 Architecture Violations
```bash
# Check for cross-imports
grep_search SearchPath="apps/server-bridge/src" Query="import.*user_env.*org_core"
grep_search SearchPath="apps/server-bridge/src" Query="import.*org_core.*user_env"

# Check for CommonJS
grep_search SearchPath="apps/server-bridge/src" Query="require\("
grep_search SearchPath="apps/server-bridge/src" Query="module\.exports"
```

#### Test Failures
```bash
# Run specific test file
npm test -- tests/unit/backend/state-machine.test.js

# Run tests in verbose mode
npm test -- --verbose

# Check test coverage
npm run test:coverage
```

#### Docker Sandbox Issues
```bash
# Check Docker status
docker --version
docker info

# Check container logs
docker logs <container-id>

# Clean up containers
docker system prune -f
```

### Debug Commands
```bash
# Monitor state machine transitions
tail -f logs/agent.log | grep "Agent Status"

# Check VFS staging area
curl -H "Authorization: Bearer <token>" \
     http://localhost:3001/api/vfs/pending

# Monitor WebSocket events
# Connect to WebSocket and watch for events
socket.on('agent_status', (data) => {
  console.log('State:', data.status, 'Message:', data.message);
});
```

---

## Security Considerations for AI Agents

### Input Validation
```javascript
// Always validate inputs with Zod schemas
const promptSchema = z.object({
  message: z.string().max(1000).min(1),
  context: z.object({
    language: z.enum(['en', 'hi', 'or']),
    effort: z.enum(['minimal', 'standard', 'thorough'])
  }).optional()
});

// Validate before processing
const validatedData = promptSchema.parse(input);
```

### Path Sanitization
```javascript
// Prevent path traversal attacks
function sanitizePath(filePath) {
  // Remove directory traversal patterns
  const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '');
  
  // Validate path format
  if (!/^[\w\-./]+$/.test(sanitized)) {
    throw new Error('Invalid file path');
  }
  
  return sanitized;
}
```

### Credential Protection
```javascript
// Never hardcode credentials
// Use environment variables
const config = {
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  jwtSecret: process.env.JWT_SECRET
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'GEMINI_API_KEY', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

---

## Performance Optimization for AI Agents

### Code Optimization
```javascript
// Use async/await properly
async function processMultipleFiles(files) {
  // Process files in parallel
  const results = await Promise.all(
    files.map(file => processFile(file))
  );
  
  return results;
}

// Use caching for expensive operations
const cache = new Map();
async function getCachedData(key) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetchData(key);
  cache.set(key, data);
  return data;
}
```

### Database Optimization
```javascript
// Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use prepared statements
const query = 'SELECT * FROM users WHERE id = $1';
const result = await pool.query(query, [userId]);
```

### Memory Management
```javascript
// Clean up resources
function cleanup() {
  // Close database connections
  if (pool) pool.end();
  
  // Clear caches
  cache.clear();
  
  // Remove event listeners
  process.removeListener('SIGINT', cleanup);
  process.removeListener('SIGTERM', cleanup);
}

// Register cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

---

## Conclusion

This guide provides AI agents with comprehensive instructions for working with the Vibe-Hub codebase. By following these guidelines, AI agents can:

1. **Understand the architecture** quickly and efficiently
2. **Make changes safely** following V6 isolation principles
3. **Test thoroughly** using the provided test suite
4. **Debug effectively** using the troubleshooting guide
5. **Maintain security** through proper validation and sanitization

The key to successful vibecoding is understanding the V6 architecture principles and following the established patterns and conventions outlined in this guide.

---

**Additional Resources:**
- [AGENTS.md](./AGENTS.md) - Core agent guidance
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) - Detailed architecture
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) - API documentation
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) - Development environment setup
