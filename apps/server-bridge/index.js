/**
 * server-bridge/index.js — Vibe-Hub Central Nervous System v4.1
 */

import './load-env.js';
import express            from 'express';
import cors               from 'cors';
import { createServer }   from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuid }     from 'uuid';

import { initDB }                from './db.js';
import { requireAuth, verifyToken } from './auth/middleware.js';
import googleAuth                from './auth/google.js';
import githubAuth                from './auth/github.js';
import { AgentOrchestrator }     from './orchestrator/index.js';
import { TaskManager }           from './orchestrator/task-manager.js';
import { githubService }         from './github/index.js';
import { creativeService }       from './creative/index.js';
import { uiVariantService }      from './creative/generate-ui-variant.js';

// ─── Express + HTTP server ────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);
const port   = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

// Restrict CORS to the UI origin in production; allow all in dev.
const UI_ORIGIN = process.env.UI_ORIGIN || true;
app.use(cors({ origin: UI_ORIGIN, credentials: true }));

// 5 MB JSON cap — large enough for paste-in files, prevents body-flood DoS.
app.use(express.json({ limit: '5mb' }));

// Raw body parser for webhook signature verification (must come before JSON).
app.use('/api/github/webhook', express.raw({ type: 'application/json' }));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', googleAuth);
app.use('/api/auth', githubAuth);

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'active',
    version: '4.1.0',
    uptime:  process.uptime(),
    memory:  process.memoryUsage().heapUsed,
  });
});

// ── User profile (protected) ──────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, avatar_url, provider } = req.user;
  res.json({ id, email, name, avatarUrl: avatar_url, provider });
});

// ── GitHub webhooks ───────────────────────────────────────────────────────────
app.post('/api/github/webhook', async (req, res) => {
  // The body arrives as a raw Buffer because of the express.raw() middleware
  // above. We must verify the HMAC signature before processing anything.
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('[GitHub] Webhook signature missing — rejecting.');
    return res.status(403).send('Missing signature.');
  }
  const valid = await githubService.verifyWebhookSignature(req.body, signature);

  if (!valid) {
    console.warn('[GitHub] Webhook signature invalid — rejecting.');
    return res.status(403).send('Invalid signature.');
  }

  const event   = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  console.log(`[GitHub] Webhook: ${event} (${payload.action ?? 'n/a'})`);

  // Handle Action workflow runs (e.g. AI Sandbox results)
  if (event === 'workflow_run') {
    const workflowName = payload.workflow_run.name;
    const conclusion = payload.workflow_run.conclusion;
    console.log(`[GitHub] Workflow ${workflowName} completed with conclusion: ${conclusion}`);
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
    console.log(`[GitHub] PR #${payload.number} opened in ${payload.repository?.full_name}`);
  }

  if (event === 'workflow_run' && payload.action === 'completed') {
      const { workflow_run } = payload;
      console.log(`[GitHub] Workflow ${workflow_run.name} completed with conclusion: ${workflow_run.conclusion}`);

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
});

// ── GitHub Copilot Extension endpoint ─────────────────────────────────────────
// Copilot Extensions use the OpenAI streaming chat completions protocol.
// We translate it to our agent and stream back in SSE format here (the ONE
// place SSE is appropriate: Copilot already handles the bidirectional channel).
app.post('/api/copilot/chat', requireAuth, async (req, res) => {
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
});

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });
app.set('wss', wss);

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
        console.warn(`[WS] Zombie session ${sessionId} — terminating.`);
        session.ws.terminate();
        sessions.delete(sessionId);
      }
    }, PONG_TIMEOUT_MS);
  }
}, PING_INTERVAL_MS);

// Clean up the interval on server shutdown so Node.js can exit cleanly.
server.on('close', () => clearInterval(heartbeatInterval));

