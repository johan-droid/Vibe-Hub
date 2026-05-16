# AI Agent Development Guide for Vibe-Hub

This document provides guidance for AI agents working in the current Vibe-Hub workspace. The active repository uses the `apps/server-bridge` and `apps/user-interface` workspaces, Node.js 22.x, and the root scripts in `package.json`.

## Current Workspace Facts

- Server bridge entrypoint: `apps/server-bridge/index.js`
- Orchestrator: `apps/server-bridge/orchestrator/state_machine.js` and `apps/server-bridge/orchestrator/router.js`
- VFS container: `apps/server-bridge/vfs/container.js`
- UI workspace: `apps/user-interface/src/`
- Root commands: `npm run dev`, `npm run validate`, `npm run security:audit`, `npm run test:security`, `npm run release:gate`

## Usage Notes

- Prefer the workspace-specific scripts over invented root commands.
- Treat `/api/code`, `/api/fs/*`, `/api/v6/chat/*`, `/api/v6/preferences/*`, and `/api/v6/mcp/*` as the current high-value surfaces.
- Keep the org and user context boundaries isolated unless you are editing the orchestrator.

## Quick Reference for AI Agents

**Essential Commands:**
```bash
# Start development
npm run dev

# Run tests
npm run test

# Check syntax
node --check <file>

# Lint code
npm run lint
```

**Critical Architecture Rules:**
- ✅ Always use ES modules (`import`/`export`)
- ✅ Include `.js` extensions in relative imports
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Use Docker sandbox for all code execution
- ✅ Enforce language lock (en/hi/or only)

**Key File Locations:**
- Frontend: `apps/user-interface/src/`
- Backend: `apps/server-bridge/src/`
- State Machine: `apps/server-bridge/src/orchestrator/state_machine.js`
- VFS: `apps/server-bridge/src/vfs/container.js`
- API Routes: `apps/server-bridge/src/orchestrator/router.js`

## Project Overview

Vibe-Hub is an agentic coding platform with a strict V6 architectural isolation design. It consists of:

- **Frontend**: React-based UI with Material 3 design (`apps/user-interface/`)
- **Backend**: Node.js server-bridge with XState orchestration (`apps/server-bridge/`)
- **Database**: PostgreSQL with pgvector for semantic memory

## AI Agent Context & Capabilities

### What AI Agents Should Know
1. **This is a V6 Architecture**: Strict separation between org_core and user_env
2. **State-Driven**: All orchestration uses XState with deterministic transitions
3. **Security-First**: Multiple layers including Docker sandboxing and VFS approval gates
4. **AI-Native**: Built specifically for AI agent development workflows

### AI Agent Superpowers in This Codebase
- **Multi-file edits**: Use `multi_edit` for coordinated changes across files
- **Pattern recognition**: Identify architectural patterns and suggest improvements
- **Syntax validation**: Always verify with `node --check` after edits
- **Import resolution**: Automatically handles ES module imports with `.js` extensions
- **Architecture enforcement**: Maintains strict org_core/user_env isolation
- **XState machine design**: Validates state transitions and rollback logic
- **Security review**: Checks for credential exposure, path traversal, unsafe execution
- **Performance analysis**: Identifies blocking operations, suggests async patterns
- **Semantic search**: Uses `grep_search` to find relevant code patterns
- **File tree navigation**: `find_by_name` and `list_dir` for project exploration
- **Memory persistence**: Stores important context across sessions

## V6 Architecture Philosophy

### 1. Strict Context Isolation

The architecture enforces hard boundaries between organizational constraints and user preferences:

```
apps/server-bridge/
├── org_core/          <- CRITICAL: Global, non-negotiable rules
│   ├── context_builder.js      # CI/CD, linting, deployment targets
│   ├── ci_cd_templates/        # Standardized workflows
│   └── global_linting/         # Enforced code standards
│
├── user_env/          <- FLEXIBLE: User preferences
│   ├── context_builder.js      # Language, aesthetics, UI themes
│   └── locales/                # en, hi, or only
│
└── orchestrator/      <- ONLY place allowed to import from both
    ├── state_machine.js        # XState DAG with rollback
    └── router.js               # API endpoints
```

