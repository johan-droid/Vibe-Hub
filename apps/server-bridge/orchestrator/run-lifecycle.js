export const RUN_STATES = Object.freeze({
  QUEUED: 'queued',
  AUTHORIZING: 'authorizing',
  PLANNING: 'planning',
  RUNNING: 'running',
  WAITING_FOR_USER: 'waiting_for_user',
  APPLYING_CHANGES: 'applying_changes',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const TERMINAL_RUN_STATES = new Set([
  RUN_STATES.COMPLETED,
  RUN_STATES.FAILED,
  RUN_STATES.CANCELLED,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [RUN_STATES.QUEUED]: [RUN_STATES.AUTHORIZING, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.AUTHORIZING]: [RUN_STATES.PLANNING, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.PLANNING]: [RUN_STATES.RUNNING, RUN_STATES.WAITING_FOR_USER, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.WAITING_FOR_USER]: [RUN_STATES.RUNNING, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.RUNNING]: [RUN_STATES.APPLYING_CHANGES, RUN_STATES.WAITING_FOR_USER, RUN_STATES.COMPLETED, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.APPLYING_CHANGES]: [RUN_STATES.COMPLETED, RUN_STATES.CANCELLED, RUN_STATES.FAILED],
  [RUN_STATES.COMPLETED]: [],
  [RUN_STATES.FAILED]: [],
  [RUN_STATES.CANCELLED]: [],
});

export class RunLifecycleError extends Error {
  constructor(message, code = 'RUN_LIFECYCLE_ERROR') {
    super(message);
    this.name = 'RunLifecycleError';
    this.code = code;
    this.status = 409;
  }
}

export function isTerminalRunState(state) {
  return TERMINAL_RUN_STATES.has(state);
}

export function assertRunTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    throw new RunLifecycleError(`Unknown run state: ${from}`, 'RUN_STATE_UNKNOWN');
  }
  if (!allowed.includes(to)) {
    throw new RunLifecycleError(`Invalid run state transition: ${from} -> ${to}`, 'RUN_STATE_TRANSITION_INVALID');
  }
  return true;
}

export function createRunLifecycle({ runId, userId, initialState = RUN_STATES.QUEUED, now = new Date() } = {}) {
  if (!runId) throw new RunLifecycleError('runId is required', 'RUN_ID_REQUIRED');
  if (!userId) throw new RunLifecycleError('userId is required', 'RUN_USER_REQUIRED');

  return {
    runId,
    userId,
    state: initialState,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    events: [{ state: initialState, at: now.toISOString() }],
  };
}

export function transitionRunLifecycle(lifecycle, nextState, { reason = null, now = new Date(), metadata = {} } = {}) {
  assertRunTransition(lifecycle.state, nextState);
  const at = now.toISOString();
  return {
    ...lifecycle,
    state: nextState,
    updatedAt: at,
    events: [
      ...(lifecycle.events || []),
      {
        state: nextState,
        at,
        ...(reason ? { reason } : {}),
        ...(Object.keys(metadata).length ? { metadata } : {}),
      },
    ],
  };
}
