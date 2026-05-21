import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { context as otelContext, SpanStatusCode, trace } from '@opentelemetry/api';

const traceStorage = new AsyncLocalStorage();
const tracer = trace.getTracer('server-bridge');

export function createRequestTraceContext(req, requestId) {
  const parsed = parseTraceParent(req.get?.('traceparent') || req.headers?.traceparent);
  return {
    traceId: parsed?.traceId || generateTraceId(),
    parentSpanId: parsed?.spanId || null,
    spanId: generateSpanId(),
    traceFlags: parsed?.traceFlags || '01',
    requestId,
    userId: null,
    agentRunId: null,
    step: 'http_request',
  };
}

export function runWithTraceContext(traceContext, fn) {
  return traceStorage.run({
    ...traceContext,
    traceId: traceContext?.traceId || generateTraceId(),
    spanId: traceContext?.spanId || generateSpanId(),
    traceFlags: traceContext?.traceFlags || '01',
  }, fn);
}

export function getTraceContext() {
  return traceStorage.getStore() || null;
}

export function getTraceLogFields(extra = {}) {
  const active = getTraceContext();
  const activeSpan = trace.getSpan(otelContext.active());
  const spanContext = activeSpan?.spanContext?.();

  return compactObject({
    traceId: active?.traceId || spanContext?.traceId,
    spanId: active?.spanId || spanContext?.spanId,
    parentSpanId: active?.parentSpanId,
    requestId: active?.requestId,
    userId: extra.userId || active?.userId,
    agentRunId: extra.agentRunId || active?.agentRunId,
    step: extra.step || active?.step,
  });
}

export function setTraceUser(userId) {
  const active = getTraceContext();
  if (active && userId) active.userId = String(userId);
}

export function setTraceAgentRun(agentRunId) {
  const active = getTraceContext();
  if (active && agentRunId) active.agentRunId = String(agentRunId);
}

export function setTraceStep(step) {
  const active = getTraceContext();
  if (active && step) active.step = String(step);
}

export async function withSpan(name, attributes = {}, operation) {
  const active = getTraceLogFields();
  return tracer.startActiveSpan(name, {
    attributes: compactObject({
      ...active,
      ...attributes,
    }),
  }, async (span) => {
    try {
      return await operation(span);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function traceParentHeader(traceContext = getTraceContext()) {
  if (!traceContext?.traceId || !traceContext?.spanId) return null;
  return `00-${traceContext.traceId}-${traceContext.spanId}-${traceContext.traceFlags || '01'}`;
}

function parseTraceParent(value) {
  const match = String(value || '').match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/iu);
  if (!match) return null;
  return {
    traceId: match[1].toLowerCase(),
    spanId: match[2].toLowerCase(),
    traceFlags: match[3].toLowerCase(),
  };
}

function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null && item !== ''),
  );
}
