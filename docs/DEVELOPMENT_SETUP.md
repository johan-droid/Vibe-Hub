# Development Setup Guide

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Target Audience**: Developers, DevOps Engineers, AI Agents  
**AI Agent Focus**: Enhanced for AI agent development workflows

---

## AI Agent Quick Start

**Essential Commands for AI Agents:**
```bash
# Install dependencies
npm ci

# Start the full workspace (UI + server bridge)
npm run dev

# Start each workspace independently
npm run dev:ui
npm run dev:server

# Validate the server bridge entrypoints and security tooling
npm run validate
npm run security:audit
npm run test:security

# Build and test the UI workspace
npm run build:ui
npm --workspace=apps/user-interface run test
npm --workspace=apps/user-interface run lint

# Run the backend test suite
npm --workspace=apps/server-bridge run test
```

**Critical Development Rules for AI Agents:**
- ✅ Always use ES modules (`import`/`export`)
- ✅ Include `.js` extensions in relative imports
- ❌ NEVER import between `org_core/` and `user_env/`
- ✅ Use Docker sandbox for all code execution
- ✅ Follow V6 architecture isolation
- ✅ Use the root workspace scripts in `package.json` instead of invented `db:*` or `lint` root commands

**Current environment files:**
- Copy `apps/server-bridge/.env.example` to `apps/server-bridge/.env`
- Copy `apps/user-interface/.env.example` to `apps/user-interface/.env.local`
- Copy the root `.env.example` only if you need repository-wide defaults for local tooling