**NEVER** import between `org_core/` and `user_env/`. The orchestrator is the sole integration point.

### 2. Language Lock

User preferences are hard-locked to three languages only:
- `en` (English)
- `hi` (Hindi)
- `or` (Odia)

Any other language request defaults to `en`. This is enforced in `user_env/context_builder.js`.

### 3. Deployment Lock

All deployments must use **local Docker sandbox only**. No cloud deployment is permitted. This is enforced in `org_core/context_builder.js`.

### 4. XState Machine with Rollback

The orchestrator uses a deterministic state machine:

```
idle → loading_contexts → parsing_ast → drafting_code → sandboxing
                                              ↑              ↓
                                              └── rollback ←─┘
                                                      ↓ (after 3 failures)
                                                evaluating_failure
```

**Antigravity Mechanism**: After 3 failed sandbox attempts, the machine injects:
```
SYSTEM OVERRIDE: Your previous architectural approach failed completely 
with error: {error}. Do NOT retry the same logic. Pivot to a completely 
different design pattern.
```

### 5. AST-First Code Analysis

Vector embeddings are deprecated. The system uses tree-sitter for deterministic code analysis:

```javascript
// memory/loader.js - SemanticGraphBuilder
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

// Extracts exact imports/exports, not fuzzy matches
const graph = await semanticGraphBuilder.buildSemanticGraph(filePath);
// Returns: { strict_imports, strict_exports, internal_functions, ast_node_count }
```

### 6. Docker Sandbox Execution

All generated code runs in ephemeral Alpine containers:

```javascript
// sandbox/docker_executor.js - SandboxExecutor
const result = await SandboxExecutor.executeLocalDockerSandbox(codeToTest);
// 10-second timeout, --network none, auto-cleanup
```

## Code Style Guidelines

### Module System
- **Always use ES modules** (`"type": "module"` in package.json)
- Use `import`/`export` syntax
- For `__dirname` in ES modules: `const __dirname = path.dirname(fileURLToPath(import.meta.url));`

### Naming Conventions
- Use `snake_case` for database fields and JSON keys
- Use `camelCase` for JavaScript variables and functions
- Use `PascalCase` for classes and components
- Use `UPPER_SNAKE_CASE` for constants and environment variables

### Error Handling
- Always include descriptive error messages
- Use try/catch for async operations
- Clean up resources in `finally` blocks

### Comments
- Use `//` for inline comments
- Use `/* */` for block comments on functions
- Include JSDoc for public APIs

## Security Guidelines

1. **Never hardcode credentials** — use environment variables
2. **Always validate user input** at API boundaries
3. **Use parameterized queries** for database operations
4. **Sanitize file paths** to prevent directory traversal
5. **Docker containers run with `--network none'`** to prevent external calls

## Testing

- Run tests with: `npm test` (Vitest)
- Syntax check: `node --check <file>`
- All code must pass linter rules defined in `org_core/global_linting/rules.json`

## Common Tasks for AI Agents

### Adding a New API Endpoint

```javascript
// In orchestrator/router.js or appropriate feature file
app.post('/api/feature/action', requireAuth, async (req, res) => {
  try {
    const result = await performAction(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Adding a New Context Rule

**For organizational rules** (all users must follow):
- Add to `org_core/context_builder.js`
- Update `org_core/ci_cd_templates/` or `org_core/global_linting/`

**For user preferences** (individual settings):
- Add to `user_env/context_builder.js`
- Update `user_env/aesthetics/` or `user_env/locales/`

### Debugging the State Machine

The machine logs all transitions:
```
Agent Status: transitioned to [loading_contexts]
Agent Status: transitioned to [parsing_ast]
Agent Status: transitioned to [drafting_code]
```

Monitor these to trace execution flow.

### File Navigation Patterns

```bash
# Find all JavaScript files in a directory
find_by_name SearchDirectory="apps/server-bridge/src" Pattern="**/*.js"

