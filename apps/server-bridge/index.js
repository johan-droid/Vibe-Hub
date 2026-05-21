/**
 * @fileoverview apps/server-bridge/index.js
 * @module SelinaServerBridge
 * @description The primary entry point for the Selina core server bridge.
 * Initializes the Express server, configures core middleware (CORS, Helmet, Rate Limiting),
 * sets up WebSockets for real-time orchestrator communication, and registers API routers.
 */

import './load-env.js';
import express            from 'express';
import cors               from 'cors';
import helmet             from 'helmet';
import rateLimit          from 'express-rate-limit';
import { RedisStore }     from 'rate-limit-redis';
import { createServer }   from 'http';
import { WebSocketServer } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuid }     from 'uuid';
import { logger, requestContext, logError } from './utils/logger.js';
import { logger as detailedLogger, requestLogger } from './utils/detailed-logger.js';
import { codeRequestSchema, vfsCommitSchema, validateRequest } from './utils/validation.js';
import { handleCodeJobStatus, handleCodeRequest, handleCommitRequest, handleGetPendingFiles, handleGetVfsStats, handleLinkRepo, handleListRepos, handleListTools, handleListServers, handleMcpDiagnostics, handleCallTool, handleRegisterServer, router } from './orchestrator/router.js';


import { csrfProtection, csrfTokenHandler } from './utils/csrf.js';
import { getReadiness, registerReadinessCheck, requireReadiness } from './utils/health.js';
import {
  metricsMiddleware,
  recordAgentToolCallMetric,
  recordApprovalDecisionMetric,
  renderMetrics,
  setActiveWebsocketConnections,
} from './utils/metrics.js';
import { idempotencyMiddleware } from './utils/idempotency.js';
import { captureException, initSentry, sentryErrorHandler } from './utils/sentry.js';
import { apiDocsHtml, buildOpenApiSpec } from './utils/openapi.js';
import { closeRedisClients, configureSocketRedisAdapter, createRedisClients } from './utils/redis.js';
import { listAuditLogs } from './utils/audit.js';
import { configureCache } from './utils/cache.js';
import semanticGraphBuilder from './memory/loader.js';
import { createCodeQueue } from './orchestrator/job-queue.js';
import { validateEnvironment } from './utils/env.js';
import { assertEdgeConfiguration, edgeCacheHeaders, requireInternalControlPlane } from './utils/edge-security.js';
import { SELINA_BRAND } from './config/brand.js';

import { initDB }                from './db.js';
import { authenticateFromHeaders, requireAuth } from './auth/middleware.js';
import googleAuth                from './auth/google.js';
import githubAuth                from './auth/github.js';
import authRoutes                from './auth/routes.js';
import cookieParser              from 'cookie-parser';
import { AgentOrchestrator }     from './orchestrator/index.js';
import { TaskManager }           from './orchestrator/task-manager.js';
import { githubService }         from './github/index.js';
import { creativeService }       from './creative/index.js';
import { uiVariantService }      from './creative/generate-ui-variant.js';
import { modelService }          from './orchestrator/models.js';
import { listSkillGraph }        from './orchestrator/skill-graph.js';
import { vfs }                   from './vfs/container.js';
import { browserAutomator }      from './vfs/browser_automator.js';
import { SandboxProviderRouter }   from './sandbox/providers.js';
import { approvalEngine }         from './auth/approval-engine.js';
import { authorizeToolCall, ToolAuthError } from './orchestrator/tool_auth_guard.js';
import { AGENT_TOOLS } from './orchestrator/tools.js';
import { executeHelperTool, isHelperTool } from './orchestrator/helper-tools.js';
import { mcpManager } from './mcp/MCPManager.js';
import { ToolSchemaError, validateToolCallArguments } from './orchestrator/tool_schema.js';
import { buildExpertDiagnostics } from './orchestrator/expert-routing.js';
import { attachJsonRpcEnvelope } from './orchestrator/jsonrpc.js';
import { createChildRunIdentity, createRootRunIdentity } from './orchestrator/run_identity.js';
import { fetchRunEventsForUser, fetchRunForUser, persistRun, persistRunEvent } from './orchestrator/run_store.js';
import { createActionGrant, hashToolParams, verifyActionGrant } from './auth/action-grants.js';
import { insertAgentActionGrant } from './db.js';
import { applyFuzzyPatchFile, PatchFileError } from './orchestrator/patch-file.js';
import { integrationRouter } from './integration/router.js';
import {
  assertSessionStillValid,
  registerSessionCleanup,
  unregisterSessionCleanup,
} from './auth/session.js';
import {
  acquireRun,
  getConcurrencyRetryAfterSeconds,
  getRunConcurrencyLimit,
  releaseRun,
} from './auth/concurrency-governor.js';
import { filterModelOutput } from './orchestrator/output-filter.js';
import {
  ToolExecutionPolicyError,
  recordToolExecutionOutcome,
  validateToolInvocationPolicy,
} from './orchestrator/tool-execution-policy.js';
import {
  DailyTokenQuotaExceededError,
  assertUserNotSuspended,
  recordBillingEvent,
} from './orchestrator/cost-controls.js';
import { loadPromptSecrets } from './orchestrator/prompt-secrets.js';
// ─── Express + HTTP server ────────────────────────────────────────────────────

validateEnvironment();
assertEdgeConfiguration();
await loadPromptSecrets();

const app    = express();
const server = createServer(app);
const port   = process.env.PORT || 3001;
const instanceId = uuid();
const redisClients = createRedisClients();
const sandboxProviders = new SandboxProviderRouter();
const isProd = process.env.NODE_ENV === 'production';
const parseLimit = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const trustProxyHops = parseLimit(process.env.TRUST_PROXY_HOPS, process.env.RENDER || isProd ? 1 : 0);

const SECRET_FIELD_PATTERN = /(api[_-]?key|secret|token|password|credential|authorization|cookie|session)/i;