**AI Agent File Navigation:**
```bash
# Find JavaScript files
find_by_name SearchDirectory="apps/server-bridge/src" Pattern="**/*.js"

# Search for patterns
grep_search SearchPath="apps/server-bridge/src" Query="import.*from.*org_core"

# List directory structure
list_dir DirectoryPath="apps/server-bridge/src/orchestrator"
```

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Prerequisites](#2-prerequisites)
3. [Environment Configuration](#3-environment-configuration)
4. [Development Workflow](#4-development-workflow)
5. [Code Structure](#5-code-structure)
6. [Testing](#6-testing)
7. [Debugging](#7-debugging)
8. [Contributing](#8-contributing)

---

## 1. Quick Start

### 1.1 One-Command Setup

```bash
git clone <repo-url>
cd vibe-hub
npm ci
npm run dev
```

### 1.2 Verify Installation

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **Auth status**: http://localhost:3001/api/auth/status
- **VFS pending files**: http://localhost:3001/api/fs/pending

---

## 2. Prerequisites

### 2.1 Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 18.0.0+ LTS | [Node.js Official](https://nodejs.org/) |
| **npm** | 8.0.0+ | Included with Node.js |
| **PostgreSQL** | 14.0+ | [PostgreSQL Official](https://www.postgresql.org/) |
| **Redis** | 6.0+ | [Redis Official](https://redis.io/) |
| **Docker** | 20.10.0+ | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| **Git** | 2.30.0+ | [Git Official](https://git-scm.com/) |

### 2.2 Installation Commands

#### macOS
```bash
# Using Homebrew
brew install node@18 postgresql redis docker git

# Start services
brew services start postgresql
brew services start redis
```

#### Ubuntu/Debian
```bash
# Using apt
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server docker.io git

# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl start docker
```

#### Windows
```bash
# Using Chocolatey
choco install nodejs postgresql redis docker git

# Or download installers from official websites
```

### 2.3 Verification

```bash
# Verify installations
node --version  # Should be 18.x.x or higher
npm --version   # Should be 8.x.x or higher
psql --version  # Should be 14.x or higher
redis-server --version
docker --version
git --version
```

---

## 3. Environment Configuration

### 3.1 Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/vibe-hub.git
cd vibe-hub

# Verify structure
ls -la
# Should show: apps/, docs/, package.json, etc.
```

### 3.2 Environment Setup

```bash
# Copy the server bridge template
cp apps/server-bridge/.env.example apps/server-bridge/.env

# Copy the frontend template
cp apps/user-interface/.env.example apps/user-interface/.env.local

# Optional root defaults for local tooling
cp .env.example .env
```

**Server bridge configuration:**
```bash
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/vibe_hub
REDIS_URL=redis://localhost:6379/0
UI_ORIGIN=http://localhost:5173
JWT_SECRET=change_me_to_a_random_string
CSRF_SECRET=change_me_to_a_different_random_string
GEMINI_API_KEY=
SELINA_MODEL_PROVIDER=nim
```

**Frontend configuration:**
```bash
VITE_API_BASE=http://localhost:3001
VITE_WS_BASE=ws://localhost:3001
VITE_API_URL=http://localhost:3001
VITE_TEST_MODE=false
```

### 3.3 Database Setup

```bash
# Create development database
createdb vibehub_dev

# Create user (optional, can use existing postgres user)
createuser vibehub
psql -d vibehub_dev -c "ALTER USER vibehub PASSWORD 'dev_password';"
psql -d vibehub_dev -c "GRANT ALL PRIVILEGES ON DATABASE vibehub_dev TO vibehub;"

# Enable pgvector extension
psql -d vibehub_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 3.4 Docker Services (Alternative)

```bash
# Use Docker for database services
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Wait for services to start
sleep 10

# Run migrations
npm run db:migrate
```

---

## 4. Development Workflow

### 4.1 Start Development Servers

```bash
# Start all services (recommended)
npm run dev

# Or start individually
npm run dev:server  # Backend only
npm run dev:ui      # Frontend only
npm run dev:docker  # With Docker services
```

### 4.2 Development Scripts

```bash
# Root workspace scripts
npm run dev
npm run dev:ui
npm run dev:server
npm run build:ui
npm run start:server
npm run validate
npm run sanitize
npm run security:audit
npm run test:security
npm run release:gate

# Workspace scripts
npm --workspace=apps/user-interface run build
npm --workspace=apps/user-interface run test
npm --workspace=apps/user-interface run test:e2e
npm --workspace=apps/user-interface run lint
npm --workspace=apps/server-bridge run test
```

### 4.3 AI Agent Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/dark-mode-toggle

# 2. Start development environment
npm run dev

# 3. AI Agent Code Analysis Phase
# - Read existing code with read_file tool
# - Search patterns with grep_search
# - Understand architecture with find_by_name

# 4. AI Agent Implementation Phase
# - Use multi_edit for coordinated changes
# - Follow V6 isolation rules
# - Include .js extensions in imports

# 5. AI Agent Validation Phase
node --check apps/server-bridge/src/orchestrator/state_machine.js
npm run lint
npm run test

# 6. AI Agent Documentation Phase
# - Update relevant markdown files
# - Document API changes
# - Update architecture docs

# 7. Commit changes
git add .
git commit -m "feat: add dark mode toggle component"
git push origin feature/dark-mode-toggle
```

### 4.4 AI Agent Debugging Workflow

```bash
# 1. Syntax validation
node --check <file>

# 2. Check for V6 violations
grep_search SearchPath="apps/server-bridge/src" Query="import.*user_env.*org_core"
grep_search SearchPath="apps/server-bridge/src" Query="require\("

# 3. Run specific tests
npm test -- tests/unit/backend/state-machine.test.js

# 4. Monitor state machine
tail -f logs/agent.log | grep "Agent Status"

# 5. Check VFS staging
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/vfs/pending
```

---

## 5. Code Structure

### 5.1 Monorepo Structure

```
vibe-hub/
├── apps/
│   ├── user-interface/          # React frontend workspace
│   │   ├── src/
│   │   │   ├── features/        # Domain-specific UI slices
│   │   │   ├── components/     # Shared UI building blocks
│   │   │   ├── pages/          # Route-level views
│   │   │   ├── hooks/          # Client-side state and effects
│   │   │   ├── services/       # API and socket clients
│   │   │   └── store/          # Zustand stores
│   │   ├── e2e/                # Playwright tests
│   │   └── package.json
│   └── server-bridge/          # Node.js backend workspace
│       ├── orchestrator/       # Routing, state machine, tools, jobs
│       ├── auth/               # OAuth, sessions, guards
│       ├── vfs/                # Approval-gated file staging
│       ├── sandbox/            # Docker execution helpers
│       ├── memory/             # Semantic memory and AST graphing
│       ├── mcp/                # MCP client and manager
│       ├── org_core/           # Org-wide constraints
│       ├── user_env/           # User preferences
│       └── package.json
├── docs/                      # Documentation
├── scripts/                   # Build and deployment scripts
├── tests/                     # Integration tests
├── package.json               # Root package.json
└── README.md
```

### 5.2 Frontend Structure

```
apps/user-interface/src/
├── features/
│   ├── dashboard/components/   # Agent dashboard, activity feed, status bar
│   ├── editor/components/      # Diff viewer, file tree, terminal, tabs
│   ├── chat/components/        # Prompt and session surfaces
│   ├── terminal/components/    # Terminal sessions panel
│   └── security/components/    # Security audit views
├── components/                 # Shared shells, loaders, and animations
├── pages/                      # Landing, login, auth callback, workspace
├── hooks/                      # Socket, theme, and session hooks
├── store/                      # Zustand stores and IndexedDB helpers
├── services/                   # API and websocket clients
└── styles/                     # Global styles
```

### 5.3 Backend Structure

```
apps/server-bridge/
├── index.js                    # Express bootstrap and route registration
├── orchestrator/               # Routing, state machine, tools, jobs
│   ├── state_machine.js        # XState orchestration
│   ├── router.js               # Code, VFS, MCP, repo, job handlers
│   ├── chat_routes.js          # Chat session routes
│   ├── preferences_routes.js   # User preference routes
│   ├── skill-graph.js          # Prompt-to-expert routing
│   └── tool_schema.js          # MCP tool validation
├── auth/                       # OAuth, session, and authorization logic
├── vfs/                        # In-memory staging layer
├── sandbox/                    # Docker execution helpers
├── memory/                     # AST graphing and semantic memory
├── mcp/                        # MCP client and manager
├── org_core/                   # Global constraints
├── user_env/                   # User preferences
└── utils/                      # Logging, validation, metrics, security
```

---

## 6. Testing

### 6.1 Test Structure

```
tests/
├── unit/                       # Unit tests
│   ├── frontend/              # Frontend unit tests
│   └── backend/               # Backend unit tests
├── integration/               # Integration tests
│   ├── api/                   # API integration tests
│   └── database/              # Database tests
├── e2e/                       # End-to-end tests
│   ├── auth/                  # Authentication flows
│   └── agent/                 # Agent orchestration
└── fixtures/                  # Test data
```

### 6.2 Running Tests

```bash
# Run the backend suite
npm --workspace=apps/server-bridge run test

# Run the frontend suite
npm --workspace=apps/user-interface run test

# Run the frontend E2E suite
npm --workspace=apps/user-interface run test:e2e

# Run the backend security regression subset
npm run test:security

# Validate the orchestrator entrypoints
npm run validate
```

### 6.3 Writing Tests

#### Frontend Test Example
```javascript
// tests/unit/frontend/AgentStatusBar.test.jsx
import { render, screen } from '@testing-library/react';
import AgentStatusBar from '../../../apps/user-interface/src/components/AgentStatusBar';

test('displays agent status correctly', () => {
  const mockStatus = {
    status: 'running',
    message: 'Processing request...',
    retries: 1,
    maxRetries: 3
  };

  render(<AgentStatusBar agentLoopStatus={mockStatus} />);
  
  expect(screen.getByText('Processing request...')).toBeInTheDocument();
  expect(screen.getByText('Retry 1/3')).toBeInTheDocument();
});
```

#### Backend Test Example
```javascript
// tests/unit/backend/state-machine.test.js
import { createAgentMachine } from '../../apps/server-bridge/src/orchestrator/state_machine';

test('state machine transitions correctly', async () => {
  const machine = createAgentMachine();
  const service = interpret(machine).start();

  // Start task
  service.send({ type: 'START_TASK' });
  expect(service.state.value).toBe('loading_contexts');

  // Complete context loading
  service.send({ type: 'CONTEXTS_LOADED' });
  expect(service.state.value).toBe('parsing_ast');

  service.stop();
});
```

### 6.4 Test Configuration

**vitest.config.js:**
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.js'
      ]
    }
  }
});
```

---

## 7. Debugging

### 7.1 Frontend Debugging

#### Browser DevTools
```bash
# Start with source maps
npm run dev:debug

# Enable React DevTools
# Install React DevTools browser extension
```

#### VS Code Debugging
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/user-interface/node_modules/.bin/vite",
      "args": ["--mode", "development"],
      "cwd": "${workspaceFolder}/apps/user-interface",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 7.2 Backend Debugging

#### Node.js Inspector
```bash
# Start with debugging
npm run dev:debug

# Or with inspect flag
node --inspect-brk apps/server-bridge/index.js
```

#### VS Code Debugging
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/server-bridge/index.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon"
    }
  ]
}
```

### 7.3 Database Debugging

#### PostgreSQL Debugging
```bash
# Connect to database
psql -h localhost -U vibehub -d vibehub_dev

# View queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

# Monitor connections
SELECT * FROM pg_stat_activity WHERE datname = 'vibehub_dev';
```

#### Redis Debugging
```bash
# Connect to Redis
redis-cli

# Monitor commands
MONITOR

# View keys
KEYS *

# View specific key
GET agent_sessions:123
```

### 7.4 Docker Debugging

```bash
# View container logs
docker logs vibehub-app

# Enter container
docker exec -it vibehub-app sh

# Debug Docker Compose
docker-compose -f docker-compose.dev.yml logs app
```

---

## 8. Contributing

### 8.1 Coding Standards

#### JavaScript/TypeScript
- Use ES6+ features
- Prefer `const` over `let`
- Use arrow functions for callbacks
- Follow Airbnb style guide
- No `var` declarations
- No `require()`/`module.exports` (use ES modules)

#### React
- Use functional components with hooks
- Prefer custom hooks for complex logic
- Use memoization for expensive operations
- Follow React naming conventions

#### CSS
- Use Tailwind CSS classes
- Follow BEM methodology for custom CSS
- Use CSS variables for theming
- Minimize inline styles

### 8.2 Git Workflow

#### Branch Naming
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `refactor/description` - Code refactoring

#### Commit Messages
```
type(scope): description

feat(ui): add dark mode toggle
fix(api): resolve authentication timeout
refactor(vfs): simplify diff calculation
docs(readme): update installation instructions
```

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Environment variables documented
```

### 8.3 Code Review Process

1. **Self-Review**
   - Run tests: `npm run test`
   - Check linting: `npm run lint`
   - Format code: `npm run format`

2. **Peer Review**
   - Request review from team member
   - Address feedback promptly
   - Keep PRs small and focused

3. **Merge Requirements**
   - All tests passing
   - Code coverage maintained
   - Documentation updated
   - At least one approval

### 8.5 AI Agent Testing Guidelines

#### Unit Testing for AI Agents
```javascript
// tests/unit/backend/state-machine.test.js
import { createAgentMachine } from '../../apps/server-bridge/src/orchestrator/state_machine';

test('AI agent state machine transitions correctly', async () => {
  const machine = createAgentMachine();
  const service = interpret(machine).start();

  // Test AI agent entry point
  service.send({ type: 'START_TASK' });
  expect(service.state.value).toBe('loading_contexts');

  // Test context loading
  service.send({ type: 'CONTEXTS_LOADED' });
  expect(service.state.value).toBe('parsing_ast');

  // Test AST analysis
  service.send({ type: 'AST_PARSED' });
  expect(service.state.value).toBe('drafting_code');

  service.stop();
});
```

#### Integration Testing for AI Agents
```javascript
// tests/integration/api/agent.test.js
import request from 'supertest';
import app from '../../../apps/server-bridge/index.js';

test('AI agent API endpoint integration', async () => {
  const response = await request(app)
    .post('/api/agent/prompt')
    .set('Authorization', 'Bearer valid-token')
    .send({
      message: 'Create test component',
      context: { language: 'en', effort: 'minimal' },
      socketId: 'test-socket'
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.sessionId).toBeDefined();
});
```

#### VFS Testing for AI Agents
```javascript
// tests/unit/backend/vfs.test.js
import VFSContainer from '../../../apps/server-bridge/src/vfs/container.js';

test('AI agent VFS staging workflow', async () => {
  const vfs = new VFSContainer();
  
  // Test file staging
  const fileId = await vfs.stageFile('test.js', 'original', 'proposed');
  expect(fileId).toBeDefined();
  
  // Test approval workflow
  await vfs.approveFile(fileId);
  const status = await vfs.getFileStatus(fileId);
  expect(status).toBe('approved');
  
  // Test commit to disk
  await vfs.commitToDisk(fileId);
  const committed = await vfs.isCommitted(fileId);
  expect(committed).toBe(true);
});
```

---

## Appendix A: Common Issues

### Issue: Database Connection Failed
```bash
# Solution: Check PostgreSQL status
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Restart PostgreSQL
brew services restart postgresql      # macOS
sudo systemctl restart postgresql     # Linux
```

### Issue: Port Already in Use
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm run dev
```

### Issue: Permission Denied
```bash
# Fix npm permissions
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Issue: Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

---

## Appendix B: IDE Configuration

### VS Code Extensions
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "files.associations": {
    "*.jsx": "javascriptreact"
  }
}
```

---

**End of Development Setup Guide**
