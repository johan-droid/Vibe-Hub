import { CommandGuardError, validateCommandInvocation } from './command-guard.js';

export class ToolExecutionPolicyError extends Error {
  constructor(message, code = 'TOOL_EXECUTION_POLICY_DENIED', status = 400) {
    super(message);
    this.name = 'ToolExecutionPolicyError';
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_TOOL_TIMEOUT_MS = Number.parseInt(process.env.SELINA_TOOL_CALL_TIMEOUT_MS || '10000', 10);
const MAX_TOOL_TIMEOUT_MS = Number.parseInt(process.env.SELINA_TOOL_CALL_MAX_TIMEOUT_MS || '10000', 10);
const DEFAULT_PAYLOAD_LIMIT_BYTES = Number.parseInt(process.env.SELINA_TOOL_PAYLOAD_LIMIT_BYTES || '4096', 10);
const SHELL_PAYLOAD_LIMIT_BYTES = Number.parseInt(process.env.SELINA_TOOL_SHELL_PAYLOAD_LIMIT_BYTES || '1024', 10);
const CODE_PAYLOAD_LIMIT_BYTES = Number.parseInt(process.env.SELINA_TOOL_CODE_PAYLOAD_LIMIT_BYTES || '4096', 10);
const CIRCUIT_WINDOW = Number.parseInt(process.env.SELINA_TOOL_CIRCUIT_WINDOW || '25', 10);
const CIRCUIT_MIN_SAMPLES = Number.parseInt(process.env.SELINA_TOOL_CIRCUIT_MIN_SAMPLES || '5', 10);
const CIRCUIT_ERROR_THRESHOLD = Number.parseFloat(process.env.SELINA_TOOL_CIRCUIT_ERROR_THRESHOLD || '0.2');

const DEFAULT_ALLOWED_COMMANDS = [
  'node',
  'npm',
  'python',
  'python3',
  'bun',
  'sh',
  'bash',
];

const circuitState = new Map();

export function validateToolInvocationPolicy(toolName, rawArgs = {}, context = {}) {
  const args = normalizeArgs(rawArgs);
  assertCircuitOpen(toolName);
  assertPayloadSize(toolName, args);
  assertCommandPolicy(toolName, args);
  assertSqlPolicy(toolName, args, context.toolDefinition);
  assertFilesystemPolicy(toolName, args);

  return {
    args: normalizeTimeoutArgs(toolName, args),
    timeoutMs: resolveToolTimeout(args.timeoutMs || args.WaitMsBeforeAsync),
    credentialScope: buildLeastPrivilegeScope(toolName, args, context),
  };
}

export function recordToolExecutionOutcome(toolName, ok) {
  const state = circuitState.get(toolName) || {
    disabled: false,
    disabledAt: null,
    outcomes: [],
  };

  state.outcomes.push(Boolean(ok));
  if (state.outcomes.length > CIRCUIT_WINDOW) {
    state.outcomes.splice(0, state.outcomes.length - CIRCUIT_WINDOW);
  }

  const errorRate = calculateErrorRate(state.outcomes);
  if (state.outcomes.length >= CIRCUIT_MIN_SAMPLES && errorRate > CIRCUIT_ERROR_THRESHOLD) {
    state.disabled = true;
    state.disabledAt = new Date().toISOString();
    state.errorRate = errorRate;
  }

  circuitState.set(toolName, state);
  return getToolCircuitState(toolName);
}

export function getToolCircuitState(toolName) {
  const state = circuitState.get(toolName);
  if (!state) {
    return { disabled: false, samples: 0, errorRate: 0, disabledAt: null };
  }

  return {
    disabled: Boolean(state.disabled),
    samples: state.outcomes.length,
    errorRate: Number(calculateErrorRate(state.outcomes).toFixed(3)),
    disabledAt: state.disabledAt || null,
  };
}

export function resetToolCircuit(toolName = null) {
  if (toolName) {
    circuitState.delete(toolName);
    return;
  }
  circuitState.clear();
}

function normalizeArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  return { ...args };
}

function assertCircuitOpen(toolName) {
  const state = circuitState.get(toolName);
  if (!state?.disabled) return;
  throw new ToolExecutionPolicyError(
    `Tool ${toolName} is disabled pending manual review after exceeding the error-rate threshold.`,
    'TOOL_CIRCUIT_OPEN',
    503,
  );
}

function assertPayloadSize(toolName, args) {
  const limit = payloadLimitForTool(toolName);
  const size = byteLength(args);
  if (size > limit) {
    throw new ToolExecutionPolicyError(
      `Tool payload is ${size} bytes and exceeds the ${limit} byte limit for ${toolName}.`,
      'TOOL_PAYLOAD_TOO_LARGE',
      413,
    );
  }
}

function payloadLimitForTool(toolName) {
  if (toolName === 'run_command' || toolName === 'send_command_input') return SHELL_PAYLOAD_LIMIT_BYTES;
  if (['create_file', 'patch_file', 'replace_file_content', 'multi_replace_file_content'].includes(toolName)) {
    return CODE_PAYLOAD_LIMIT_BYTES;
  }
  return DEFAULT_PAYLOAD_LIMIT_BYTES;
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf-8');
}

function assertCommandPolicy(toolName, args) {
  if (toolName !== 'run_command') return;
  const allowed = allowedCommands();
  let command;
  let safeArgs;
  try {
    ({ command, args: safeArgs } = validateCommandInvocation({
      command: args.command,
      args: Array.isArray(args.args) ? args.args : [],
    }));
  } catch (error) {
    if (error instanceof CommandGuardError) {
      throw new ToolExecutionPolicyError(error.message, error.code, 403);
    }
    throw error;
  }
  const commandName = command.split(/[\\/]/).pop().replace(/\.(cmd|exe|bat|ps1)$/i, '').toLowerCase();
  if (!allowed.has(commandName)) {
    throw new ToolExecutionPolicyError(
      `Command ${commandName} is not in the curated allowlist.`,
      'COMMAND_NOT_ALLOWED',
      403,
    );
  }

  const fullCommand = [commandName, ...safeArgs].join(' ');
  if (/(?:rm\s+-rf|curl\s+.*?\||wget\s+.*?\||base64\s+-d|nc\s+-e|>.*?\/dev\/null)/i.test(fullCommand)) {
    throw new ToolExecutionPolicyError(
      `Command contains a high-risk sequence and has been blocked by anomaly detection.`,
      'COMMAND_RISKY_SEQUENCE',
      403
    );
  }

  args.command = commandName;
  args.args = safeArgs;
}

function allowedCommands() {
  const configured = String(process.env.SELINA_ALLOWED_COMMANDS || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_COMMANDS);
}

function assertSqlPolicy(toolName, args, toolDefinition = {}) {
  if (!isSqlLikeTool(toolName, toolDefinition)) return;
  const sql = extractSql(args);
  if (!sql) return;
  if (!/^\s*(?:\/\*[\s\S]*?\*\/\s*)*select\b/i.test(sql)) {
    throw new ToolExecutionPolicyError(
      'SQL tool policy only permits SELECT statements.',
      'SQL_ONLY_SELECT_ALLOWED',
      403,
    );
  }
  if (/;\s*\S/.test(sql.trim())) {
    throw new ToolExecutionPolicyError(
      'SQL tool policy permits exactly one SELECT statement.',
      'SQL_MULTISTATEMENT_REJECTED',
      403,
    );
  }
}

function assertFilesystemPolicy(toolName, args) {
  if (!isFilesystemTool(toolName)) return;
  const target = args.path || args.file_path || args.file || args.file_pattern || '.';
  if (typeof target !== 'string') return;
  const normalized = target.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized) || normalized.split('/').includes('..')) {
    throw new ToolExecutionPolicyError(
      'Filesystem tools must stay inside the configured workspace prefix.',
      'FILESYSTEM_PREFIX_VIOLATION',
      403,
    );
  }

  const prefix = String(process.env.SELINA_TOOL_FILE_PREFIX || '.').replace(/\\/g, '/').replace(/\/+$/, '');
  if (prefix && prefix !== '.' && !(normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    throw new ToolExecutionPolicyError(
      `Filesystem access is restricted to prefix ${prefix}.`,
      'FILESYSTEM_PREFIX_VIOLATION',
      403,
    );
  }
}

