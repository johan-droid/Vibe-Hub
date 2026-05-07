# Development Setup Guide

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Target Audience**: Developers, DevOps Engineers

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
# Clone and setup in one command
curl -sSL https://raw.githubusercontent.com/your-org/vibe-hub/main/scripts/setup.sh | bash

# Or manually:
git clone https://github.com/your-org/vibe-hub.git
cd vibe-hub
npm run setup
npm run dev
```

### 1.2 Verify Installation

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/docs

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
# Copy environment template
cp .env.example .env.local

# Edit environment file
nano .env.local
```

**Required `.env.local` configuration:**
```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://vibehub:dev_password@localhost:5432/vibehub_dev
REDIS_URL=redis://localhost:6379

# Authentication (get from OAuth providers)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret-at-least-32-characters

# LLM Provider
GEMINI_API_KEY=your-gemini-api-key

# Frontend
UI_ORIGIN=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
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
# Available npm scripts
npm run dev              # Start full development stack
npm run build            # Build for production
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed development data
npm run db:reset         # Reset database
npm run env:check        # Validate environment
npm run setup            # Complete project setup
```

### 4.3 Typical Development Flow

```bash
# 1. Create feature branch
git checkout -b feature/dark-mode-toggle

# 2. Start development
npm run dev

# 3. Make changes
# - Edit frontend in apps/user-interface/
# - Edit backend in apps/server-bridge/
# - Test changes in browser

# 4. Run tests
npm run test

# 5. Lint and format
npm run lint:fix
npm run format

# 6. Commit changes
git add .
git commit -m "feat: add dark mode toggle component"

# 7. Push and create PR
git push origin feature/dark-mode-toggle
```

---

## 5. Code Structure

### 5.1 Monorepo Structure

```
vibe-hub/
├── apps/
│   ├── user-interface/          # React frontend
│   │   ├── src/
│   │   │   ├── components/      # UI components
│   │   │   ├── pages/          # Page components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── store/          # State management
│   │   │   └── services/       # API clients
│   │   ├── public/             # Static assets
│   │   └── package.json
│   └── server-bridge/          # Node.js backend
│       ├── src/
│       │   ├── org_core/       # Organizational constraints
│       │   ├── user_env/       # User preferences
│       │   ├── orchestrator/   # Integration logic
│       │   ├── memory/         # Data access
│       │   ├── sandbox/        # Code execution
│       │   ├── vfs/           # Virtual file system
│       │   ├── auth/          # Authentication
│       │   └── utils/         # Utilities
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
├── components/
│   ├── Dashboard.jsx           # Main layout
│   ├── AgentStatusBar.jsx     # Agent status bar
│   ├── IntentChatPanel.jsx    # Chat interface
│   ├── CodeCanvas.jsx         # Diff viewer
│   ├── ActivityFeed.jsx       # Activity log
│   ├── PeekTerminal.jsx       # Terminal strip
│   └── AgentActionOverlay.jsx # Task overlay
├── pages/
│   ├── Dashboard.jsx           # Dashboard page
│   ├── AuthCallback.jsx        # OAuth callback
│   ├── Login.jsx              # Login page
│   └── LandingPage.jsx        # Landing page
├── hooks/
│   ├── useAgent.js            # Agent interaction
│   ├── useStore.js            # Zustand store
│   └── useJobResumption.js    # Session persistence
├── store/
│   └── useStore.js            # Global state
├── services/
│   └── api.js                 # API client
├── context/
│   └── ThemeContext.jsx       # Theme provider
└── styles/
    └── globals.css            # Global styles
```

### 5.3 Backend Structure

```
apps/server-bridge/src/
├── org_core/                   # Immutable constraints
│   ├── context_builder.js     # CI/CD, deployment rules
│   ├── ci_cd_templates/       # Workflow templates
│   └── global_linting/        # Code standards
├── user_env/                   # User preferences
│   ├── context_builder.js     # Language, themes
│   └── locales/               # Translations
├── orchestrator/               # Integration layer
│   ├── state_machine.js       # XState orchestration
│   ├── router.js              # API routes
│   └── websocket.js           # Socket.io handlers
├── memory/                     # Data access
│   ├── loader.js              # Semantic graph builder
│   ├── database.js            # PostgreSQL client
│   └── vector_store.js        # pgvector operations
├── sandbox/                    # Code execution
│   ├── docker_executor.js     # Container management
│   └── github_actions.js      # Workflow integration
├── vfs/                        # Virtual file system
│   ├── container.js           # VFS main class
│   ├── diff_engine.js         # Change tracking
│   └── audit_logger.js        # Decision tracking
├── auth/                       # Security
│   ├── oauth.js               # Google/GitHub OAuth
│   ├── jwt.js                 # Token management
│   └── session.js             # Session handling
└── utils/                      # Utilities
    ├── logger.js              # Winston logging
    ├── validation.js          # Zod schemas
    └── security.js            # XSS protection
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
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run e2e tests only
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/unit/backend/state-machine.test.js
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

### 8.4 Release Process

```bash
# Update version
npm version patch  # or minor/major

# Build and test
npm run build
npm run test

# Create release
git tag v1.2.3
git push origin v1.2.3

# Deploy (automated in CI/CD)
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
