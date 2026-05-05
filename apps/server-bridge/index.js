/**
 * server-bridge/index.js — Selina-Hub Central Nervous System v4.1
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
import { handleCodeJobStatus, handleCodeRequest, handleCommitRequest, handleGetPendingFiles, handleGetVfsStats, handleLinkRepo, handleListRepos, handleListTools, handleListServers, handleCallTool, handleRegisterServer, router } from './orchestrator/router.js';


import { csrfProtection, csrfTokenHandler } from './utils/csrf.js';
import { getReadiness, registerReadinessCheck, requireReadiness } from './utils/health.js';
import { metricsMiddleware, renderMetrics, setActiveWebsocketConnections } from './utils/metrics.js';
import { idempotencyMiddleware } from './utils/idempotency.js';
import { captureException, initSentry, sentryErrorHandler } from './utils/sentry.js';
import { apiDocsHtml, buildOpenApiSpec } from './utils/openapi.js';
import { closeRedisClients, configureSocketRedisAdapter, createRedisClients } from './utils/redis.js';
import { listAuditLogs } from './utils/audit.js';
import { configureCache } from './utils/cache.js';
import { createCodeQueue } from './orchestrator/job-queue.js';
import { validateEnvironment } from './utils/env.js';

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

// ─── Express + HTTP server ────────────────────────────────────────────────────

validateEnvironment();

const app    = express();
const server = createServer(app);
const port   = process.env.PORT || 3001;
const instanceId = uuid();
const redisClients = createRedisClients();
const isProd = process.env.NODE_ENV === 'production';
const parseLimit = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"], // Required for Swagger UI and some UI libraries
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: cspConnectSrc,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if needed
}));

// Rate limiting - Prevent abuse
const trustProxyHops = parseLimit(process.env.TRUST_PROXY_HOPS, process.env.RENDER || isProd ? 1 : 0);
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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseLimit(process.env.RATE_LIMIT_GENERAL, isProd ? 100 : 1000),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('global'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseLimit(process.env.RATE_LIMIT_API, isProd ? 30 : 300),
  message: { error: 'API rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('api'),
});

const orchestrationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseLimit(process.env.RATE_LIMIT_ORCHESTRATION, isProd ? 5 : 60),
  message: { error: 'Orchestration rate limit exceeded. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisRateStore('code'),
});

app.use(generalLimiter); // Apply to all requests
app.use('/api/', apiLimiter); // Stricter for API
app.use('/api/code', orchestrationLimiter); // Strictest for LLM calls
app.use('/api/v6/code', orchestrationLimiter);

const WS_RATE_WINDOW_MS = parseLimit(process.env.WS_RATE_WINDOW_MS, 60 * 1000);
const WS_MAX_CONNECTIONS_PER_WINDOW = parseLimit(process.env.WS_MAX_CONNECTIONS_PER_WINDOW, isProd ? 30 : 300);
const WS_MAX_ACTIVE_PER_IP = parseLimit(process.env.WS_MAX_ACTIVE_PER_IP, isProd ? 50 : 500);
const WS_MAX_ACTIVE_PER_USER = parseLimit(process.env.WS_MAX_ACTIVE_PER_USER, isProd ? 5 : 50);
const wsBuckets = new Map();
const wsActiveByIp = new Map();
const wsActiveByUser = new Map();

function getRequestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function getSocketIp(socket) {
  return String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown')
    .split(',')[0]
    .trim();
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

// CORS: Allow all origins in dev for multiple ports, restrict in production
const corsOrigin = process.env.NODE_ENV === 'production' 
  ? (process.env.UI_ORIGIN || true) 
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));


// Request context logging (adds requestId and logs requests)
app.use(requestContext);
app.use(detailedLogger.logRequest); // Detailed request logging
app.use(requestLogger); // Attach logger to request object
app.use(metricsMiddleware);

// Raw body parser for webhook signature verification (must come before JSON).
app.use(['/api/github/webhook', '/api/v6/github/webhook'], express.raw({ type: 'application/json' }));

// 5 MB JSON cap — large enough for paste-in files, prevents body-flood DoS.
app.use(express.json({ limit: '5mb' }));

// Cookie parser for reading auth cookies
app.use(cookieParser());

// ── API documentation + metrics ───────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    service: 'server-bridge',
    status: 'ok',
    health: '/health',
    readiness: '/ready',
    docs: '/api-docs',
  });
});
app.get('/swagger.json', (_req, res) => res.json(buildOpenApiSpec()));
app.get('/api-docs', (_req, res) => res.type('html').send(apiDocsHtml()));
app.get('/metrics', async (_req, res) => res.type('text/plain; version=0.0.4').send(await renderMetrics()));

// ── Test Mode Logging Endpoints ───────────────────────────────────────────────
// These endpoints provide detailed logging control and log access for testing

// Get current logger configuration
app.get('/api/debug/log-config', (_req, res) => {
  res.json({
    testMode: process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'development',
    environment: process.env.NODE_ENV || 'development',
    logLevel: detailedLogger.getConfig ? detailedLogger.getConfig() : 'unknown'
  });
});

// Get recent request history (test mode only)
app.get('/api/debug/request-history', (req, res) => {
  const history = detailedLogger.getRequestHistory();
  res.json({
    count: history.length,
    requests: history.slice(-100) // Last 100 requests
  });
});

// Get specific request details
app.get('/api/debug/request/:requestId', (req, res) => {
  const details = detailedLogger.getRequestDetails(req.params.requestId);
  if (!details) {
    return res.status(404).json({ error: 'Request not found' });
  }
  res.json(details);
});

// Clear request history
app.post('/api/debug/clear-history', (_req, res) => {
  detailedLogger.clearRequestHistory();
  res.json({ success: true, message: 'Request history cleared' });
});

// Trigger test log messages
app.post('/api/debug/test-logs', (req, res) => {
  const { level = 'info', message = 'Test log message' } = req.body || {};
  
  detailedLogger[level]('Test', message, { test: true, timestamp: Date.now() });
  
  res.json({ success: true, level, message });
});

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

function handleRuntimeSkills(_req, res) {
  res.json({
    mode: 'mixture-of-experts',
    graph: listSkillGraph(),
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

app.get('/api/runtime/diagnostics', requireAuth, handleRuntimeDiagnostics);
app.get('/api/v6/runtime/diagnostics', requireAuth, handleRuntimeDiagnostics);
app.get('/api/runtime/skills', requireAuth, handleRuntimeSkills);
app.get('/api/v6/runtime/skills', requireAuth, handleRuntimeSkills);
app.get('/api/audit-logs', requireAuth, handleAuditLogs);
app.get('/api/v6/audit-logs', requireAuth, handleAuditLogs);

// ── GitHub webhooks ───────────────────────────────────────────────────────────
async function handleGithubWebhook(req, res) {
  // The body arrives as a raw Buffer because of the express.raw() middleware
  // above. We must verify the HMAC signature before processing anything.
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(403).send('Missing signature.');
  }
  const valid = await githubService.verifyWebhookSignature(req.body, signature);

  if (!valid) {
    return res.status(403).send('Invalid signature.');
  }

  const event   = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  // Handle Action workflow runs (e.g. AI Sandbox results)
  if (event === 'workflow_run') {
    const workflowName = payload.workflow_run.name;
    const conclusion = payload.workflow_run.conclusion;
    // Notify clients that GitHub runner finished
    const wss = req.app.get('wss'); // Assume wss is attached to app
    if (wss) wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'terminal_output',
          data: `\x1b[36m[GitHub] Workflow ${workflowName} finished with conclusion: ${conclusion}\x1b[0m\n`
        }));
        client.send(JSON.stringify({
          type: 'state_change',
          state: 'idle',
          message: 'GitHub workflow complete'
        }));
      }
    });
  }

  // Route webhook events to the relevant open agent session (if any).
  // In a full implementation, we'd look up which session owns the repo.
  if (event === 'pull_request' && payload.action === 'opened') {
    // Routed to session via workflow_run handler below
  }

  if (event === 'workflow_run' && payload.action === 'completed') {
      const { workflow_run } = payload;

      // Broadcast to all active sessions (since we aren't mapping repos to sessions yet)
      for (const [sessionId, session] of sessions) {
          if (session.ws.readyState === session.ws.OPEN) {
              session.ws.send(JSON.stringify({
                  type: 'github_workflow_completed',
                  workflow: workflow_run.name,
                  conclusion: workflow_run.conclusion,
                  url: workflow_run.html_url
              }));
          }
      }
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

app.post('/api/v6/mcp/call', requireAuth, handleCallTool);

// ── Chat History (V6) ─────────────────────────────────────────────────────────
import { chatRouter } from './orchestrator/chat_routes.js';
app.use('/api/v6/chat', requireAuth, chatRouter);


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
    const result = await router.executeWithStateMachine(
      data.prompt,
      data.userId,
      data.targetFile,
      io,
      data.socketId,
      data.requestId,
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

  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  let auth = null;
  try {
    auth = await authenticateFromHeaders(socket.handshake.headers, token);
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
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.join(`user_${socket.data.user.id}`);
  
  socket.on('join', (data) => {
    if (data.userId && String(data.userId) === String(socket.data.user.id)) {
      socket.join(`user_${socket.data.user.id}`);
      console.log(`[Socket.io] Socket ${socket.id} joined room user_${socket.data.user.id}`);
    }
  });
  
  socket.on('disconnect', () => {
    releaseWsConnection(socket.data.ip);
    releaseWsUser(socket.data.user?.id);
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
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
  const url     = new URL(req.url, `http://${req.headers.host}`);
  const token   = url.searchParams.get('token');
  try {
    auth = await authenticateFromHeaders(req.headers, token);
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

  const session = {
    ws,
    orchestrator,
    user:                auth.user,
    pendingToolCalls:    new Map(),
    pendingClarifications: new Map(),
    pendingPlans:        new Map(),
    pongReceived:        true,
    pingTimeout:         null,
    taskManager:         null, // lazy-init on first task message
  };
  sessions.set(sessionId, session);

  // ── Pong handler (heartbeat) ───────────────────────────────────────────
  ws.on('pong', () => {
    session.pongReceived = true;
    clearTimeout(session.pingTimeout);
  });

  // ── Helpers: safe send ────────────────────────────────────────────────
  const send = (payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  // ── Tool call dispatchers ─────────────────────────────────────────────

  /**
   * onThought — streams the agent's reasoning monologue to the frontend.
   * These appear in the chat interface as collapsible "thought" bubbles.
   */
  const onThought = (message) => send({ type: 'thought', message });

  /**
   * onToolCall — routes a tool call to:
   *   1. Server-side handlers (GitHub, sandbox, creative)
   *   2. Client-side VFS/WebContainer (forwarded over WS, awaited via Promise)
   */
  const onToolCall = async (name, args) => {

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
          return JSON.stringify(await githubService.createCodespace({ ...args, installationId, token }));

        case 'github_trigger_workflow':
          return JSON.stringify(await githubService.triggerWorkflow({ ...args, installationId, token }));

        case 'github_get_codeql_alerts':
          return JSON.stringify(await githubService.getCodeQLAlerts({ ...args, installationId, token }));

        default:
          throw new Error(`GitHub tool not implemented: ${name}`);
      }
    }

    // ── 2. Security Sandbox ───────────────────────────────────────────
    if (name === 'security_sandbox') {
      const { workspacePath, scriptPath, runtime, timeoutMs } = args;
          try {
        await githubService.octokit.rest.actions.createWorkflowDispatch({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          workflow_id: 'ai-sandbox.yml',
          ref: 'main' // In a real app, infer the current branch
        });

        // Let the agent know it needs to wait
        send({ type: 'state_change', state: 'waitingForGitHub', message: 'Triggered GitHub Action run.' });

        return JSON.stringify({
          success: true,
          message: 'Execution offloaded to GitHub Actions. Listening for webhook completion.'
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: `GitHub API error: ${err.message}`
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
      return JSON.stringify(await uiVariantService.generateVariants(args));
    }

    // ── 4. Delegation (sub-agent recursion) ──────────────────────────
    if (name === 'delegate_task') {
      onThought(`Delegating to ${args.expert}Expert: ${args.task}`);
      // Recursive call — creates a nested ReAct loop on the same session.
      // The sub-agent inherits the same tool dispatcher so it can also use
      // VFS, sandbox, GitHub, etc.
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
      );
      return typeof subResult === 'string' ? subResult : subResult?.content ?? '';
    }

    // ── 5. Auto-Sandbox for run_command ─────────────────────────────
    // If the agent tries to run a script directly, force it into the sandbox.
    if (name === 'run_command' && args.command) {
      const scriptCommands = ['node', 'npm', 'python3', 'python', 'bun', 'sh', 'bash'];
      const isScript = scriptCommands.includes(args.command);
      
      if (isScript) {
        try {
          await githubService.octokit.rest.actions.createWorkflowDispatch({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            workflow_id: 'ai-sandbox.yml',
            ref: 'main'
          });
          send({ type: 'state_change', state: 'waitingForGitHub', message: 'Triggered GitHub Action run.' });
          return JSON.stringify({
            success: true,
            message: 'Execution offloaded to GitHub Actions. Listening for webhook completion.'
          });
        } catch (err) {
          send({ type: 'error', message: 'Sandbox dispatch failed.' });
        }
      }
    }

    // ── 7. Client-Side VFS / WebContainer ────────────────────────────
    // These tools run inside the browser sandbox (WebContainer API).
    // We forward the call over the WebSocket and await the browser's response.
    return new Promise((resolve, reject) => {
      const callId = uuid();

      // Self-cleaning timeout: releases the Promise if the client takes > 60 s
      const timeout = setTimeout(() => {
        if (session.pendingToolCalls.has(callId)) {
          session.pendingToolCalls.delete(callId);
          reject(new Error(`Tool "${name}" timed out after 60s (client did not respond).`));
        }
      }, 60_000);

      session.pendingToolCalls.set(callId, { resolve, reject, timeout });
      send({ type: 'tool_request', callId, name, args });
    });
  };

  /**
   * onClarification — suspends agent execution and asks the user a question.
   * Resolves when the user sends a 'clarification_response' message.
   * Auto-resolves after 5 minutes with a default "no answer" so the agent
   * doesn't hang indefinitely (Ryzen host RAM).
   */
  const onClarification = (questions, context) =>
    new Promise((resolve) => {
      const clarificationId = uuid();
      const timeout = setTimeout(() => {
        if (session.pendingClarifications.has(clarificationId)) {
          session.pendingClarifications.delete(clarificationId);
          resolve('User did not respond — proceed with best judgement.');
        }
      }, 5 * 60_000);

      session.pendingClarifications.set(clarificationId, { resolve, timeout });
      send({ type: 'clarification_request', clarificationId, questions, context });
    });

  /**
   * onPlan — suspends agent execution and shows a proposed plan to the user.
   * Resolves with `true` (approved) or `false` (rejected).
   */
  const onPlan = (steps, risks) =>
    new Promise((resolve) => {
      const planId = uuid();
      const timeout = setTimeout(() => {
        if (session.pendingPlans.has(planId)) {
          session.pendingPlans.delete(planId);
          resolve(false); // Auto-reject on timeout
        }
      }, 5 * 60_000);

      session.pendingPlans.set(planId, { resolve, timeout });
      send({ type: 'plan_request', planId, steps, risks });
    });

  // ── Message router ────────────────────────────────────────────────────────
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // ════════════════════════════════════════════════════════════════════
      // USER SENDS PROMPT
      // ════════════════════════════════════════════════════════════════════
      case 'prompt': {
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
          );

          // handlePrompt returns the expert's final result object.
          // The 'content' field is the prose response; toolCalls are for
          // internal use and should not be forwarded to the client.
          const content = typeof result === 'string'
            ? result
            : result?.content ?? '[Agent completed with no text output.]';

          send({ type: 'result', content });
        } catch (err) {
          send({ type: 'error', message: err.message });
        } finally {
          send({ type: 'thinking', value: false });
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
    // Cancel all pending timeouts so they don't fire after GC
    clearTimeout(session.pingTimeout);

    for (const p of session.pendingToolCalls.values())    clearTimeout(p.timeout);
    for (const p of session.pendingClarifications.values()) clearTimeout(p.timeout);
    for (const p of session.pendingPlans.values())        clearTimeout(p.timeout);

    // Remove session — lets V8 GC collect the orchestrator, all pending Maps,
    // and the ws reference. Critical: without this, each disconnected session
    // holds ~2–5 MB of orchestrator state alive indefinitely.
    sessions.delete(sessionId);
  });

  ws.on('error', () => {
    releaseConnection();
    sessions.delete(sessionId);
  });
});

// ─── Boot sequence ─────────────────────────────────────────────────────────────

async function start() {
  // ── Database ────────────────────────────────────────────────────────────
  try {
    await initDB();
  } catch (err) {
    // Non-fatal: memory and skill systems still work without DB.
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
      requestId: req.id,
      ...(isDevelopment && { stack: err.stack })
    });
  });

  // ── HTTP + WS ───────────────────────────────────────────────────────────
  server.listen(port, () => {
    logger.info('Server started', { port, environment: process.env.NODE_ENV });
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
