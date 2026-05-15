import crypto from 'crypto';
import {
  getAgentRun,
  getAgentRunEvents,
  recordAgentRunEvent,
  updateAgentRunStatus,
  upsertAgentRun,
} from '../db.js';

async function bestEffort(operation) {
  try {
    return await operation();
  } catch {
    return null;
  }
}

export function persistRun(runIdentity, {
  userId,
  projectName,
  prompt,
  status = 'running',
  metadata = {},
} = {}) {
  if (!runIdentity?.runId) return null;
  return bestEffort(() => upsertAgentRun({
    id: runIdentity.runId,
    rootRunId: runIdentity.rootRunId || runIdentity.runId,
    parentRunId: runIdentity.parentRunId || null,
    depth: runIdentity.depth || 0,
    sequence: runIdentity.sequence || 0,
    userId,
    projectName,
    expert: runIdentity.expert,
    provider: runIdentity.provider,
    model: runIdentity.model,
    status,
    prompt,
    metadata,
  }));
}

export function persistRunStatus(runIdentity, status, metadata = {}) {
  if (!runIdentity?.runId) return null;
  return bestEffort(() => updateAgentRunStatus(runIdentity.runId, status, metadata));
}

export function persistRunEvent(envelope, runIdentity) {
  if (!envelope?.id || !runIdentity?.runId) return null;
  return bestEffort(() => recordAgentRunEvent({
    id: `${String(envelope.id)}:${String(envelope.params?.status || envelope.params?.state || envelope.method)}:${crypto.randomUUID()}`,
    runId: runIdentity.runId,
    rootRunId: runIdentity.rootRunId || runIdentity.runId,
    parentRunId: runIdentity.parentRunId || null,
    sequence: runIdentity.sequence || 0,
    method: envelope.method,
    eventType: envelope.params?.type || null,
    status: envelope.params?.status || envelope.params?.state || null,
    payload: envelope,
  }));
}

export async function fetchRunForUser(runId, userId) {
  return getAgentRun(runId, userId);
}

export async function fetchRunEventsForUser(runId, userId) {
  return getAgentRunEvents(runId, userId);
}
