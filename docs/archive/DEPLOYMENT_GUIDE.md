# Deployment Guide

**Vibe-Hub: Agentic Coding Platform**  
**Version:** 6.0.0 (V6 Architecture)  
**Date:** 2026-05-07  
**Environment:** Production Ready

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Local Development](#3-local-development)
4. [Production Deployment](#4-production-deployment)
5. [Docker Configuration](#5-docker-configuration)
6. [Database Setup](#6-database-setup)
7. [Monitoring & Logging](#7-monitoring--logging)
8. [Security Configuration](#8-security-configuration)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### 1.1 System Requirements

| Component | Minimum | Recommended |
|-----------|----------|-------------|
| **Node.js** | 18.0.0 LTS | 20.0.0 LTS |
| **npm** | 8.0.0 | 10.0.0 |
| **PostgreSQL** | 14.0 | 15.0 |
| **Redis** | 6.0 | 7.0 |
| **Docker** | 20.10.0 | 24.0.0 |
| **Memory** | 4GB RAM | 8GB RAM |
| **Storage** | 20GB SSD | 50GB SSD |
| **CPU** | 2 cores | 4 cores |

### 1.2 External Services

| Service | Required | Purpose |
|---------|----------|---------|
| **Google OAuth** | Yes | Authentication |
| **GitHub OAuth** | Optional | Repository integration |
| **Gemini API** | Yes | LLM provider |
| **OpenAI API** | Optional | Alternative LLM |
| **Docker Hub** | Yes | Container registry |

---

## 2. Environment Setup

### 2.1 Environment Variables

Create `.env.production` in the project root:

```bash
# Application Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/vibehub_prod
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# LLM Providers
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Security
UI_ORIGIN=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
SESSION_SECRET=your-session-secret

# Sandbox Configuration
DOCKER_HOST=unix:///var/run/docker.sock
SANDBOX_TIMEOUT=10000
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/vibehub/app.log
LOG_MAX_SIZE=100m
LOG_MAX_FILES=10

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.2 Environment Validation

The application validates all required environment variables on startup:

```bash
# Check environment
npm run env:check

# Validate configuration
npm run config:validate
```

---

## 3. Local Development

### 3.1 Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/vibe-hub.git
cd vibe-hub

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start database services
docker-compose up -d postgres redis

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### 3.2 Development Services

```bash
# Frontend only
npm run dev:ui

# Backend only
npm run dev:server

# With Docker services
npm run dev:docker

# Full stack with monitoring
npm run dev:full
```

### 3.3 Database Setup

```bash
# Create database
createdb vibehub_dev

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Reset database
npm run db:reset
```

---

## 4. Production Deployment

### 4.1 Build Process

```bash
# Install production dependencies
npm ci --production

# Build frontend assets
npm run build:ui

# Build backend
npm run build:server

# Run tests
npm run test:prod

# Security audit
npm audit --audit-level high
```

### 4.2 Production Deployment Options

#### Option A: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'vibehub-server',
    script: './apps/server-bridge/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/vibehub/error.log',
    out_file: '/var/log/vibehub/out.log',
    log_file: '/var/log/vibehub/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### Option B: Docker Deployment

```bash
# Build Docker image
docker build -t vibehub:latest .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  app:
    image: vibehub:latest
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    volumes:
      - /var/log/vibehub:/var/log/vibehub
      - /var/run/docker.sock:/var/run/docker.sock
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: vibehub_prod
      POSTGRES_USER: vibehub
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./apps/user-interface/dist:/usr/share/nginx/html
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

#### Option C: Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=vibehub

# View logs
kubectl logs -f deployment/vibehub
```

---

## 5. Docker Configuration

### 5.1 Multi-stage Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/user-interface/package*.json ./apps/user-interface/
COPY apps/server-bridge/package*.json ./apps/server-bridge/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/apps/user-interface
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install system dependencies
RUN apk add --no-cache \
    docker \
    docker-compose \
    postgresql-client

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app .

# Set permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "apps/server-bridge/index.js"]
```

### 5.2 Docker Compose Development

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
      - "5173:5173"
    environment:
      - NODE_ENV=development
    env_file:
      - .env.local
    volumes:
      - .:/app
      - /app/node_modules
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vibehub_dev
      POSTGRES_USER: vibehub
      POSTGRES_PASSWORD: dev_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  redis_data:
```

---

## 6. Database Setup

### 6.1 PostgreSQL Configuration

```sql
-- Create database
CREATE DATABASE vibehub_prod;

-- Create user
CREATE USER vibehub WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE vibehub_prod TO vibehub;

-- Enable pgvector extension
\c vibehub_prod;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_semantic_memory_user_id ON semantic_memory(user_id);
CREATE INDEX idx_ast_graphs_project_name ON ast_graphs(project_name);
```

### 6.2 Database Migrations

```bash
# Create new migration
npm run migration:create --name add_new_table

# Run pending migrations
npm run db:migrate

# Rollback migration
npm run db:rollback

# View migration status
npm run db:status
```

### 6.3 Database Backup

```bash
# Automated backup script
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="vibehub_prod"

# Create backup
pg_dump -h localhost -U vibehub $DB_NAME > $BACKUP_DIR/vibehub_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/vibehub_$DATE.sql

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "vibehub_*.sql.gz" -mtime +7 -delete

echo "Backup completed: vibehub_$DATE.sql.gz"
```

---

## 7. Monitoring & Logging

### 7.1 Application Logging

**logger.js configuration:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'vibehub',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.File({
      filename: '/var/log/vibehub/error.log',
      level: 'error',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10
    }),
    new winston.transports.File({
      filename: '/var/log/vibehub/combined.log',
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### 7.2 Health Checks

**health endpoint:**
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      docker: await checkDocker(),
      memory: checkMemory(),
      disk: checkDisk()
    }
  };

  const isHealthy = Object.values(health.checks)
    .every(check => check.ok);

  res.status(isHealthy ? 200 : 503).json(health);
});
```

### 7.3 Metrics Collection

```javascript
// Prometheus metrics
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

const agentSessions = new prometheus.Gauge({
  name: 'agent_sessions_total',
  help: 'Total number of active agent sessions'
});
```

---

## 8. Security Configuration

### 8.1 SSL/TLS Setup

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://app:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://app:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 8.2 Firewall Configuration

```bash
# UFW firewall setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 8.3 Security Headers

**security.js middleware:**
```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https://apis.google.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 9. Troubleshooting

### 9.1 Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
psql -h localhost -U vibehub -d vibehub_prod

# Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

#### Docker Sandbox Issues
```bash
# Check Docker daemon
systemctl status docker

# Test Docker access
docker run --rm hello-world

# Check Docker logs
journalctl -u docker.service
```

#### Memory Issues
```bash
# Check memory usage
free -h
docker stats

# Monitor Node.js process
ps aux | grep node
top -p $(pgrep node)
```

#### SSL Certificate Issues
```bash
# Check certificate expiry
openssl x509 -in /etc/nginx/ssl/cert.pem -noout -dates

# Test SSL configuration
openssl s_client -connect your-domain.com:443

# Reload nginx
nginx -s reload
```

### 9.2 Performance Tuning

#### Node.js Optimization
```bash
# Increase memory limit
node --max-old-space-size=2048 apps/server-bridge/index.js

# Enable cluster mode
PM2_INSTANCE_MAX=4 npm run start

# Monitor performance
npm run monitor
```

#### Database Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Update statistics
ANALYZE users;

-- Reindex database
REINDEX DATABASE vibehub_prod;
```

### 9.3 Log Analysis

```bash
# Application errors
tail -f /var/log/vibehub/error.log | jq '.level == "error"'

# Slow requests
grep "duration" /var/log/vibehub/combined.log | jq '.duration > 1000'

# WebSocket connections
grep "websocket" /var/log/vibehub/combined.log | jq '.event == "connection"'

# Agent failures
grep "agent_error" /var/log/vibehub/combined.log | jq '.status == "failed"'
```

### 9.4 Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
gunzip -c /backups/vibehub_20260507_120000.sql.gz | psql -h localhost -U vibehub vibehub_prod

# Point-in-time recovery
pg_basebackup -h localhost -D /backup/base -U vibehub -v -P
```

#### Application Recovery
```bash
# Restart application
pm2 restart vibehub-server

# Clear Redis cache
redis-cli FLUSHALL

# Reset agent sessions
pm2 restart vibehub-server && redis-cli DEL agent_sessions
```

---

## Appendix A: Deployment Checklist

### Pre-deployment Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] Load balancer configured
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Error logging configured

### Post-deployment Verification
- [ ] Application accessible via HTTPS
- [ ] Authentication flow working
- [ ] Database connectivity verified
- [ ] WebSocket connections stable
- [ ] Agent execution functional
- [ ] File operations working
- [ ] Terminal sessions active
- [ ] Monitoring metrics collecting
- [ ] Log files rotating
- [ ] Health checks responding

---

**End of Deployment Guide**
