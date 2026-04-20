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
          const onToolCall = (name, args) => {
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
