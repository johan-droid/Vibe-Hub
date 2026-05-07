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

metricsRegistry.registerMetric(httpDuration);
metricsRegistry.registerMetric(stateTransitions);
metricsRegistry.registerMetric(sandboxDuration);
metricsRegistry.registerMetric(vfsOperations);
metricsRegistry.registerMetric(vfsEntries);
metricsRegistry.registerMetric(llmDuration);
metricsRegistry.registerMetric(llmCost);
metricsRegistry.registerMetric(activeSockets);
metricsRegistry.registerMetric(agentToolCalls);
metricsRegistry.registerMetric(approvalDecisions);
metricsRegistry.registerMetric(mcpToolCalls);

export function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path || 'unknown',
      status: String(res.statusCode),
    });
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

export async function renderMetrics() {
  return metricsRegistry.metrics();
}
