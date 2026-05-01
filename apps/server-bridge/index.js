import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';

import { initDB } from './db.js';
import { requireAuth, verifyToken } from './auth/middleware.js';
import googleAuth from './auth/google.js';
import githubAuth from './auth/github.js';
import { AgentOrchestrator } from './orchestrator/index.js';
import { githubService } from './github/index.js';
import { securitySandboxService } from './sandbox/security-sandbox.js';
import { creativeService } from './creative/index.js';
import { uiVariantService } from './creative/generate-ui-variant.js';
import { modelService } from './orchestrator/models.js';

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// === Middleware ===
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

// === Auth Routes ===
app.use('/api/auth', googleAuth);
app.use('/api/auth', githubAuth);

// === GitHub Webhooks ===
app.post('/api/github/webhook', async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`[GitHub] Webhook received: ${event}`);

  // In a real scenario, we would verify the signature here.
  // Then route the event to the appropriate agent session.
  
  if (event === 'pull_request' && payload.action === 'opened') {
    // Example: Auto-assign reviewer agent
    console.log(`[GitHub] New PR #${payload.number} in ${payload.repository.full_name}`);
  }

  res.status(200).send('OK');
});

// === GitHub Copilot Extension ===
app.post('/api/copilot/chat', async (req, res) => {
  const { messages, context } = req.body;
  
  console.log('[Copilot] Message received from GitHub Copilot Chat');

  // Copilot Extensions expect a streaming response or a single response.
  // We will route this to our AgentOrchestrator.
  
  try {
    // Mock response for now — in a real setup, this would trigger the swarm
    res.json({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Hello from Vibe Hub! I am your multi-agent swarm. How can I help you with your repository today?'
        }
      }]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process Copilot request' });
  }
});

// === Health ===
app.get('/health', (req, res) => {
  res.json({ status: 'active', version: '3.0.0', brain: 'v3-skills-memory' });
});

// === Protected: User Profile ===
app.get('/api/me', requireAuth, (req, res) => {
  const { id, email, name, avatar_url, provider } = req.user;
  res.json({ id, email, name, avatarUrl: avatar_url, provider });
});

