import logger from '../utils/detailed-logger.js';
import { redactPromptLikeFields } from './prompt-secrets.js';

export class LlmRateLimitError extends Error {
  constructor(userId, retryAfterSeconds) {
    super(`LLM completion rate limit exceeded for user ${userId}. Retry after ${retryAfterSeconds}s.`);
    this.name = 'LlmRateLimitError';
    this.code = 'LLM_RATE_LIMIT_EXCEEDED';
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DailyTokenQuotaExceededError extends Error {
  constructor(sessionId, usage, limit) {
    super(`Daily token quota exceeded for session ${sessionId}. Usage ${usage}/${limit}.`);
    this.name = 'DailyTokenQuotaExceededError';
    this.code = 'DAILY_TOKEN_QUOTA_EXCEEDED';
    this.status = 402;
    this.sessionId = sessionId;
    this.usage = usage;
    this.limit = limit;
  }
}

export class ExpensiveStepConfirmationRequiredError extends Error {
  constructor(operation) {
    super(`Additional confirmation is required before running expensive operation: ${operation}.`);
    this.name = 'ExpensiveStepConfirmationRequiredError';
    this.code = 'EXPENSIVE_STEP_CONFIRMATION_REQUIRED';
    this.status = 409;
  }
}

const llmCallLogByUser = new Map();
const sessionTokenUsage = new Map();
const billingEvents = [];
const suspendedUsers = new Map();

const DEGRADE_THRESHOLD = Number.parseFloat(process.env.SELINA_TOKEN_DEGRADE_THRESHOLD || '0.8');
const LLM_WINDOW_MS = 60_000;
const BILLING_EVENT_LIMIT = Number.parseInt(process.env.SELINA_BILLING_EVENT_BUFFER || '1000', 10);

export function enforceLlmRateLimit({ userId = 'anonymous', now = Date.now() } = {}) {
  const key = String(userId || 'anonymous');
  const limit = getLlmCallsPerMinute();
  const windowStart = now - LLM_WINDOW_MS;
  const entries = (llmCallLogByUser.get(key) || []).filter(ts => ts > windowStart);
  if (entries.length >= limit) {
    const oldest = entries[0] || now;
    throw new LlmRateLimitError(key, Math.max(1, Math.ceil((oldest + LLM_WINDOW_MS - now) / 1000)));
  }
  entries.push(now);
  llmCallLogByUser.set(key, entries);
  return { allowed: true, remaining: Math.max(0, limit - entries.length) };
}

export function assertUserNotSuspended(userId) {
  const suspension = suspendedUsers.get(String(userId || 'anonymous'));
  if (!suspension) return;
  const error = new Error(`User ${userId} is suspended by the cost monitor.`);
  error.code = 'USER_COST_SUSPENDED';
  error.status = 403;
  error.suspension = suspension;
  throw error;
}

export function getDailySessionTokenUsage(sessionId, now = new Date()) {
  const key = tokenUsageKey(sessionId, now);
  return sessionTokenUsage.get(key) || 0;
}

export function shouldDegradeForTokenBudget(sessionId, now = new Date()) {
  if (!sessionId) return false;
  return getDailySessionTokenUsage(sessionId, now) >= getDailyTokenLimit() * DEGRADE_THRESHOLD;
}

export function applyBudgetPolicyToProfile(profile, context = {}) {
  if (!profile || !shouldDegradeForTokenBudget(context.sessionId)) return profile;
  return {
    ...profile,
    model: smallModelForProvider(profile.provider, profile.model),
    maxOutputTokens: Math.min(profile.maxOutputTokens || 1024, 1024),
    degradedForBudget: true,
  };
}

export function recordSessionTokenUsage({
  userId = 'anonymous',
  sessionId,
  provider = 'unknown',
  model = 'unknown',
  inputTokens = 0,
  outputTokens = 0,
  now = new Date(),
} = {}) {
  if (!sessionId) {
    return { usage: 0, limit: getDailyTokenLimit(), ratio: 0, degraded: false, exceeded: false };
  }

  const totalTokens = Number(inputTokens || 0) + Number(outputTokens || 0);
  const key = tokenUsageKey(sessionId, now);
  const usage = (sessionTokenUsage.get(key) || 0) + totalTokens;
  const limit = getDailyTokenLimit();
  sessionTokenUsage.set(key, usage);

  const ratio = limit > 0 ? usage / limit : 0;
  const status = {
    usage,
    limit,
    ratio,
    degraded: ratio >= DEGRADE_THRESHOLD,
    exceeded: usage >= limit,
  };

  recordBillingEvent({
    kind: 'llm_token_usage',
    userId,
    sessionId,
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    quota: status,
  });

  if (status.exceeded) {
    throw new DailyTokenQuotaExceededError(sessionId, usage, limit);
  }

  return status;
}

export async function requireExpensiveStepConfirmation({
  user = null,
  operation = 'expensive_operation',
  reason = 'This step may materially increase cost.',
  confirmFn = null,
} = {}) {
  if (isTrustedUser(user)) return true;
  if (typeof confirmFn !== 'function') throw new ExpensiveStepConfirmationRequiredError(operation);
  const approved = await confirmFn({
    operation,
    reason,
    requiresCaptcha: process.env.SELINA_REQUIRE_CAPTCHA_FOR_EXPENSIVE_STEPS === 'true',
  });
  if (!approved) throw new ExpensiveStepConfirmationRequiredError(operation);
  return true;
}

export function recordBillingEvent(event = {}) {
  const enriched = redactPromptLikeFields({
    ts: new Date().toISOString(),
    userId: event.userId || event.user_id || 'anonymous',
    sessionId: event.sessionId || event.session_id || null,
    ...event,
  });
  billingEvents.push(enriched);
  if (billingEvents.length > BILLING_EVENT_LIMIT) {
    billingEvents.splice(0, billingEvents.length - BILLING_EVENT_LIMIT);
  }

  logger.info('CostMonitor', 'Billing event', enriched);
  maybePostBillingEvent(enriched);
  maybeAutoSuspend(enriched);
  return enriched;
}

export function getBillingEvents() {
  return billingEvents.slice();
}

export function resetCostControls() {
  llmCallLogByUser.clear();
  sessionTokenUsage.clear();
  billingEvents.splice(0, billingEvents.length);
  suspendedUsers.clear();
}

function tokenUsageKey(sessionId, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return `${sessionId}:${day}`;
}

function getDailyTokenLimit() {
  const limit = Number.parseInt(process.env.SELINA_DAILY_SESSION_TOKEN_LIMIT || '100000', 10);
  return Number.isFinite(limit) && limit > 0
    ? limit
    : 100_000;
}

function getLlmCallsPerMinute() {
  const limit = Number.parseInt(process.env.SELINA_LLM_CALLS_PER_MINUTE || '30', 10);
  return Number.isFinite(limit) && limit > 0 ? limit : 30;
}

function smallModelForProvider(provider, fallbackModel) {
  return {
    freellmapi: process.env.FREELLMAPI_SMALL_MODEL || process.env.FREELLMAPI_MODEL || 'auto',
    gemini: process.env.GEMINI_SMALL_MODEL || 'gemini-1.5-flash',
    openai: process.env.OPENAI_SMALL_MODEL || 'gpt-4o-mini',
    qwen: process.env.QWEN_SMALL_MODEL || 'qwen/qwen2.5-coder-7b-instruct',
    deepseek: process.env.DEEPSEEK_SMALL_MODEL || 'deepseek-coder',
    nim: process.env.NIM_SMALL_MODEL || 'meta/llama-3.1-8b-instruct',
    anthropic: process.env.ANTHROPIC_SMALL_MODEL || 'claude-3-5-haiku-latest',
  }[provider] || fallbackModel;
}

function isTrustedUser(user) {
  const roles = new Set((user?.roles || []).map(item => String(item).toLowerCase()));
  const permissions = new Set((user?.permissions || []).map(item => String(item).toLowerCase()));
  return roles.has('admin')
    || roles.has('trusted')
    || permissions.has('expensive:execute')
    || permissions.has('billing:unlimited');
}

function maybePostBillingEvent(event) {
  const endpoint = process.env.SELINA_COST_MONITOR_ENDPOINT;
  if (!endpoint) return;
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(error => {
    logger.warn('CostMonitor', `Failed to stream billing event: ${error.message}`);
  });
}

function maybeAutoSuspend(event) {
  const maxEvents = Number.parseInt(process.env.SELINA_COST_AUTO_SUSPEND_EVENTS || '0', 10);
  if (!maxEvents || maxEvents < 1) return;
  const userId = String(event.userId || 'anonymous');
  const recent = billingEvents.filter(item => String(item.userId) === userId);
  if (recent.length >= maxEvents && !suspendedUsers.has(userId)) {
    suspendedUsers.set(userId, {
      reason: 'cost_monitor_event_threshold',
      eventCount: recent.length,
      suspendedAt: new Date().toISOString(),
    });
  }
}