function isFilesystemTool(toolName) {
  return [
    'read_file',
    'list_files',
    'grep_search',
    'search_symbols',
    'analyze_ast',
    'create_file',
    'patch_file',
    'replace_file_content',
    'multi_replace_file_content',
  ].includes(toolName);
}

function isSqlLikeTool(toolName, toolDefinition = {}) {
  const combined = [
    toolName,
    toolDefinition?.name,
    toolDefinition?.uniqueId,
    toolDefinition?.serverName,
    toolDefinition?.description,
  ].filter(Boolean).join(' ').toLowerCase();
  return /(^|[^a-z0-9])(sql|postgres|mysql|sqlite|database|db)(?=$|[^a-z0-9])/i.test(combined);
}

function extractSql(args) {
  return args.sql || args.query || args.statement || args.text || '';
}

function normalizeTimeoutArgs(toolName, args) {
  if (toolName === 'run_command' || toolName === 'security_sandbox' || toolName.startsWith('helper_run_')) {
    return {
      ...args,
      timeoutMs: resolveToolTimeout(args.timeoutMs || args.WaitMsBeforeAsync),
    };
  }
  return args;
}

function resolveToolTimeout(timeoutMs) {
  const parsed = Number.parseInt(timeoutMs, 10);
  if (!Number.isFinite(parsed)) return Math.min(DEFAULT_TOOL_TIMEOUT_MS, MAX_TOOL_TIMEOUT_MS);
  return Math.min(Math.max(parsed, 1), MAX_TOOL_TIMEOUT_MS);
}

export function buildLeastPrivilegeScope(toolName, args = {}, context = {}) {
  const tenantId = context.tenantId || context.user?.tenantId || args.tenantId || args.tenant_id || null;
  if (isSqlLikeTool(toolName, context.toolDefinition)) {
    return {
      kind: 'database',
      permissions: ['SELECT'],
      tenantId,
      tables: args.table ? [String(args.table)] : ['tenant_scoped_readonly'],
      expiresInSeconds: 60,
    };
  }

  if (toolName.startsWith('github_')) {
    return {
      kind: 'github',
      operation: toolName.replace(/^github_/, ''),
      owner: args.owner || null,
      repo: args.repo || null,
      expiresInSeconds: 300,
    };
  }

  if (['read_file', 'list_files', 'grep_search', 'search_symbols', 'analyze_ast'].includes(toolName)) {
    return {
      kind: 'filesystem',
      access: 'read',
      prefix: args.path || args.file_pattern || '.',
      expiresInSeconds: 60,
    };
  }

  return {
    kind: 'tool',
    operation: toolName,
    tenantId,
    expiresInSeconds: 60,
  };
}

function calculateErrorRate(outcomes = []) {
  if (!outcomes.length) return 0;
  const failures = outcomes.filter(ok => !ok).length;
  return failures / outcomes.length;
}
