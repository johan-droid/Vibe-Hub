import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { resolveActionGrantSecret } from './dev-secrets.js';

const DEFAULT_TTL_MS = 120_000;

function secret() {
  const value = resolveActionGrantSecret();
  if (value) return value;
  throw new Error('CRITICAL SECURITY ERROR: SELINA_ACTION_GRANT_SECRET is missing. This key is mandatory for signing Action Grants and must be isolated from JWT_SECRET to prevent forgery.');
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function encode(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decode(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf-8'));
}

function sign(encodedPayload) {
  return crypto.createHmac('sha256', secret()).update(encodedPayload).digest('base64url');
}

function timingSafeEqualString(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hashToolParams(params = {}) {
  return crypto.createHash('sha256').update(canonicalize(params)).digest('hex');
}

export function createActionGrant({
  userId,
  tenantId = null,
  runId,
  toolName,
  paramsHash,
  decision = 'approve',
  reason = '',
  approvalSource = 'user',
  ttlMs = Number.parseInt(process.env.SELINA_ACTION_GRANT_TTL_MS || `${DEFAULT_TTL_MS}`, 10),
  now = Date.now(),
} = {}) {
  if (!userId || !runId || !toolName || !paramsHash) {
    throw new Error('userId, runId, toolName, and paramsHash are required for action grants');
  }

  const payload = {
    grantId: uuid(),
    userId: String(userId),
    tenantId: tenantId ? String(tenantId) : null,
    runId: String(runId),
    toolName: String(toolName),
    paramsHash: String(paramsHash),
    decision,
    reason,
    approvalSource,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const encoded = encode(payload);
  return {
    ...payload,
    token: `${encoded}.${sign(encoded)}`,
  };
}

export function verifyActionGrant(token, {
  userId,
  tenantId,
  runId,
  toolName,
  paramsHash,
  now = Date.now(),
} = {}) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || !timingSafeEqualString(signature, sign(encoded))) {
    return { ok: false, code: 'INVALID_ACTION_GRANT', error: 'Action grant signature is invalid.' };
  }

  let payload;
  try {
    payload = decode(encoded);
  } catch {
    return { ok: false, code: 'INVALID_ACTION_GRANT', error: 'Action grant payload is invalid.' };
  }

  if (payload.expiresAt < now) {
    return { ok: false, code: 'ACTION_GRANT_EXPIRED', error: 'Action grant has expired.', payload };
  }
  if (payload.decision !== 'approve') {
    return { ok: false, code: 'ACTION_GRANT_DENIED', error: 'Action grant does not approve this action.', payload };
  }

  const mismatches = [];
  if (userId && String(payload.userId) !== String(userId)) mismatches.push('userId');
  if (tenantId && String(payload.tenantId) !== String(tenantId)) mismatches.push('tenantId');
  if (runId && String(payload.runId) !== String(runId)) mismatches.push('runId');
  if (toolName && String(payload.toolName) !== String(toolName)) mismatches.push('toolName');
  if (paramsHash && String(payload.paramsHash) !== String(paramsHash)) mismatches.push('paramsHash');

  if (mismatches.length) {
    return {
      ok: false,
      code: 'ACTION_GRANT_SCOPE_MISMATCH',
      error: `Action grant scope mismatch: ${mismatches.join(', ')}`,
      payload,
    };
  }

  return { ok: true, payload };
}
