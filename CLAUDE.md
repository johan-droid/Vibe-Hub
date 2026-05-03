# Claude Instructions for Vibe-Hub

This document provides guidance for Claude when working with the Vibe-Hub codebase.

## Project Overview

Vibe-Hub is an agentic coding platform with a strict architectural isolation design. It consists of:

- **Frontend**: React-based UI with Material 3 design (`apps/user-interface/`)
- **Backend**: Node.js server-bridge with XState orchestration (`apps/server-bridge/`)
- **Database**: PostgreSQL with pgvector for semantic memory

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

## Common Tasks

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

## Architecture Decisions

1. **Why XState?** — Deterministic state management with rollback capability
2. **Why AST over vectors?** — Eliminates hallucinations in code dependencies
3. **Why Docker sandbox?** — Offline execution, prevents malicious code
4. **Why strict isolation?** — Prevents org constraints from bleeding into user prefs

## Contact & Resources

- Repository: https://github.com/johan-droid/Vibe-Hub
- Render deployment: Check dashboard for live logs
- Database: PostgreSQL via connection string in env