// ── Connection handler ────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  // ── Authentication ─────────────────────────────────────────────────────
  const url     = new URL(req.url, `http://${req.headers.host}`);
  const token   = url.searchParams.get('token');
  const decoded = verifyToken(token);

  if (!decoded) {
    ws.close(4001, 'Unauthenticated.');
    return;
  }

  // ── Session bootstrap ──────────────────────────────────────────────────
  const sessionId    = uuid();
  const orchestrator = new AgentOrchestrator();
  orchestrator.setUser(decoded.id);

  const session = {
    ws,
    orchestrator,
    user:                decoded,
    pendingToolCalls:    new Map(),
    pendingClarifications: new Map(),
    pendingPlans:        new Map(),
    pongReceived:        true,
    pingTimeout:         null,
    taskManager:         null, // lazy-init on first task message
  };
  sessions.set(sessionId, session);

  console.log(`[WS] Session ${sessionId} — ${decoded.email} connected.`);

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
      console.log(`[Tool] Sandbox offload requested: ${runtime ?? 'node'} ${scriptPath}`);

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

    // ── 5. Security Sandbox (Gap #9) ─────────────────────────────────
    if (name === 'security_sandbox') {
      try {
        // Delegated to GitHub Actions for execution
      console.log(`[Sandbox] Offloading execution to GitHub Actions via workflow_dispatch`);
      try {
        await githubService.octokit.rest.actions.createWorkflowDispatch({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          workflow_id: 'ai-sandbox.yml',
          ref: 'main' // In a real app, infer the current branch
        });
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
      return JSON.stringify({
        success: true,
        message: 'Execution offloaded to GitHub Actions. Listening for webhook completion.'
      });
        return JSON.stringify(result);
      } catch (err) {
        return `ERROR: ${err.message}`;
      }
    }

    // ── 6. Auto-Sandbox for run_command ─────────────────────────────
    // If the agent tries to run a script directly, force it into the sandbox.
    if (name === 'run_command' && args.command) {
      const scriptCommands = ['node', 'npm', 'python3', 'python', 'bun', 'sh', 'bash'];
      const isScript = scriptCommands.includes(args.command);
      
      if (isScript) {
        console.log(`[Orchestrator] Auto-sandboxing command: ${args.command} ${args.args?.join(' ')}`);
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
          console.warn('[Orchestrator] Auto-sandbox dispatch failed:', err.message);
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
          console.error(`[WS] Prompt error for session ${sessionId}:`, err.message);
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
        console.warn(`[WS] Unknown message type: ${msg.type}`);
    }
  });

  // ── Disconnection cleanup ─────────────────────────────────────────────────
  ws.on('close', () => {
    // Cancel all pending timeouts so they don't fire after GC
    clearTimeout(session.pingTimeout);

    for (const p of session.pendingToolCalls.values())    clearTimeout(p.timeout);
    for (const p of session.pendingClarifications.values()) clearTimeout(p.timeout);
    for (const p of session.pendingPlans.values())        clearTimeout(p.timeout);

    // Remove session — lets V8 GC collect the orchestrator, all pending Maps,
    // and the ws reference. Critical: without this, each disconnected session
    // holds ~2–5 MB of orchestrator state alive indefinitely.
    sessions.delete(sessionId);
    console.log(`[WS] Session ${sessionId} closed. Active sessions: ${sessions.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Session ${sessionId} error:`, err.message);
  });
});

// ─── Boot sequence ─────────────────────────────────────────────────────────────

async function start() {
  // ── Database ────────────────────────────────────────────────────────────
  try {
    await initDB();
    console.log('[DB] PostgreSQL ready.');
  } catch (err) {
    // Non-fatal: memory and skill systems still work without DB.
    console.warn('[DB] Not available — continuing without persistence:', err.message);
  }

  // ── HTTP + WS ───────────────────────────────────────────────────────────
  server.listen(port, () => {
    const pad = (s) => s.padEnd(42);
    console.log('\n' + '═'.repeat(50));
    console.log(`  🧠 Vibe-Hub Server v4.1`);
    console.log('─'.repeat(50));
    console.log(`  ${pad('HTTP  →')} http://localhost:${port}`);
    console.log(`  ${pad('WS    →')} ws://localhost:${port}/ws`);
    console.log(`  ${pad('Health →')} http://localhost:${port}/health`);
    console.log('═'.repeat(50) + '\n');
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  // Close server on SIGTERM/SIGINT so in-flight WebSocket messages drain
  // and the sandbox service kills its active containers.
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);

    // Drain active sandbox containers first (most critical)
    // securitySandboxService removed

    // Close all WS connections
    for (const [, session] of sessions) {
      session.ws.close(1001, 'Server shutting down.');
    }

    server.close(() => {
      console.log('[Server] HTTP server closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 5 s if drain takes too long
    setTimeout(() => process.exit(1), 5_000);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start();
