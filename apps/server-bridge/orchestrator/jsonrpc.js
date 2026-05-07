import { v4 as uuid } from 'uuid';

const METHOD_BY_LEGACY_TYPE = {
  tool_call: 'agent.tool_call',
  terminal_output: 'agent.terminal_output',
  state_change: 'agent.state_change',
  status: 'agent.state_change',
  plan_request: 'agent.plan_request',
  clarification_request: 'agent.clarification_request',
  result: 'agent.result',
  error: 'agent.error',
  thinking: 'agent.state_change',
  thought: 'agent.thought',
};

export function methodForLegacyType(type) {
  return METHOD_BY_LEGACY_TYPE[type] || `agent.${String(type || 'event')}`;
}

export function createJsonRpcEvent({
  id = uuid(),
  method,
  params = {},
  runIdentity = {},
} = {}) {
  const timestamp = new Date().toISOString();

  return {
    jsonrpc: '2.0',
    id,
    method: method || methodForLegacyType(params?.type),
    params: {
      ...params,
      run: runIdentity,
    },
    timestamp,
    runId: runIdentity.runId || params.runId || null,
    parentRunId: runIdentity.parentRunId || params.parentRunId || null,
  };
}

export function attachJsonRpcEnvelope(payload = {}, runIdentity = {}) {
  const method = payload.method || methodForLegacyType(payload.type);
  const envelope = createJsonRpcEvent({
    id: payload.id || payload.callId || payload.planId || payload.clarificationId,
    method,
    params: payload,
    runIdentity,
  });

  return {
    ...payload,
    jsonrpc: envelope.jsonrpc,
    method: envelope.method,
    params: envelope.params,
    timestamp: payload.timestamp || envelope.timestamp,
    runId: envelope.runId,
    parentRunId: envelope.parentRunId,
    rootRunId: runIdentity.rootRunId || null,
    run: runIdentity,
    jsonrpcEvent: envelope,
  };
}

export function validateJsonRpcEnvelope(event = {}) {
  return Boolean(
    event.jsonrpc === '2.0' &&
    event.id &&
    typeof event.method === 'string' &&
    event.params &&
    event.timestamp
  );
}