# Search for specific patterns in code
grep_search SearchPath="apps/server-bridge/src" Query="import.*from.*org_core"

# List directory structure
list_dir DirectoryPath="apps/server-bridge/src/orchestrator"
```

### Code Quality Checks

```bash
# Always run after making changes
node --check apps/server-bridge/src/orchestrator/state_machine.js

# Run linting
npm run lint

# Run tests
npm run test
```

## Environment Variables

Critical variables (must be in `.env.production`):
```
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
JWT_SECRET=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_SECRET=...
UI_ORIGIN=https://your-frontend-url.com
```

## Deployment Checklist

Before committing changes:
- [ ] Code passes `node --check` syntax validation
- [ ] No `require()` in new files (use `import`)
- [ ] No `module.exports` (use `export`)
- [ ] No cross-imports between `org_core/` and `user_env/`
- [ ] Docker sandbox used for all code execution
- [ ] Language restrictions enforced (en/hi/or only)

## Troubleshooting

**"Cannot use import statement outside a module"**
→ Check `package.json` has `"type": "module"`

**"MODULE_NOT_FOUND" for local files**
→ Ensure file extensions included: `import x from './file.js'`

**Docker sandbox fails**
→ Verify Docker Desktop is running locally
→ Check container logs with `docker logs <container>`

**State machine stuck in loop**
→ Check `maxRetries` limit (default: 3)
→ Review rollback prompt injection in logs

## Codex Skills & Capabilities

When working with Codex on this codebase, leverage these specific capabilities:

### 1. Code Generation & Editing
- **Multi-file edits** — Use `multi_edit` for coordinated changes across files
- **Pattern recognition** — Codex identifies architectural patterns and suggests improvements
- **Syntax validation** — Always verify with `node --check` after edits
- **Import resolution** — Automatically handles ES module imports with `.js` extensions

### 2. Architecture & Planning
- **V6 Architecture enforcement** — Codex maintains strict org_core/user_env isolation
- **XState machine design** — Validates state transitions and rollback logic
- **Security review** — Checks for credential exposure, path traversal, unsafe execution
- **Performance analysis** — Identifies blocking operations, suggests async patterns

### 3. Debugging & Troubleshooting
- **Log analysis** — Parse deployment logs, identify root causes
- **Error pattern matching** — Maps errors to known issues (e.g., ES module vs CommonJS)
- **Rollback detection** — Recognizes when antigravity mechanism triggers

### 4. Context Management
- **Semantic search** — Uses `code_search` and `grep_search` to find relevant code
- **File tree navigation** — `find_by_name` and `list_dir` for project exploration
- **Memory persistence** — Stores important context across sessions

### 5. Integration & Deployment
- **Git operations** — Commits with descriptive messages, handles push to origin
- **Package management** — Installs dependencies, audits for vulnerabilities
- **Render deployment** — Monitors build logs, identifies deployment failures

## Key Reminders for AI Agents
- Always use **ES modules** (`import`/`export`) — never CommonJS in this codebase
- Always include **`.js` extension** in relative imports
- Never **cross-import** between `org_core/` and `user_env/`
- Always **enforce language lock** (en/hi/or only)
- Always **use Docker sandbox** for code execution
- **WebSocket streaming** via Socket.io for XState transitions
- **VFS approval gates** before committing any files to disk
- **State machine determinism** - all transitions must be predictable
- **Security-first approach** - validate all inputs and sanitize paths

## Architecture Decisions

1. **Why XState?** — Deterministic state management with rollback capability
2. **Why AST over vectors?** — Eliminates hallucinations in code dependencies
3. **Why Docker sandbox?** — Offline execution, prevents malicious code
4. **Why strict isolation?** — Prevents org constraints from bleeding into user prefs

## Contact & Resources

- Repository: https://github.com/johan-droid/Vibe-Hub
- Render deployment: Check dashboard for live logs
- Database: PostgreSQL via connection string in env

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
4. **Documentation** - Update relevant markdown files if needed
