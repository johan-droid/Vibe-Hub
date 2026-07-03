import client from 'prom-client';

export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'selina_',
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration by method, route, and status.',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP request rate by method, route, and status.',
  labelNames: ['method', 'route', 'status'],
});

const httpErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'HTTP errors by method, route, and status.',
  labelNames: ['method', 'route', 'status'],
});

const stateTransitions = new client.Counter({
  name: 'state_machine_transition_total',
  help: 'State machine transitions by source, target, and user.',
  labelNames: ['from', 'to', 'user'],
});

const sandboxDuration = new client.Histogram({
  name: 'sandbox_execution_duration_seconds',
  help: 'Sandbox execution duration samples.',
  labelNames: ['result'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

const vfsOperations = new client.Counter({
  name: 'vfs_operations_total',
  help: 'VFS operations by action and status.',
  labelNames: ['action', 'status'],
});

const vfsEntries = new client.Gauge({
  name: 'vfs_entries',
  help: 'Current VFS entries by status.',
  labelNames: ['status'],
});

const llmDuration = new client.Histogram({
  name: 'llm_api_call_duration_seconds',
  help: 'LLM provider request duration.',
  labelNames: ['provider', 'model', 'success'],
  buckets: [0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
});

const llmCost = new client.Counter({
  name: 'llm_cost_usd_total',
  help: 'Estimated LLM cost in USD.',
  labelNames: ['provider', 'model'],
});

const llmTokens = new client.Counter({
  name: 'llm_tokens_total',
  help: 'LLM token usage by provider, model, and direction.',
  labelNames: ['provider', 'model', 'direction'],
});

const llmTokenThroughput = new client.Histogram({
  name: 'llm_token_throughput_tokens_per_second',
  help: 'Observed LLM token throughput by provider and model.',
  labelNames: ['provider', 'model'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

const ragRecallDuration = new client.Histogram({
  name: 'rag_recall_duration_seconds',
  help: 'RAG recall latency by source and cache result.',
  labelNames: ['source', 'cache'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const activeSockets = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Active WebSocket and Socket.io connections.',
});

const agentToolCalls = new client.Counter({
  name: 'agent_tool_calls_total',
  help: 'Agent tool calls by tool, source, and status.',
  labelNames: ['tool', 'source', 'status'],
});

const approvalDecisions = new client.Counter({
  name: 'agent_approval_decisions_total',
  help: 'Agent approval decisions by tool and decision.',
  labelNames: ['tool', 'decision'],
});

const mcpToolCalls = new client.Counter({
  name: 'mcp_tool_calls_total',
  help: 'MCP tool calls by server, tool, and status.',
  labelNames: ['server', 'tool', 'status'],
});

const agentRecovery = new client.Counter({
  name: 'agent_recovery_total',
  help: 'Agent successful recoveries using SolutionsLedger lessons.',
  labelNames: ['taskId'],
});

const orchestrationQueueDepth = new client.Gauge({
  name: 'orchestration_queue_depth',
  help: 'Current orchestration queue depth by lane and state rollup.',
  labelNames: ['lane', 'metric'],
});

const orchestrationQueueJobs = new client.Counter({
  name: 'orchestration_queue_jobs_total',
  help: 'Orchestration queue lifecycle events by lane and status.',
  labelNames: ['lane', 'status'],
});

const orchestrationQueueConsumers = new client.Gauge({
  name: 'orchestration_queue_consumers',
  help: 'Active orchestration workers by lane.',
  labelNames: ['lane', 'metric'],
});

const orchestrationQueueBackpressure = new client.Counter({
  name: 'orchestration_queue_backpressure_total',
  help: 'Times the orchestration dispatcher applied backpressure by lane.',
  labelNames: ['lane'],
});

const orchestrationStepDuration = new client.Histogram({
  name: 'orchestration_step_duration_seconds',
  help: 'Agent orchestration step duration by step and result.',
  labelNames: ['step', 'result'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
});

const orchestrationStepSloEvents = new client.Counter({
  name: 'orchestration_step_slo_events_total',
  help: 'SLO budget events for orchestration steps.',
  labelNames: ['step', 'result', 'slo'],
});

metricsRegistry.registerMetric(httpDuration);
metricsRegistry.registerMetric(httpRequests);
metricsRegistry.registerMetric(httpErrors);
metricsRegistry.registerMetric(stateTransitions);
metricsRegistry.registerMetric(sandboxDuration);
metricsRegistry.registerMetric(vfsOperations);
metricsRegistry.registerMetric(vfsEntries);
metricsRegistry.registerMetric(llmDuration);
metricsRegistry.registerMetric(llmCost);
metricsRegistry.registerMetric(llmTokens);
metricsRegistry.registerMetric(llmTokenThroughput);
metricsRegistry.registerMetric(ragRecallDuration);
metricsRegistry.registerMetric(activeSockets);
metricsRegistry.registerMetric(agentToolCalls);
metricsRegistry.registerMetric(approvalDecisions);
metricsRegistry.registerMetric(mcpToolCalls);
metricsRegistry.registerMetric(agentRecovery);
metricsRegistry.registerMetric(orchestrationQueueDepth);
metricsRegistry.registerMetric(orchestrationQueueJobs);
metricsRegistry.registerMetric(orchestrationQueueConsumers);
metricsRegistry.registerMetric(orchestrationQueueBackpressure);
metricsRegistry.registerMetric(orchestrationStepDuration);
metricsRegistry.registerMetric(orchestrationStepSloEvents);

export function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path || 'unknown',
      status: String(res.statusCode),
    };
    end(labels);
    httpRequests.inc(labels);
    if (res.statusCode >= 500) {
      httpErrors.inc(labels);
    }
  });
  next();
}

export function recordStateTransitionMetric(from, to, userId = 'anonymous') {
  stateTransitions.inc({ from: String(from), to: String(to), user: String(userId || 'anonymous') });
}

export function recordSandboxDuration(seconds, labels = {}) {
  sandboxDuration.observe({ result: String(labels.result || 'unknown') }, seconds);
}

export function recordVfsOperationMetric(action, status = 'unknown') {
  vfsOperations.inc({ action: String(action), status: String(status || 'unknown') });
}

export function setVfsStats(stats) {
  for (const [status, value] of Object.entries({
    total: stats.total,
    pending: stats.pending,
    approved: stats.approved,
    rejected: stats.rejected,
    committed: stats.committed,
  })) {
    vfsEntries.set({ status }, value);
  }
}

export function recordLlmDuration(seconds, labels = {}) {
  llmDuration.observe({
    provider: String(labels.provider || 'unknown'),
    model: String(labels.model || 'unknown'),
    success: String(Boolean(labels.success)),
  }, seconds);
}

export function recordLlmCost(costUsd, labels = {}) {
  if (costUsd > 0) {
    llmCost.inc({
      provider: String(labels.provider || 'unknown'),
      model: String(labels.model || 'unknown'),
    }, costUsd);
  }
}

export function recordLlmTokenUsage({ provider = 'unknown', model = 'unknown', inputTokens = 0, outputTokens = 0, totalTokens = null, durationSeconds = null } = {}) {
  const normalized = { provider: String(provider), model: String(model) };
  const input = Number(inputTokens || 0);
  const output = Number(outputTokens || 0);
  const total = Number(totalTokens ?? input + output);

  if (input > 0) llmTokens.inc({ ...normalized, direction: 'input' }, input);
  if (output > 0) llmTokens.inc({ ...normalized, direction: 'output' }, output);
  if (total > 0) llmTokens.inc({ ...normalized, direction: 'total' }, total);

  if (total > 0 && durationSeconds > 0) {
    llmTokenThroughput.observe(normalized, total / durationSeconds);
  }
}

export function recordRagRecallDuration(seconds, labels = {}) {
  ragRecallDuration.observe({
    source: String(labels.source || 'unknown'),
    cache: String(labels.cache || 'unknown'),
  }, seconds);
}

export function setActiveWebsocketConnections(count) {
  activeSockets.set(count);
}

export function recordAgentToolCallMetric(tool, source, status) {
  agentToolCalls.inc({
    tool: String(tool || 'unknown'),
    source: String(source || 'unknown'),
    status: String(status || 'unknown'),
  });
}

export function recordApprovalDecisionMetric(tool, decision) {
  approvalDecisions.inc({
    tool: String(tool || 'unknown'),
    decision: String(decision || 'unknown'),
  });
}

export function recordMcpToolCallMetric(server, tool, status) {
  mcpToolCalls.inc({
    server: String(server || 'unknown'),
    tool: String(tool || 'unknown'),
    status: String(status || 'unknown'),
  });
}

export function recordAgentRecoveryMetric(taskId) {
  agentRecovery.inc({ taskId: String(taskId || 'unknown') });
}

export function setQueueDepthMetric(lane, waitingDepth = 0, active = 0, failed = 0) {
  orchestrationQueueDepth.set({ lane: String(lane || 'unknown'), metric: 'waiting' }, waitingDepth);
  orchestrationQueueDepth.set({ lane: String(lane || 'unknown'), metric: 'active' }, active);
  orchestrationQueueDepth.set({ lane: String(lane || 'unknown'), metric: 'failed' }, failed);
}

export function recordQueueJobMetric(lane, status) {
  orchestrationQueueJobs.inc({
    lane: String(lane || 'unknown'),
    status: String(status || 'unknown'),
  });
}

export function setQueueConsumerMetric(lane, activeConsumers = 0, concurrencyLimit = 0) {
  orchestrationQueueConsumers.set({ lane: String(lane || 'unknown'), metric: 'active' }, activeConsumers);
  orchestrationQueueConsumers.set({ lane: String(lane || 'unknown'), metric: 'limit' }, concurrencyLimit);
}

export function recordQueueBackpressureMetric(lane) {
  orchestrationQueueBackpressure.inc({
    lane: String(lane || 'unknown'),
  });
}

export function recordOrchestrationStepDuration(seconds, labels = {}) {
  const slo = labels.slo || process.env.ORCHESTRATION_STEP_SLO_NAME || 'step_lt_2s';
  const targetSeconds = Number.parseFloat(process.env.ORCHESTRATION_STEP_SLO_TARGET_SECONDS || '2');
  const result = labels.result || (seconds <= targetSeconds ? 'satisfied' : 'violated');
  const step = String(labels.step || 'unknown');

  orchestrationStepDuration.observe({
    step,
    result: String(result),
  }, seconds);
  orchestrationStepSloEvents.inc({
    step,
    result: String(result),
    slo: String(slo),
  });
}

export async function renderMetrics() {
  return metricsRegistry.metrics();
}