// === WebSocket Server ===
const wss = new WebSocketServer({ server, path: '/ws' });
const sessions = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const decoded = verifyToken(token);

  if (!decoded) {
    ws.close(4001, 'Authentication required.');
    return;
  }

  const sessionId = uuid();
  const orchestrator = new AgentOrchestrator();
  orchestrator.setUser(decoded.id);

  const pendingToolCalls = new Map();
  const pendingClarifications = new Map();
  const pendingPlans = new Map();

  sessions.set(sessionId, { ws, orchestrator, pendingToolCalls, pendingClarifications, pendingPlans, user: decoded });
  console.log(`[WS] Session ${sessionId} connected for user ${decoded.email}`);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      // ========================
      // USER SENDS A NEW PROMPT
      // ========================
      case 'prompt': {
        const { prompt, effortLevel = 'standard' } = msg;
        ws.send(JSON.stringify({ type: 'thinking', value: true }));

        try {
          // Tool dispatch: sends request to client, waits for response
          const onToolCall = async (name, args) => {
            // === Server-Side Tools (v4.1) ===
            
            // 1. GitHub Integration Tools
            if (name.startsWith('github_')) {
              console.log(`[Tool] Server-side GitHub operation: ${name}`);
              // In a real app, we'd fetch the installationId from the DB
              const installationId = msg.githubInstallationId || 'default-installation';
              
              switch (name) {
                case 'github_post_comment':
                  return await githubService.postComment(installationId, args);
                case 'github_create_pr':
                  return await githubService.createPR(installationId, args);
                case 'github_create_codespace':
                  return await githubService.createCodespace(installationId, args);
                default:
                  throw new Error(`Server-side tool ${name} not fully implemented.`);
              }
            }

            // 2. Security Sandbox Tools
            if (name === 'security_sandbox') {
              console.log(`[Tool] Security Sandbox operation: ${args.action}`);
              const installationId = msg.githubInstallationId || 'default-installation';
              
              switch (args.action) {
                case 'create':
                  return await securitySandboxService.create(installationId, args);
                case 'exec':
                  return await securitySandboxService.exec(args.sandboxId, args.command);
                case 'destroy':
                  return await securitySandboxService.destroy(args.sandboxId);
                default:
                  throw new Error(`Security sandbox action ${args.action} not supported.`);
              }
            }

            // 3. Creative Swarm Tools
            if (name === 'design_research') {
              return await creativeService.searchInspiration(args.query, args.source);
            }
            if (name === 'generate_image') {
              return await creativeService.generateAsset(args.prompt, args.style);
            }
            if (name === 'generate_ui_variant') {
              return await uiVariantService.generateVariants(args);
            }

            // 4. Agent HQ: Delegation Tool
            if (name === 'delegate_task') {
              console.log(`[Tool] Agent HQ delegation: ${args.expert} -> ${args.task}`);
              onThought(`Delegating sub-task to ${args.expert}Expert: ${args.task}`);
              
              // Recurse into orchestrator but with the specialist domain
              // This creates a nested loop (hierarchical swarm)
              return await orchestrator.handlePrompt(
                `${args.task}\n\nContext: ${args.context || 'None'}`,
                'standard', // sub-tasks usually run at standard depth
                onToolCall,
                (t) => onThought(`[${args.expert}] ${t}`),
                onClarification,
                onPlan,
                undefined, // Memory update
                (st, val) => ws.send(JSON.stringify({ type: 'status', status: st, value: val }))
              );
            }

            // === Client-Side Tools (VFS/WebContainer) ===
            return new Promise((resolve, reject) => {
              const callId = uuid();
              pendingToolCalls.set(callId, { resolve, reject });

              ws.send(JSON.stringify({ type: 'tool_request', callId, name, args }));

              setTimeout(() => {
                if (pendingToolCalls.has(callId)) {
                  pendingToolCalls.delete(callId);
                  reject(new Error(`Tool call ${name} timed out after 60s.`));
                }
              }, 60000);
            });
          };

          // Thought streaming
          const onThought = (message) => {
            ws.send(JSON.stringify({ type: 'thought', message }));
          };

          // Clarification: sends questions to user, waits for answers
          const onClarification = (questions, context) => {
            return new Promise((resolve) => {
              const clarificationId = uuid();
              pendingClarifications.set(clarificationId, { resolve });

              ws.send(JSON.stringify({
                type: 'clarification_request',
                clarificationId,
                questions,
                context,
              }));

              // Timeout: auto-resolve with "no answer" after 5 minutes
              setTimeout(() => {
                if (pendingClarifications.has(clarificationId)) {
                  pendingClarifications.delete(clarificationId);
                  resolve('User did not respond to clarification request.');
                }
              }, 300000);
            });
          };

          // Plan: sends plan to user for approval
          const onPlan = (steps, risks) => {
            return new Promise((resolve) => {
              const planId = uuid();
              pendingPlans.set(planId, { resolve });

              ws.send(JSON.stringify({
                type: 'plan_request',
                planId,
                steps,
                risks,
              }));

              setTimeout(() => {
                if (pendingPlans.has(planId)) {
                  pendingPlans.delete(planId);
                  resolve(false); // Auto-reject if no response
                }
              }, 300000);
            });
          };

          const result = await orchestrator.handlePrompt(
            prompt, effortLevel, onToolCall, onThought, onClarification, onPlan
          );

          ws.send(JSON.stringify({ type: 'result', content: result }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        } finally {
          ws.send(JSON.stringify({ type: 'thinking', value: false }));
        }
        break;
      }

      // ========================
      // CLIENT COMPLETED A TOOL
      // ========================
      case 'tool_response': {
        const { callId, result, error } = msg;
        const pending = pendingToolCalls.get(callId);
        if (pending) {
          pendingToolCalls.delete(callId);
          error ? pending.reject(new Error(error)) : pending.resolve(result);
        }
        break;
      }

      // ========================
      // USER ANSWERED CLARIFICATION
      // ========================
      case 'clarification_response': {
        const { clarificationId, answer } = msg;
        const pending = pendingClarifications.get(clarificationId);
        if (pending) {
          pendingClarifications.delete(clarificationId);
          pending.resolve(answer);
        }
        break;
      }

      // ========================
      // USER APPROVED/REJECTED PLAN
      // ========================
      case 'plan_response': {
        const { planId, approved } = msg;
        const pending = pendingPlans.get(planId);
        if (pending) {
          pendingPlans.delete(planId);
          pending.resolve(approved);
        }
        break;
      }

      default:
        console.log(`[WS] Unknown message type: ${msg.type}`);
    }
  });

  ws.on('close', () => {
    sessions.delete(sessionId);
    console.log(`[WS] Session ${sessionId} disconnected.`);
  });
});

// === Boot ===
async function start() {
  try {
    await initDB();
    console.log('[DB] PostgreSQL connected.');
  } catch (err) {
    console.warn('[DB] PostgreSQL not available, continuing without DB:', err.message);
  }

  server.listen(port, () => {
    console.log(`\n  🧠 Vibe Brain v3.0 running at http://localhost:${port}`);
    console.log(`  🔌 WebSocket at ws://localhost:${port}/ws`);
    console.log(`  📚 Skills engine loaded.`);
    console.log(`  🗃️  Memory system active.\n`);
  });
}

start();