function redactToolPayload(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redactToolPayload(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [
      key,
      SECRET_FIELD_PATTERN.test(key) ? '[redacted]' : redactToolPayload(item, depth + 1),
    ]));
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}...`;
  return value;
}

function inferToolSource(toolName) {
  if (toolName.includes('__')) return 'mcp';
  if (toolName.startsWith('github_')) return 'github';
  if (toolName.startsWith('browser_')) return 'browser';
  return 'builtin';
}

function protectOutboundPayload(payload, session, auth) {
  if (!payload || typeof payload !== 'object') return payload;

  const contentField = {
    thought: 'message',
    stream_chunk: 'delta',
    result: 'content',
  }[payload.type];

  if (!contentField || typeof payload[contentField] !== 'string') {
    return payload;
  }

  const verdict = filterModelOutput(payload[contentField], {
    tenantFingerprints: [
      ...(session.otherTenantFingerprints || []),
      ...(auth.user?.blockedTenantFingerprints || []),
      ...(auth.user?.otherTenantFingerprints || []),
    ],
  });
  if (!verdict.flagged) return payload;

  session.securityFlags = {
    ...(session.securityFlags || {}),
    promptLeakageDetected: verdict.category === 'prompt_leakage' || session.securityFlags?.promptLeakageDetected || false,
    outputDlpDetected: verdict.category === 'dlp' || session.securityFlags?.outputDlpDetected || false,
    outputFilterReason: verdict.reason,
    outputFilterCategory: verdict.category,
    outputFilteredAt: new Date().toISOString(),
  };

  detailedLogger.warn('OutputGuard', 'Redacted model output before returning it to the user.', {
    sessionId: auth.sessionId,
    userId: auth.user.id,
    type: payload.type,
    reason: verdict.reason,
    category: verdict.category,
  });

  return {
    ...payload,
    [contentField]: verdict.safeText,
    securityFiltered: true,
  };
}

configureCache({ redis: redisClients?.command || null });

await initSentry(app);

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  captureException(error, { type: 'unhandled_rejection' });
});

process.on('uncaughtException', (error) => {
  captureException(error, { type: 'uncaught_exception' });
  process.exit(1);
});

// ── Security Middleware ─────────────────────────────────────────────────────

const cspConnectSrc = isProd
  ? ["'self'", process.env.UI_ORIGIN].filter(Boolean)
  : ["'self'", 'http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*'];

// Helmet.js - Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: cspConnectSrc,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Rate limiting - Prevent abuse
if (trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

server.keepAliveTimeout = parseLimit(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS, 65_000);
server.headersTimeout = parseLimit(process.env.HTTP_HEADERS_TIMEOUT_MS, 70_000);

const redisRateStore = (prefix) => redisClients
  ? new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (command, ...args) => redisClients.command.call(command, ...args),
    })
  : undefined;


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_AUTH, isProd ? 30 : 300),
  message: { error: 'Auth rate limit exceeded. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('auth'),
});

const agentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_AGENT, isProd ? 10 : 100),
  message: { error: 'Agent prompt rate limit exceeded. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('agent'),
});

const vfsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_VFS, isProd ? 200 : 2000),
  message: { error: 'VFS rate limit exceeded. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('vfs'),
});

const terminalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.RATE_LIMIT_TERMINAL, isProd ? 50 : 500),
  message: { error: 'Terminal rate limit exceeded. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('terminal'),
});


app.use('/api/auth/', authLimiter);
app.use('/api/code', agentLimiter);
app.use('/api/v6/code', agentLimiter);
app.use('/api/v6/integration/code', agentLimiter);
app.use('/api/fs/', vfsLimiter);
app.use('/api/v6/fs/', vfsLimiter);
app.use('/api/v6/integration/vfs/', vfsLimiter);
app.use('/api/terminal/', terminalLimiter);
app.use('/api/v6/terminal/', terminalLimiter);

const WS_RATE_WINDOW_MS = parseLimit(process.env.WS_RATE_WINDOW_MS, 15 * 60 * 1000);
const WS_MAX_CONNECTIONS_PER_WINDOW = parseLimit(process.env.WS_MAX_CONNECTIONS_PER_WINDOW, isProd ? 1000 : 1000);
const WS_MAX_ACTIVE_PER_IP = parseLimit(process.env.WS_MAX_ACTIVE_PER_IP, isProd ? 50 : 500);
const WS_MAX_ACTIVE_PER_USER = parseLimit(process.env.WS_MAX_ACTIVE_PER_USER, isProd ? 5 : 50);
const wsBuckets = new Map();
const wsActiveByIp = new Map();
const wsActiveByUser = new Map();

function getRequestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
}

function getSocketIp(socket) {
  return String(socket.handshake.address || socket.conn?.remoteAddress || 'unknown').trim();
}

function registerWsConnection(ip) {
  const now = Date.now();
  const bucket = wsBuckets.get(ip) || { count: 0, resetAt: now + WS_RATE_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WS_RATE_WINDOW_MS;
  }

  bucket.count += 1;
  wsBuckets.set(ip, bucket);

  const active = wsActiveByIp.get(ip) || 0;
  if (bucket.count > WS_MAX_CONNECTIONS_PER_WINDOW || active >= WS_MAX_ACTIVE_PER_IP) {
    return false;
  }

  wsActiveByIp.set(ip, active + 1);
  setActiveWebsocketConnections(Array.from(wsActiveByIp.values()).reduce((sum, count) => sum + count, 0));
  return true;
}

function releaseWsConnection(ip) {
  const active = wsActiveByIp.get(ip) || 0;
  if (active <= 1) wsActiveByIp.delete(ip);
  else wsActiveByIp.set(ip, active - 1);
  setActiveWebsocketConnections(Array.from(wsActiveByIp.values()).reduce((sum, count) => sum + count, 0));
}

function registerWsUser(userId) {
  const key = String(userId);
  const active = wsActiveByUser.get(key) || 0;
  if (active >= WS_MAX_ACTIVE_PER_USER) return false;
  wsActiveByUser.set(key, active + 1);
  return true;
}

function releaseWsUser(userId) {
  if (!userId) return;
  const key = String(userId);
  const active = wsActiveByUser.get(key) || 0;
  if (active <= 1) wsActiveByUser.delete(key);
  else wsActiveByUser.set(key, active - 1);
}

// ── Standard Middleware ───────────────────────────────────────────────────────

function configuredCorsOrigins() {
  const origins = [
    process.env.UI_ORIGIN,
    process.env.UI_ALLOWED_ORIGINS,
    process.env.FRONTEND_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap(value => String(value).split(','))
    .map(value => value.trim())
    .filter(Boolean);

  return [...new Set(origins)];
}

const allowedCorsOrigins = configuredCorsOrigins();
const corsOrigin = isProd
  ? (allowedCorsOrigins.length ? allowedCorsOrigins : false)
  : (allowedCorsOrigins.length ? allowedCorsOrigins : true);
app.use(cors({ origin: corsOrigin, credentials: true }));


// Request context logging (adds requestId and logs requests)
app.use(requestContext);
app.use(detailedLogger.logRequest); // Detailed request logging
app.use(requestLogger); // Attach logger to request object
app.use(metricsMiddleware);

// 5 MB JSON cap — large enough for paste-in files, prevents body-flood DoS.
// We capture rawBody for webhook signature verification.
app.use(express.json({ 
  limit: '5mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buf;
    }
  }
}));

// Cookie parser for reading auth cookies
app.use(cookieParser());

// ── API documentation + metrics ───────────────────────────────────────────────
app.get('/', edgeCacheHeaders({ seconds: 300 }), (_req, res) => {
  res.json({
    service: SELINA_BRAND.serviceName,
    product: SELINA_BRAND.productName,
    agent: SELINA_BRAND.agentName,
    status: 'ok',
    health: '/health',
    readiness: '/ready',
    docs: '/api-docs',
    integration: '/api/v6/integration',
  });
});
app.get('/swagger.json', edgeCacheHeaders({ seconds: 300 }), (_req, res) => res.json(buildOpenApiSpec()));
app.get('/api-docs', edgeCacheHeaders({ seconds: 300 }), (_req, res) => res.type('html').send(apiDocsHtml()));
app.get('/metrics', requireInternalControlPlane, async (_req, res) => res.type('text/plain; version=0.0.4').send(await renderMetrics()));

// Debug request-history endpoints are intentionally not mounted. Request and
// logger diagnostics must go through authenticated operational channels only.

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', googleAuth);
app.use('/api/auth', githubAuth);
app.use('/api/auth', authRoutes);
app.use('/api/v6/auth', googleAuth);
app.use('/api/v6/auth', githubAuth);
app.use('/api/v6/auth', authRoutes);

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const readiness = await getReadiness();
  res.status(200).json({
    ...readiness,
    liveness: true,
  });
});

app.get('/ready', async (_req, res) => {
  const readiness = await getReadiness();
  res.status(readiness.ready ? 200 : 503).json(readiness);
});

// ── User profile (protected) ──────────────────────────────────────────────────
function handleMe(req, res) {
  const { id, email, name, avatar_url, provider } = req.user;
  res.json({ id, email, name, avatarUrl: avatar_url, provider });
}

app.get('/api/me', requireAuth, handleMe);
app.get('/api/v6/me', requireAuth, handleMe);
app.get('/api/csrf-token', requireAuth, csrfTokenHandler);
app.get('/api/v6/csrf-token', requireAuth, csrfTokenHandler);

// Runtime diagnostics for SaaS observability. Secrets are never returned.
function handleRuntimeDiagnostics(_req, res) {
  res.json(modelService.diagnostics());
}

function handleRuntimeExperts(_req, res) {
  res.json({
    success: true,
    diagnostics: buildExpertDiagnostics(modelService),
  });
}

function handleRuntimeSkills(_req, res) {
  res.json({
    mode: 'mixture-of-experts',
    graph: listSkillGraph(),
  });
}

function handleRuntimeBrand(_req, res) {
  res.json({
    success: true,
    brand: SELINA_BRAND,
  });
}

async function handleAuditLogs(req, res, next) {
  try {
    const logs = await listAuditLogs({
      userId: req.user.id,
      resourceId: req.query.resourceId,
      limit: req.query.limit,
    });
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
}

app.get('/api/runtime/diagnostics', requireInternalControlPlane, requireAuth, handleRuntimeDiagnostics);
app.get('/api/v6/runtime/diagnostics', requireInternalControlPlane, requireAuth, handleRuntimeDiagnostics);
app.get('/api/v6/runtime/experts', requireAuth, edgeCacheHeaders({ seconds: 120 }), handleRuntimeExperts);
app.get('/api/runtime/skills', requireAuth, edgeCacheHeaders({ seconds: 300 }), handleRuntimeSkills);
app.get('/api/v6/runtime/skills', requireAuth, edgeCacheHeaders({ seconds: 300 }), handleRuntimeSkills);
app.get('/api/runtime/brand', edgeCacheHeaders({ seconds: 3600 }), handleRuntimeBrand);
app.get('/api/v6/runtime/brand', edgeCacheHeaders({ seconds: 3600 }), handleRuntimeBrand);
app.get('/api/audit-logs', requireInternalControlPlane, requireAuth, handleAuditLogs);
app.get('/api/v6/audit-logs', requireInternalControlPlane, requireAuth, handleAuditLogs);

// ── GitHub webhooks ───────────────────────────────────────────────────────────
async function handleGithubWebhook(req, res) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(403).send('Missing signature.');
  }
  
  // Use req.rawBody populated by express.json verify function
  const rawBody = req.rawBody || req.body;
  const valid = await githubService.verifyWebhookSignature(rawBody, signature);

  if (!valid) {
    return res.status(403).send('Invalid signature.');
  }

  const event   = req.headers['x-github-event'];
  const payload = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
  const installationId = payload?.installation?.id || payload?.workflow_run?.installation?.id || null;

  const sendToAuthorizedSessions = (messageFactory) => {
    for (const session of sessions.values()) {
      if (!installationId || String(session.githubInstallationId) !== String(installationId)) continue;
      if (session.ws.readyState !== session.ws.OPEN) continue;
      session.ws.send(JSON.stringify(messageFactory(session)));
    }
  };

  // Handle Action workflow runs (e.g. AI Sandbox results)
  if (event === 'workflow_run') {
    const workflowName = payload.workflow_run.name;
    const conclusion = payload.workflow_run.conclusion;
    sendToAuthorizedSessions(() => ({
      type: 'terminal_output',
      data: `\x1b[36m[GitHub] Workflow ${workflowName} finished with conclusion: ${conclusion}\x1b[0m\n`
    }));
    sendToAuthorizedSessions(() => ({
      type: 'state_change',
      state: 'idle',
      message: 'GitHub workflow complete'
    }));
  }

  // Route webhook events to the relevant open agent session (if any).
  // In a full implementation, we'd look up which session owns the repo.
  if (event === 'pull_request' && payload.action === 'opened') {
    // Routed to session via workflow_run handler below
  }

  if (event === 'workflow_run' && payload.action === 'completed') {
      const { workflow_run } = payload;
      sendToAuthorizedSessions(() => ({
        type: 'github_workflow_completed',
        workflow: workflow_run.name,
        conclusion: workflow_run.conclusion,
        url: workflow_run.html_url
      }));
  }

  res.status(200).send('OK');
}

app.post('/api/github/webhook', handleGithubWebhook);
app.post('/api/v6/github/webhook', handleGithubWebhook);

// ── Agent Orchestration (V6 XState) ───────────────────────────────────────────
// Main endpoint for AI code generation with rollback and VFS approval
const codePipeline = [
  requireAuth,
  requireReadiness,
  csrfProtection,
  idempotencyMiddleware(),
  validateRequest(codeRequestSchema),
  handleCodeRequest,
];

app.post('/api/code', ...codePipeline);
app.post('/api/v6/code', ...codePipeline);
app.get('/api/code/jobs/:jobId', requireAuth, handleCodeJobStatus);
app.get('/api/v6/code/jobs/:jobId', requireAuth, handleCodeJobStatus);

// ── Virtual File System API ───────────────────────────────────────────────────
// Secure commit endpoint with user approval gate
const commitPipeline = [requireAuth, csrfProtection, validateRequest(vfsCommitSchema), handleCommitRequest];
app.post('/api/fs/commit', ...commitPipeline);
app.post('/api/v6/fs/commit', ...commitPipeline);
app.get('/api/fs/pending', requireAuth, handleGetPendingFiles);
app.get('/api/v6/fs/pending', requireAuth, handleGetPendingFiles);
app.get('/api/fs/stats', requireAuth, handleGetVfsStats);
app.get('/api/v6/fs/stats', requireAuth, handleGetVfsStats);

// ── Repository Management (V6) ────────────────────────────────────────────────
app.post('/api/v6/repos/link', requireAuth, handleLinkRepo);
app.get('/api/v6/repos/list', requireAuth, handleListRepos);


// ── MCP Orchestration (V6) ────────────────────────────────────────────────────
app.get('/api/v6/mcp/tools', requireAuth, handleListTools);
app.get('/api/v6/mcp/servers', requireAuth, handleListServers);
app.get('/api/v6/mcp/diagnostics', requireAuth, handleMcpDiagnostics);
app.post('/api/v6/mcp/call', requireAuth, handleCallTool);
app.post('/api/v6/mcp/register', requireAuth, handleRegisterServer);

// ── Chat History (V6) ─────────────────────────────────────────────────────────
import { chatRouter } from './orchestrator/chat_routes.js';
app.use('/api/v6/chat', requireAuth, chatRouter);

// ── User Preferences (V6) ─────────────────────────────────────────────────────
import { preferencesRouter } from './orchestrator/preferences_routes.js';
app.use('/api/v6/preferences', requireAuth, preferencesRouter);

async function handleGetRun(req, res, next) {
  try {
    const run = await fetchRunForUser(req.params.runId, req.user.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    return res.json({ success: true, run });
  } catch (error) {
    return next(error);
  }
}

async function handleGetRunEvents(req, res, next) {
  try {
    const events = await fetchRunEventsForUser(req.params.runId, req.user.id);
    return res.json({ success: true, events });
  } catch (error) {
    return next(error);
  }
}

async function handleGetRunArtifacts(req, res, next) {
  try {
    const run = await fetchRunForUser(req.params.runId, req.user.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
    return res.json({
      success: true,
      artifacts: run.metadata?.artifacts || [],
      rolloutPaths: run.metadata?.rolloutPaths || null,
    });
  } catch (error) {
    return next(error);
  }
}

async function handleCreateApprovalGrant(req, res, next) {
  try {
    const { runId, toolName, decision, reason = '', params, paramsHash: providedParamsHash } = req.body || {};
    if (!runId || !toolName || !decision) {
      return res.status(400).json({
        success: false,
        error: 'runId, toolName, and decision are required',
      });
    }

    const run = await fetchRunForUser(runId, req.user.id);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const paramsHash = providedParamsHash || hashToolParams(params || {});
    const grant = createActionGrant({
      userId: req.user.id,
      runId,
      toolName,
      paramsHash,
      decision,
      reason,
      approvalSource: 'api',
    });
    await insertAgentActionGrant(grant);
    return res.json({
      success: true,
      grant: {
        grantId: grant.grantId,
        token: decision === 'approve' ? grant.token : null,
        expiresAt: grant.expiresAt,
        paramsHash,
      },
    });
  } catch (error) {
    return next(error);
  }
}

app.get('/api/v6/orchestrator/runs/:runId', requireAuth, handleGetRun);
app.get('/api/v6/orchestrator/runs/:runId/events', requireAuth, handleGetRunEvents);
app.get('/api/v6/orchestrator/runs/:runId/artifacts', requireAuth, handleGetRunArtifacts);
app.post('/api/v6/approvals/grants', requireAuth, csrfProtection, handleCreateApprovalGrant);


// ── GitHub Copilot Extension endpoint ─────────────────────────────────────────
// Copilot Extensions use the OpenAI streaming chat completions protocol.
// We translate it to our agent and stream back in SSE format here (the ONE
// place SSE is appropriate: Copilot already handles the bidirectional channel).
async function handleCopilotChat(req, res) {
  const { messages } = req.body;
  const lastUserMsg = messages?.findLast(m => m.role === 'user')?.content ?? '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const orchestrator = new AgentOrchestrator();
    orchestrator.setUser(req.user.id);
    orchestrator.setAuthContext?.(req.user, req.sessionId || null);

    // Stream Gemini tokens as OpenAI-compatible SSE events
    await orchestrator.handlePrompt(
      lastUserMsg, 
      'quick',
      async () => '{}', // Tool calls disabled in REST fallback for now
      () => {},         // onThought
      () => {},         // onClarification
      () => {},         // onPlan
      undefined,        // onMemoryUpdate
      () => {},         // emitState
      (delta) => {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta }, finish_reason: null }] })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

app.post('/api/copilot/chat', requireAuth, handleCopilotChat);
app.post('/api/v6/copilot/chat', requireAuth, handleCopilotChat);

// ── Integration Facade (V6) ──────────────────────────────────────────────────
app.use('/api/v6/integration', integrationRouter);

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });
app.set('wss', wss);

// ─── Socket.io Server (for XState streaming) ──────────────────────────────────

const io = new SocketIOServer(server, {
  path: '/socket.io',
  perMessageDeflate: {
    threshold: Number.parseInt(process.env.SOCKET_COMPRESSION_THRESHOLD || '1024', 10),
  },
  pingInterval: Number.parseInt(process.env.SOCKET_PING_INTERVAL_MS || '25000', 10),
  pingTimeout: Number.parseInt(process.env.SOCKET_PING_TIMEOUT_MS || '20000', 10),
  cors: {
    origin: isProd ? (process.env.UI_ORIGIN || false) : true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

if (redisClients) {
  registerReadinessCheck('redis', async () => {
    await redisClients.command.ping();
  });
}
configureSocketRedisAdapter(io, redisClients);
const codeQueue = createCodeQueue({
  io,
  processor: async (data) => {
    let abortRun = null;
    const sessionCleanup = data.sessionId ? (() => {
      if (io && data.socketId) {
        io.to(data.socketId).emit('agent_status', {
          status: 'reauth_required',
          message: 'Session fingerprint changed. Re-authentication is required and the current queued run has been terminated.',
          jobId: data.jobId,
          requestId: data.requestId,
          timestamp: new Date().toISOString(),
        });
      }
      abortRun?.('ORCHESTRATION_ABORTED');
    }) : null;

    try {
      if (data.sessionId) {
        const session = await assertSessionStillValid(data.sessionId, data.userId);
        if (!session) {
          throw new Error('Session was revoked or expired before the queued run started. Re-authentication required.');
        }
        registerSessionCleanup(data.sessionId, sessionCleanup);
      }

      const result = await router.executeWithStateMachine(
        data.prompt,
        data.userId,
        data.targetFile,
        io,
        data.socketId,
        data.requestId,
        data.effortLevel || 'standard',
        {
          onAbortReady: (abortHandler) => {
            abortRun = abortHandler;
          }
        }
      );
      if (io && data.socketId) {
        io.to(data.socketId).emit('agent_status', {
          status: 'job_completed',
          message: `Orchestration job completed.`,
          jobId: data.jobId,
          requestId: data.requestId,
          timestamp: new Date().toISOString(),
        });
      }
      return result;
    } finally {
      if (data.sessionId && sessionCleanup) {
        unregisterSessionCleanup(data.sessionId, sessionCleanup);
      }
      releaseRun(data.userId, data.requestId);
    }
  },
});
app.set('codeQueue', codeQueue);
vfs.configureRedis({
  client: redisClients?.command,
  subscriber: redisClients?.vfsSubscriber,
  sourceId: instanceId,
}).catch(error => {
  logger.error('VFS Redis coordination failed to initialize', { error: error.message });
});

// Inject the io instance into the Express app for the router to use
app.set('io', io);

io.use(async (socket, next) => {
  const ip = getSocketIp(socket);
  if (!registerWsConnection(ip)) {
    return next(new Error('WebSocket rate limit exceeded.'));
  }

  const token = socket.handshake.auth?.token || null;
  let auth = null;
  try {
    auth = await authenticateFromHeaders(socket.handshake.headers, token, socket.handshake);
  } catch (error) {
    releaseWsConnection(ip);
    return next(new Error('Authentication check failed.'));
  }

  if (!auth) {
    releaseWsConnection(ip);
    return next(new Error('Unauthenticated.'));
  }

  if (!registerWsUser(auth.user.id)) {
    releaseWsConnection(ip);
    return next(new Error('WebSocket user connection limit exceeded.'));
  }

  socket.data.ip = ip;
  socket.data.user = auth.user;
  socket.data.sessionId = auth.sessionId;
  next();
});

io.on('connection', (socket) => {
  logger.info('Socket.io', `Client connected: ${socket.id}`);
  socket.join(`user_${socket.data.user.id}`);

  const socketCleanup = () => {
    detailedLogger.warn('Auth', `Fingerprint changed mid-session for Socket.io. Disconnecting.`, { sessionId: socket.data.sessionId });
    socket.data.aborted = true;
    socket.disconnect(true);
  };
  registerSessionCleanup(socket.data.sessionId, socketCleanup);

  socket.on('join', (data) => {
    if (data.userId && String(data.userId) === String(socket.data.user.id)) {
      socket.join(`user_${socket.data.user.id}`);
      logger.info('Socket.io', `Socket ${socket.id} joined room user_${socket.data.user.id}`);
    }
  });
  
  socket.on('disconnect', () => {
    releaseWsConnection(socket.data.ip);
    releaseWsUser(socket.data.user?.id);
    unregisterSessionCleanup(socket.data.sessionId, socketCleanup);
    logger.info('Socket.io', `Client disconnected: ${socket.id}`);
  });
});

/**
 * Session map: sessionId → { ws, orchestrator, pendingToolCalls,
 *                             pendingClarifications, pendingPlans,
 *                             user, pingTimeout }
 *
 * This is the authoritative reference count. When ws.on('close') fires,
 * we delete from this map to release the orchestrator + all pending
 * Promise resolver references so GC can collect them.
 */
const sessions = new Map();

// ── Heartbeat ─────────────────────────────────────────────────────────────────
// Runs every 30 s. Any client that doesn't respond to a ping within 10 s
// is treated as a zombie and terminated.
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS  = 10_000;

const heartbeatInterval = setInterval(() => {
  for (const [sessionId, session] of sessions) {
    if (session.ws.readyState !== session.ws.OPEN) {
      sessions.delete(sessionId);
      continue;
    }

    // Mark as waiting for pong
    session.pongReceived = false;
    session.ws.ping();

    // Kill if pong doesn't arrive within PONG_TIMEOUT_MS
    session.pingTimeout = setTimeout(() => {
      if (!session.pongReceived) {
        session.ws.terminate();
        sessions.delete(sessionId);
      }
    }, PONG_TIMEOUT_MS);
  }
}, PING_INTERVAL_MS);

const VFS_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const VFS_ENTRY_TTL_MS = 24 * 60 * 60 * 1000;
const vfsCleanupInterval = setInterval(() => {
  const activeUserIds = new Set(
    Array.from(sessions.values())
      .map(session => session.user?.id)
      .filter(Boolean)
      .map(String)
  );
  vfs.clearExpiredEntries({ maxAgeMs: VFS_ENTRY_TTL_MS, activeUserIds });
}, VFS_CLEANUP_INTERVAL_MS);
vfsCleanupInterval.unref?.();

// Clean up the interval on server shutdown so Node.js can exit cleanly.
server.on('close', () => {
  clearInterval(heartbeatInterval);
  clearInterval(vfsCleanupInterval);
  codeQueue?.close?.().catch(() => {});
  closeRedisClients(redisClients).catch(() => {});
});

// ── Connection handler ────────────────────────────────────────────────────────
wss.on('connection', async (ws, req) => {
  const ip = getRequestIp(req);
  if (!registerWsConnection(ip)) {
    ws.close(1013, 'WebSocket rate limit exceeded.');
    return;
  }

  let auth = null;
  let released = false;
  const releaseConnection = () => {
    if (released) return;
    released = true;
    releaseWsConnection(ip);
    releaseWsUser(auth?.user?.id);
  };

  // ── Authentication ─────────────────────────────────────────────────────
  const token = null;
  try {
    auth = await authenticateFromHeaders(req.headers, token, req);
  } catch (error) {
    releaseConnection();
    ws.close(1011, 'Authentication check failed.');
    return;
  }

  if (!auth) {
    releaseConnection();
    ws.close(4001, 'Unauthenticated.');
    return;
  }
  if (!registerWsUser(auth.user.id)) {
    releaseConnection();
    ws.close(1013, 'WebSocket user connection limit exceeded.');
    return;
  }

  // ── Session bootstrap ──────────────────────────────────────────────────
  const sessionId    = uuid();
  const orchestrator = new AgentOrchestrator();
  orchestrator.setUser(auth.user.id);
  orchestrator.setAuthContext(auth.user, auth.sessionId);

  const session = {
    ws,
    orchestrator,
    user:                auth.user,
    currentRunIdentity:  null,
    pendingToolCalls:    new Map(),
    pendingClarifications: new Map(),
    pendingPlans:        new Map(),
    pongReceived:        true,
    pingTimeout:         null,
    idleTimeout:         null,
    lastUserInteractionAt: Date.now(),
    pausedState:         null,
    taskManager:         null, // lazy-init on first task message
    securityFlags:       { promptLeakageDetected: false },
  };
  sessions.set(sessionId, session);

  const wsSessionCleanup = () => {
    detailedLogger.warn('Auth', `Fingerprint changed mid-session. Revoking session and closing WebSocket.`, { sessionId: auth.sessionId });
    session.aborted = true;
    ws.close(4003, 'Fingerprint changed mid-session.');
  };
  registerSessionCleanup(auth.sessionId, wsSessionCleanup);

  // ── Pong handler (heartbeat) ───────────────────────────────────────────
  ws.on('pong', () => {
    session.pongReceived = true;
    clearTimeout(session.pingTimeout);
  });

  // ── Helpers: safe send ────────────────────────────────────────────────
  const send = (payload) => {
    if (ws.readyState === ws.OPEN) {
      const safePayload = protectOutboundPayload(payload, session, auth);
      const runIdentity = session.currentRunIdentity;
      const outgoing = process.env.SELINA_ENABLE_JSONRPC_EVENTS === 'false'
        ? safePayload
        : attachJsonRpcEnvelope(safePayload, runIdentity || {});
      if (outgoing.jsonrpcEvent && runIdentity?.runId) {
        persistRunEvent(outgoing.jsonrpcEvent, runIdentity);
      }
      ws.send(JSON.stringify(outgoing));
    }
  };

  const pauseIdleRun = () => {
    if (!session.currentRunIdentity || session.aborted) return;
    session.pausedState = {
      run: session.currentRunIdentity,
      pausedAt: new Date().toISOString(),
      reason: 'idle_timeout',
    };
    session.aborted = true;
    send({
      type: 'run_paused',
      code: 'IDLE_TIMEOUT',
      message: 'Agent run paused after 5 minutes without user interaction. Resources were released and the run can be resumed.',
      state: session.pausedState,
    });
    for (const p of session.pendingToolCalls.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_PAUSED_IDLE'));
    }
    session.pendingToolCalls.clear();
    for (const p of session.pendingClarifications.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_PAUSED_IDLE'));
    }
    session.pendingClarifications.clear();
    for (const p of session.pendingPlans.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_PAUSED_IDLE'));
    }
    session.pendingPlans.clear();
    recordBillingEvent({
      kind: 'agent_run_paused_idle',
      userId: auth.user.id,
      sessionId: auth.sessionId,
      runId: session.currentRunIdentity.runId,
    });
  };

  const touchUserInteraction = () => {
    session.lastUserInteractionAt = Date.now();
    clearTimeout(session.idleTimeout);
    session.idleTimeout = setTimeout(pauseIdleRun, 5 * 60_000);
  };
  touchUserInteraction();

  // ── Tool call dispatchers ─────────────────────────────────────────────

  /**
   * onThought — streams the agent's reasoning monologue to the frontend.
   * These appear in the chat interface as collapsible "thought" bubbles.
   */
  const onThought = (message) => {
    if (session.aborted || ws.readyState !== ws.OPEN) {
      throw new Error('ORCHESTRATION_ABORTED');
    }
    send({ type: 'thought', message });
  };

  /**
   * onToolCall — routes a tool call to:
   *   1. Server-side handlers (GitHub, sandbox, creative)
   *   2. Client-side VFS/WebContainer (forwarded over WS, awaited via Promise)
   */
  const onToolCall = async (name, rawArgs = {}) => {
    if (session.aborted || ws.readyState !== ws.OPEN) {
      throw new Error('ORCHESTRATION_ABORTED');
    }
    let args = rawArgs || {};
    const toolCallId = uuid();
    const startedAt = Date.now();
    const toolSource = inferToolSource(name);
    const allTools = [...AGENT_TOOLS, ...mcpManager.getToolsForLLM()];
    const toolDefinition = allTools.find(tool => tool.name === name || tool.uniqueId === name);
    let actionGrant = null;
    let toolPolicy = null;
    const emitToolCall = (payload) => {
      if (payload.status) recordAgentToolCallMetric(name, toolSource, payload.status);
      send({
        type: 'tool_call',
        id: toolCallId,
        tool: name,
        timestamp: new Date().toISOString(),
        ...payload,
      });
    };

    try {
      validateToolCallArguments(name, args || {}, allTools, { strict: true });
    } catch (error) {
      if (error instanceof ToolSchemaError) {
        emitToolCall({
          status: 'failed',
          error: error.message,
          metadata: {
            code: 'TOOL_SCHEMA_INVALID',
            source: toolSource,
            args: redactToolPayload(args),
            details: error.details || [],
          },
        });
        send({ type: 'error', message: error.message });
        return JSON.stringify({
          success: false,
          code: 'TOOL_SCHEMA_INVALID',
          error: error.message,
          details: error.details || [],
        });
      }
      throw error;
    }

    try {
      toolPolicy = validateToolInvocationPolicy(name, args, {
        toolDefinition,
        user: auth?.user || null,
        tenantId: auth?.user?.tenantId || session.tenantId || null,
      });
      args = toolPolicy.args;
    } catch (error) {
      if (error instanceof ToolExecutionPolicyError) {
        emitToolCall({
          status: 'failed',
          error: error.message,
          metadata: {
            code: error.code,
            source: toolSource,
            args: redactToolPayload(args),
          },
        });
        send({ type: 'error', message: error.message });
        return JSON.stringify({ success: false, code: error.code, error: error.message });
      }
      throw error;
    }

    try {
      const authorization = await authorizeToolCall(name, args, {
        authSnapshot: auth?.user
          ? { type: 'user-session', userId: auth.user.id, expiresAt: null }
          : null,
        toolDefinition,
        paramsHash: hashToolParams(args || {}),
        approvalFn: (reason, approvalContext) => approvalEngine.request(
          reason,
          {
            ...approvalContext,
            runId: session.currentRunIdentity?.runId || toolCallId,
          },
          async (promptText) => {
            const approved = await onPlan(
              [{
                file: approvalContext.toolName,
                action: promptText,
                reason: 'This tool can mutate files, state, network resources, browser state, or local execution.',
              }],
              ['Write and execution tools fail closed when approval times out or is rejected.']
            );
            recordApprovalDecisionMetric(approvalContext.toolName, approved ? 'approve' : 'deny');
            return approved ? 'approve' : 'deny';
          }
        ),
      });
      if (authorization.policy?.type === 'write') {
        const paramsHash = hashToolParams(args || {});
        actionGrant = createActionGrant({
          userId: auth.user.id,
          runId: session.currentRunIdentity?.runId || toolCallId,
          toolName: name,
          paramsHash,
          decision: 'approve',
          reason: `Approved ${name} through agent approval gate.`,
          approvalSource: authorization.approved ? 'agent_approval_gate' : 'policy',
        });
        const verified = verifyActionGrant(actionGrant.token, {
          userId: auth.user.id,
          runId: actionGrant.runId,
          toolName: name,
          paramsHash,
        });
        if (!verified.ok) {
          throw new ToolAuthError(verified.error);
        }
        await insertAgentActionGrant(actionGrant).catch(() => null);
      }
    } catch (error) {
      if (error instanceof ToolAuthError) {
        emitToolCall({
          status: 'failed',
          error: error.message,
          metadata: {
            code: 'TOOL_AUTH_DENIED',
            source: toolSource,
            args: redactToolPayload(args),
          },
        });
        send({ type: 'error', message: error.message });
        return JSON.stringify({ success: false, code: 'TOOL_AUTH_DENIED', error: error.message });
      }
      throw error;
    }

    emitToolCall({
      status: 'started',
      metadata: {
        source: toolSource,
        args: redactToolPayload(args),
        risk: toolDefinition?.risk || toolDefinition?.metadata?.risk || null,
        actionGrantId: actionGrant?.grantId || null,
        timeoutMs: toolPolicy?.timeoutMs || null,
        credentialScope: toolPolicy?.credentialScope || null,
      },
    });
    recordBillingEvent({
      kind: 'tool_call_started',
      userId: auth.user.id,
      sessionId: auth.sessionId,
      runId: session.currentRunIdentity?.runId || null,
      tool: name,
      source: toolSource,
      credentialScope: toolPolicy?.credentialScope || null,
    });

    let toolFailed = false;
    try {
    if (name.includes('__')) {
      const tool = mcpManager.findToolByLLMName(name);
      if (!tool) throw new Error(`MCP tool not registered: ${name}`);
      return JSON.stringify(await mcpManager.callTool(tool.uniqueId, args));
    }

    // ── 1. GitHub Tools ───────────────────────────────────────────────
    if (name.startsWith('github_')) {
      const installationId = session.githubInstallationId;
      const token          = session.githubPAT; // PAT set via 'set_github_token' message

      switch (name) {
        case 'github_create_branch':
          return JSON.stringify(await githubService.createAgentBranch({ ...args, installationId, token }));

        case 'github_detect_conflicts': {
          const risk = await githubService.detectConflictRisk({ ...args, installationId, token });
          if (risk.hasRisk) {
            // Surface conflict to the user as a structured clarification
            onThought(`⚠️ Conflict Risk: ${risk.recommendation}`);
          }
          return JSON.stringify(risk);
        }

        case 'github_fetch_upstream':
          return JSON.stringify(await githubService.fetchUpstreamCommits({ ...args, installationId, token }));

        case 'github_create_pr': {
          const result = await githubService.createPR({ ...args, installationId, token });
          // Blocked PRs surface as a clarification so the user decides next steps
          if (result.blocked) {
            send({ type: 'conflict_warning', risk: result.risk });
            return JSON.stringify({ blocked: true, message: result.risk.recommendation });
          }
          return JSON.stringify(result);
        }

        case 'github_post_comment':
          return JSON.stringify(await githubService.postComment({ ...args, installationId, token }));

        case 'github_create_check_run':
          return JSON.stringify(await githubService.createCheckRun({ ...args, installationId, token }));

        case 'github_create_codespace':
          return JSON.stringify({
            success: false,
            code: 'LOCAL_DOCKER_ONLY',
            error: 'Cloud execution is disabled by Selina V6 architecture. Use security_sandbox for local Docker execution.',
          });

        case 'github_trigger_workflow':
          return JSON.stringify({
            success: false,
            code: 'LOCAL_DOCKER_ONLY',
            error: 'GitHub Actions execution is disabled by Selina V6 architecture. Use security_sandbox for local Docker execution.',
          });

        case 'github_get_codeql_alerts':
          return JSON.stringify(await githubService.getCodeQLAlerts({ ...args, installationId, token }));

        default:
          throw new Error(`GitHub tool not implemented: ${name}`);
      }
    }

    // ── 2. Security Sandbox ───────────────────────────────────────────
    if (name === 'security_sandbox') {
      const { workspacePath, scriptPath, runtime, timeoutMs, includePaths, provider } = args;
      try {
        send({
          type: 'state_change',
          state: 'sandboxing',
          message: `Running in isolated sandbox provider: ${provider || process.env.SELINA_SANDBOX_PROVIDER || 'docker-local'}.`,
        });

        return JSON.stringify(await sandboxProviders.executeScript({
          provider,
          workspacePath,
          scriptPath,
          runtime,
          timeoutMs,
          includePaths,
        }));
      } catch (err) {
        return JSON.stringify({
          success: false,
          code: 'LOCAL_DOCKER_SANDBOX_FAILED',
          error: err.message,
        });
      }
    }

    // ── 3. Creative Swarm ─────────────────────────────────────────────
    if (name === 'design_research') {
      return JSON.stringify(await creativeService.searchInspiration(args.query, args.source));
    }
    if (name === 'generate_image') {
      return JSON.stringify(await creativeService.generateAsset(args.prompt, args.style));
    }
    if (name === 'generate_ui_variant') {
      return JSON.stringify(await uiVariantService.generateVariants({
        componentType: args.componentType || args.componentId,
        description: args.description || args.aesthetic || args.selina,
        designTokens: args.designTokens,
        count: args.count,
      }));
    }

    // ── 3b. Read-only Helper Tool Pack ───────────────────────────────
    if (isHelperTool(name)) {
      return JSON.stringify(await executeHelperTool(name, args, {
        workspacePath: args.workspacePath || process.cwd(),
      }));
    }

    // ── 4. Backend File Patch Tool ────────────────────────────────────
    if (name === 'patch_file') {
      try {
        return JSON.stringify(await applyFuzzyPatchFile(args));
      } catch (err) {
        if (err instanceof PatchFileError) {
          return JSON.stringify({
            success: false,
            code: err.code,
            error: err.message,
            metadata: err.metadata || {},
          });
        }
        return JSON.stringify({
          success: false,
          code: 'PATCH_FILE_FAILED',
          error: err.message,
        });
      }
    }

    // ── 5. Delegation (sub-agent recursion) ──────────────────────────
    if (name === 'delegate_task') {
      onThought(`Delegating to ${args.expert}Expert: ${args.task}`);
      const parentRun = session.currentRunIdentity || createRootRunIdentity({ expert: 'manager' });
      const childRun = createChildRunIdentity(parentRun, { expert: args.expert || 'code' });
      const previousRun = session.currentRunIdentity;
      session.currentRunIdentity = childRun;
      // Recursive call — creates a nested ReAct loop on the same session.
      // The sub-agent inherits the same tool dispatcher so it can also use
      // VFS, sandbox, GitHub, etc.
      try {
        const subResult = await orchestrator.handlePrompt(
          `${args.task}\n\nContext: ${args.context ?? 'none'}`,
          'standard',
          onToolCall,
          (t) => onThought(`[${args.expert}] ${t}`),
          onClarification,
          onPlan,
          undefined,
          (state, msg) => send({ type: 'status', state, message: msg }),
          (delta) => send({ type: 'stream_chunk', delta }),
          childRun,
        );
        return typeof subResult === 'string' ? subResult : subResult?.content ?? '';
      } finally {
        session.currentRunIdentity = previousRun;
      }
    }

    // ── 6. Auto-Sandbox for run_command ─────────────────────────────
    // If the agent tries to run a script directly, force it into the sandbox.
    if (name === 'run_command' && args.command) {
      const scriptCommands = ['node', 'npm', 'python3', 'python', 'bun', 'sh', 'bash'];
      const isScript = scriptCommands.includes(args.command);
      
      if (isScript) {
        try {
          send({
            type: 'state_change',
            state: 'sandboxing',
            message: 'Running command in local Docker sandbox with network disabled.',
          });

          return JSON.stringify(await sandboxProviders.executeCommand({
            provider: args.sandboxProvider,
            workspacePath: args.workspacePath,
            command: args.command,
            args: args.args,
            timeoutMs: args.timeoutMs || args.WaitMsBeforeAsync,
            includePaths: args.includePaths,
          }));
        } catch (err) {
          send({ type: 'error', message: `Local Docker sandbox failed: ${err.message}` });
          return JSON.stringify({
            success: false,
            code: 'LOCAL_DOCKER_SANDBOX_FAILED',
            error: err.message,
          });
        }
      }
    }

    // ── 7. Backend Analysis Tools ─────────────────────────────────────
    if (name === 'analyze_ast') {
      try {
        const content = await onToolCall('read_file', { path: args.path });
        if (!content || (typeof content === 'string' && content.startsWith('Error:'))) {
          return JSON.stringify({ error: `Could not read file for AST analysis: ${args.path}` });
        }
        const graph = await semanticGraphBuilder.analyzeCode(content, args.path);
        return JSON.stringify(graph);
      } catch (err) {
        return JSON.stringify({ error: `AST analysis failed: ${err.message}` });
      }
    }

    // ── 8. Browser Automation Tools ───────────────────────────────────
    if (name.startsWith('browser_')) {
      try {
        switch (name) {
          case 'browser_goto':
            return JSON.stringify(await browserAutomator.goto(args.url));
          case 'browser_click':
            return JSON.stringify(await browserAutomator.click(args.selector));
          case 'browser_type':
            return JSON.stringify(await browserAutomator.type(args.selector, args.text));
          case 'browser_screenshot':
            return JSON.stringify(await browserAutomator.screenshot(args.path));
          default:
            return JSON.stringify({ error: `Unknown browser tool: ${name}` });
        }
      } catch (err) {
        return JSON.stringify({ error: `Browser automation failed: ${err.message}` });
      }
    }

    // ── 9. Client-Side VFS / WebContainer ────────────────────────────
    // These tools run inside the browser sandbox (WebContainer API).
    // We forward the call over the WebSocket and await the browser's response.
    return await new Promise((resolve, reject) => {
      const callId = uuid();
      const timeoutMs = toolPolicy?.timeoutMs || 10_000;

      // Self-cleaning timeout: releases the Promise if the client takes too long.
      const timeout = setTimeout(() => {
        if (session.pendingToolCalls.has(callId)) {
          session.pendingToolCalls.delete(callId);
          reject(new Error(`Tool "${name}" timed out after ${Math.ceil(timeoutMs / 1000)}s (client did not respond).`));
        }
      }, timeoutMs);

      session.pendingToolCalls.set(callId, { resolve, reject, timeout });
      send({ type: 'tool_request', callId, name, args });
    });
    } catch (error) {
      toolFailed = true;
      recordToolExecutionOutcome(name, false);
      recordBillingEvent({
        kind: 'tool_call_failed',
        userId: auth.user.id,
        sessionId: auth.sessionId,
        runId: session.currentRunIdentity?.runId || null,
        tool: name,
        source: toolSource,
        durationMs: Date.now() - startedAt,
        error: error.message,
      });
      emitToolCall({
        status: 'failed',
        error: error.message,
        metadata: {
          source: toolSource,
          duration_ms: Date.now() - startedAt,
        },
      });
      throw error;
    } finally {
      if (!toolFailed) {
        recordToolExecutionOutcome(name, true);
        recordBillingEvent({
          kind: 'tool_call_completed',
          userId: auth.user.id,
          sessionId: auth.sessionId,
          runId: session.currentRunIdentity?.runId || null,
          tool: name,
          source: toolSource,
          durationMs: Date.now() - startedAt,
        });
        emitToolCall({
          status: 'completed',
          metadata: {
            source: toolSource,
            duration_ms: Date.now() - startedAt,
          },
        });
      }
    }
  };

  /**
   * onClarification — suspends agent execution and asks the user a question.
   * Resolves when the user sends a 'clarification_response' message.
   * Auto-resolves after 5 minutes with a default "no answer" so the agent
   * doesn't hang indefinitely (Ryzen host RAM).
   */
  const onClarification = (questions, context) =>
    new Promise((resolve, reject) => {
      if (session.aborted || ws.readyState !== ws.OPEN) {
        return reject(new Error('ORCHESTRATION_ABORTED'));
      }
      const clarificationId = uuid();
      const timeout = setTimeout(() => {
        if (session.pendingClarifications.has(clarificationId)) {
          session.pendingClarifications.delete(clarificationId);
          resolve('User did not respond — proceed with best judgement.');
        }
      }, 5 * 60_000);

      session.pendingClarifications.set(clarificationId, { resolve, reject, timeout });
      send({ type: 'clarification_request', clarificationId, questions, context });
    });

  /**
   * onPlan — suspends agent execution and shows a proposed plan to the user.
   * Resolves with `true` (approved) or `false` (rejected).
   */
  const onPlan = (steps, risks) =>
    new Promise((resolve, reject) => {
      if (session.aborted || ws.readyState !== ws.OPEN) {
        return reject(new Error('ORCHESTRATION_ABORTED'));
      }
      const planId = uuid();
      const timeout = setTimeout(() => {
        if (session.pendingPlans.has(planId)) {
          session.pendingPlans.delete(planId);
          resolve(false); // Auto-reject on timeout
        }
      }, 5 * 60_000);

      session.pendingPlans.set(planId, { resolve, reject, timeout });
      send({ type: 'plan_request', planId, steps, risks });
    });

  // ── Message router ────────────────────────────────────────────────────────
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    touchUserInteraction();

    switch (msg.type) {

      // ════════════════════════════════════════════════════════════════════
      // USER SENDS PROMPT
      // ════════════════════════════════════════════════════════════════════
      case 'prompt': {
        try {
          assertUserNotSuspended(auth.user.id);
        } catch (error) {
          send({ type: 'error', code: error.code || 'USER_SUSPENDED', message: error.message });
          break;
        }
        session.aborted = false;
        session.pausedState = null;
        // Gap #3: Basic Rate Limiting (20 prompts / 15 min)
        const now = Date.now();
        const WINDOW_MS = 15 * 60 * 1000;
        const MAX_PROMPTS = 20;

        session.promptHistory = (session.promptHistory || []).filter(t => now - t < WINDOW_MS);
        if (session.promptHistory.length >= MAX_PROMPTS) {
          send({ type: 'error', message: 'Rate limit exceeded. Please wait a few minutes before sending more prompts.' });
          break;
        }
        session.promptHistory.push(now);

        const { prompt, effortLevel = 'standard' } = msg;
        const previousRunIdentity = session.currentRunIdentity;
        const rootRunIdentity = createRootRunIdentity({ expert: 'manager' });
        rootRunIdentity.sessionId = auth.sessionId;
        rootRunIdentity.userId = auth.user.id;
        session.currentRunIdentity = rootRunIdentity;

        if (!String(auth.sessionId || '').startsWith('external:')) {
          const activeSession = await assertSessionStillValid(auth.sessionId, auth.user.id);
          if (!activeSession) {
            send({
              type: 'reauth_required',
              error: 'Session has expired or been revoked. Please sign in again.',
              code: 'SESSION_REAUTH_REQUIRED'
            });
            session.currentRunIdentity = previousRunIdentity;
            break;
          }
        }

        if (!acquireRun(auth.user.id, rootRunIdentity.runId)) {
          send({
            type: 'error',
            message: `Concurrency limit exceeded. A maximum of ${getRunConcurrencyLimit()} concurrent agent runs is permitted per user.`
          });
          send({
            type: 'concurrency_exceeded',
            error: 'Too Many Requests',
            code: 'CONCURRENCY_LIMIT_EXCEEDED',
            retryAfterSeconds: getConcurrencyRetryAfterSeconds()
          });
          session.currentRunIdentity = previousRunIdentity;
          break;
        }

        await persistRun(rootRunIdentity, {
          userId: auth.user.id,
          projectName: 'default',
          prompt,
          status: 'running',
          metadata: { effortLevel, transport: 'websocket' },
        });
        send({
          type: 'state_change',
          state: 'run_started',
          message: 'Selina orchestration run started.',
          metadata: { run: rootRunIdentity },
        });
        send({ type: 'thinking', value: true });

        try {
          // ── emitState: forward agent state transitions to the frontend
          const emitState = (state, message) => {
            send({ type: 'status', state, message });
          };

          const result = await orchestrator.handlePrompt(
            prompt,
            effortLevel,
            onToolCall,
            onThought,
            onClarification,
            onPlan,
            undefined, // onMemoryUpdate (handled internally by orchestrator)
            emitState,
            (delta) => send({ type: 'stream_chunk', delta }),
            rootRunIdentity,
          );

          // handlePrompt returns the expert's final result object.
          // The 'content' field is the prose response; toolCalls are for
          // internal use and should not be forwarded to the client.
          const content = typeof result === 'string'
            ? result
            : result?.content ?? '[Agent completed with no text output.]';

          send({ type: 'result', content });
        } catch (err) {
          if (err.message === 'ORCHESTRATION_ABORTED') {
            logger.warn('Orchestration aborted mid-workflow due to session fingerprint change or WebSocket disconnect.');
          } else if (err.code === 'PROMPT_GUARD_REJECTED') {
            send({
              type: 'error',
              code: 'PROMPT_GUARD_REJECTED',
              message: 'This request was blocked by the prompt-injection guard before planning.',
              details: err.details || null,
            });
          } else if (err instanceof DailyTokenQuotaExceededError || err.code === 'DAILY_TOKEN_QUOTA_EXCEEDED') {
            send({
              type: 'quota_exceeded',
              code: 'DAILY_TOKEN_QUOTA_EXCEEDED',
              message: 'Daily token quota exceeded for this session. Please try again after the quota resets.',
              usage: err.usage,
              limit: err.limit,
            });
          } else if (err.code === 'LLM_RATE_LIMIT_EXCEEDED') {
            send({
              type: 'rate_limited',
              code: 'LLM_RATE_LIMIT_EXCEEDED',
              message: 'Too many LLM completions in the last minute. Please retry shortly.',
              retryAfterSeconds: err.retryAfterSeconds || 60,
            });
          } else {
            send({ type: 'error', message: err.message });
          }
        } finally {
          send({ type: 'thinking', value: false });
          session.currentRunIdentity = previousRunIdentity;
          releaseRun(auth.user.id, rootRunIdentity.runId);
        }
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // CLIENT-SIDE TOOL COMPLETED (VFS / WebContainer)
      // ════════════════════════════════════════════════════════════════════
      case 'tool_response': {
        const { callId, result, error } = msg;
        const pending = session.pendingToolCalls.get(callId);
        if (!pending) break; // Already timed out — discard

        clearTimeout(pending.timeout);
        session.pendingToolCalls.delete(callId);
        error ? pending.reject(new Error(error)) : pending.resolve(result);
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // USER ANSWERED CLARIFICATION
      // ════════════════════════════════════════════════════════════════════
      case 'clarification_response': {
        const { clarificationId, answer } = msg;
        const pending = session.pendingClarifications.get(clarificationId);
        if (!pending) break;

        clearTimeout(pending.timeout);
        session.pendingClarifications.delete(clarificationId);
        pending.resolve(answer);
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // USER APPROVED / REJECTED PLAN
      // ════════════════════════════════════════════════════════════════════
      case 'plan_response': {
        const { planId, approved } = msg;
        const pending = session.pendingPlans.get(planId);
        if (!pending) break;

        clearTimeout(pending.timeout);
        session.pendingPlans.delete(planId);
        pending.resolve(!!approved);
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // REGISTER GITHUB TOKEN (PAT mode)
      // The client sends the user's PAT after OAuth. It lives only in the
      // session object in memory — never written to DB or logged.
      // ════════════════════════════════════════════════════════════════════
      case 'set_github_token': {
        session.githubPAT = msg.token; // volatile — lost when session closes
        send({ type: 'ack', message: 'GitHub token registered for this session.' });
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // REGISTER GITHUB APP INSTALLATION
      // ════════════════════════════════════════════════════════════════════
      case 'set_installation_id': {
        session.githubInstallationId = msg.installationId;
        send({ type: 'ack', message: `Installation ${msg.installationId} registered.` });
        break;
      }

      // ════════════════════════════════════════════════════════════════════
      // TASK MANAGER — Queue Management
      // ════════════════════════════════════════════════════════════════════
      // add_task     — push a task onto the queue
      // run_queue     — start sequential execution
      // cancel_task   — mark a pending task as cancelled
      // abort_queue   — stop after current task finishes
      // get_task_status — return full queue snapshot
      // ════════════════════════════════════════════════════════════════════

      case 'add_task': {
        // Lazy-init the TaskManager on first use
        if (!session.taskManager) {
          const emitState = (state, message) => send({ type: 'status', state, message });
          session.taskManager = new TaskManager(orchestrator, {
            onToolCall,
            onThought,
            onClarification,
            onPlan,
            emitState,
            onStream: (delta) => send({ type: 'stream_chunk', delta }),
            send,
          });
        }
        const { title, prompt: taskPrompt, effortLevel: taskEffort } = msg;
        if (!taskPrompt) { send({ type: 'error', message: 'add_task requires a prompt.' }); break; }
        const id = session.taskManager.addTask(title, taskPrompt, taskEffort);
        send({ type: 'task_added', id, queue: session.taskManager.getStatus() });
        break;
      }

      case 'run_queue': {
        if (!session.taskManager || session.taskManager._pendingCount() === 0) {
          send({ type: 'error', message: 'No pending tasks in the queue.' });
          break;
        }
        // Fire-and-forget — the TaskManager emits events as it progresses
        session.taskManager.runQueue().catch(err =>
          send({ type: 'error', message: `Queue error: ${err.message}` })
        );
        break;
      }

      case 'cancel_task': {
        const cancelled = session.taskManager?.cancelTask(msg.id);
        send({ type: 'ack', message: cancelled ? `Task ${msg.id} cancelled.` : `Task ${msg.id} not found or not cancellable.` });
        break;
      }

      case 'abort_queue': {
        session.taskManager?.abortQueue();
        send({ type: 'ack', message: 'Queue will stop after the current task completes.' });
        break;
      }

      case 'prioritize_task': {
        const prioritized = session.taskManager?.prioritizeTask(msg.id);
        send({ type: 'ack', message: prioritized ? `Task ${msg.id} moved to front.` : `Task ${msg.id} not found.` });
        break;
      }

      case 'get_task_status': {
        const status = session.taskManager?.getStatus() ?? { tasks: [], counts: {}, running: false };
        send({ type: 'task_status', ...status });
        break;
      }

      default:
        break;
    }
  });

  // ── Disconnection cleanup ─────────────────────────────────────────────────
  ws.on('close', () => {
    releaseConnection();
    unregisterSessionCleanup(auth.sessionId, wsSessionCleanup);
    // Cancel all pending timeouts so they don't fire after GC
    clearTimeout(session.pingTimeout);
    clearTimeout(session.idleTimeout);

    for (const p of session.pendingToolCalls.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }
    for (const p of session.pendingClarifications.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }
    for (const p of session.pendingPlans.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }

    // Remove session — lets V8 GC collect the orchestrator, all pending Maps,
    // and the ws reference. Critical: without this, each disconnected session
    // holds ~2–5 MB of orchestrator state alive indefinitely.
    sessions.delete(sessionId);
  });

  ws.on('error', () => {
    releaseConnection();
    unregisterSessionCleanup(auth.sessionId, wsSessionCleanup);
    clearTimeout(session.idleTimeout);

    for (const p of session.pendingToolCalls.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }
    for (const p of session.pendingClarifications.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }
    for (const p of session.pendingPlans.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('ORCHESTRATION_ABORTED'));
    }

    sessions.delete(sessionId);
  });
});

// ─── Boot sequence ─────────────────────────────────────────────────────────────

async function start() {
  // ── Database ────────────────────────────────────────────────────────────
  let dbHealthy = false;
  try {
    logger.info('Startup', 'Initializing database...');
    await initDB();

    // Verify database is actually working with a test query
    const { pool } = await import('./db.js');
    const testResult = await pool.query('SELECT NOW() as current_time');
    logger.info('Startup', 'Database connected successfully at:', { details: testResult.rows[0].current_time });
    dbHealthy = true;
  } catch (err) {
    logger.error('Startup', 'Database initialization failed:', err.message);
    logger.error('Startup', 'Auth features will not work without database connection.');
    // Auth requires DB - log warning but still start server for non-auth features
  }

  // ── Global Error Handling ────────────────────────────────────────────────
  
  // 404 handler
  app.use((req, res) => {
    logger.warn('Route not found', { 
      requestId: req.id,
      method: req.method, 
      url: req.url 
    });
    res.status(404).json({ 
      success: false, 
      error: 'Route not found',
      requestId: req.id 
    });
  });
  
  app.use(sentryErrorHandler());

  // Global error handler
  app.use((err, req, res, next) => {
    logError(err, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      userId: req.user?.id
    });
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({
      success: false,
      error: isDevelopment ? err.message : 'Internal server error',
      requestId: req.requestId,
      ...(isDevelopment && { stack: err.stack })
    });
  });

  // ── HTTP + WS ───────────────────────────────────────────────────────────
  server.listen(port, () => {
    detailedLogger.info('Server', 'Selina server bridge online', { port, environment: process.env.NODE_ENV, instanceId });
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  // Close server on SIGTERM/SIGINT so in-flight WebSocket messages drain
  // and the sandbox service kills its active containers.
  const shutdown = async (signal) => {
    // Close all WS connections
    for (const [, session] of sessions) {
      session.ws.close(1001, 'Server shutting down.');
    }

    server.close(() => process.exit(0));

    // Force exit after 5 s if drain takes too long
    setTimeout(() => process.exit(1), 5_000);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start();
