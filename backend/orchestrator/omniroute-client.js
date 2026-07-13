/**
 * OmniRoute Client — singleton LLM gateway for all Vibe-Hub agent calls.
 * OmniRoute handles: provider selection, key rotation, fallback, circuit breakers,
 * rate limiting, semantic caching. We just call one endpoint.
 *
 * Env vars:
 *   OMNIROUTE_BASE_URL   (default: http://localhost:20128/v1)
 *   OMNIROUTE_API_KEY    (required — copy from OmniRoute dashboard → Endpoints)
 *   OMNIROUTE_PLANNER_MODEL  (default: auto)
 *   OMNIROUTE_WORKER_MODEL   (default: auto)
 *   SESSION_TOKEN_BUDGET     (default: 100000 — enforced via Redis, see task 3)
 */

import IORedis from 'ioredis';
import logger from '../utils/detailed-logger.js';

const BASE_URL = (process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, '');
const API_KEY  = process.env.OMNIROUTE_API_KEY || '';
const PLANNER_MODEL = process.env.OMNIROUTE_PLANNER_MODEL || 'auto';
const WORKER_MODEL  = process.env.OMNIROUTE_WORKER_MODEL  || 'auto';
const SESSION_BUDGET = parseInt(process.env.SESSION_TOKEN_BUDGET || '100000', 10);

if (!API_KEY) {
  logger.warn('OmniRoute', 'OMNIROUTE_API_KEY is not set. Calls will likely fail with 401.');
}

// ─── Redis-backed token budget (multi-worker safe) ───────────────────────────
let _redis = null;
function getRedis() {
  if (!_redis && process.env.REDIS_URL) {
    _redis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      lazyConnect: true,
    });
    _redis.on('error', (err) => logger.error('OmniRoute:Redis', 'Budget tracker error', { err: err.message }));
  }
  return _redis;
}

async function getBudgetUsage(sessionId) {
  if (!sessionId) return 0;
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const val = await redis.get(`omni_budget:${sessionId}`);
    return parseInt(val || '0', 10);
  } catch { return 0; }
}

async function addBudgetUsage(sessionId, tokens) {
  if (!sessionId || tokens <= 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incrby(`omni_budget:${sessionId}`, tokens);
    await redis.expire(`omni_budget:${sessionId}`, 86400); // 24h TTL
  } catch { /* non-fatal */ }
}

// ─── Rough token estimate (tiktoken not required — OmniRoute usage is authoritative) ─
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

// ─── Core call ────────────────────────────────────────────────────────────────
export async function callOmniRoute({
  systemPrompt,
  userPrompt,
  role = 'worker',          // 'planner' | 'worker'
  jsonMode = false,
  maxOutputTokens = 2048,
  sessionId = null,
  userId = 'anonymous',
  bypassCache = false,
  temperature = 0.2,
}) {
  const model = role === 'planner' ? PLANNER_MODEL : WORKER_MODEL;

  // Pre-flight budget check
  if (sessionId) {
    const usage = await getBudgetUsage(sessionId);
    if (usage > SESSION_BUDGET) {
      const err = new Error(`Session token budget exceeded (${usage}/${SESSION_BUDGET})`);
      err.code = 'TOKEN_BUDGET_EXCEEDED';
      err.status = 429;
      throw err;
    }
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: String(systemPrompt || '') },
      { role: 'user',   content: String(userPrompt || '') },
    ],
    temperature,
    max_tokens: maxOutputTokens,
    stream: false,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    ...(bypassCache ? { 'x-omni-cache': 'bypass' } : {}),
  };

  const start = Date.now();
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    logger.error('OmniRoute', 'Network error reaching OmniRoute', { err: networkErr.message });
    throw networkErr;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`OmniRoute returned ${response.status}: ${body}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const durationMs = Date.now() - start;

  // Post-flight budget update (actual tokens from OmniRoute response)
  const inputTokens  = data.usage?.prompt_tokens     || estimateTokens(systemPrompt + userPrompt);
  const outputTokens = data.usage?.completion_tokens || estimateTokens(text);
  await addBudgetUsage(sessionId, inputTokens + outputTokens);

  logger.info('OmniRoute', `${role} call completed`, {
    model: data.model || model,
    durationMs,
    inputTokens,
    outputTokens,
    userId,
    sessionId,
  });

  return text;
}

// ─── Convenience wrappers (drop-in for existing callRoutedTextModel contract) ─
export async function callOmniRoutePlanner(systemPrompt, userPrompt, options = {}) {
  return callOmniRoute({ ...options, systemPrompt, userPrompt, role: 'planner' });
}

export async function callOmniRouteWorker(systemPrompt, userPrompt, options = {}) {
  return callOmniRoute({ ...options, systemPrompt, userPrompt, role: 'worker' });
}
