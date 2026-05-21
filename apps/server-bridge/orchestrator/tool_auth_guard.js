export class ToolAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolAuthError';
  }
}

const TOOL_POLICIES = new Map(Object.entries({
  ask_clarification: { type: 'none' },
  create_plan: { type: 'none' },
  list_files: { type: 'readonly', permission: 'tool:read' },
  read_file: { type: 'readonly', permission: 'tool:read' },
  grep_search: { type: 'readonly', permission: 'tool:read' },
  search_symbols: { type: 'readonly', permission: 'tool:read' },
  check_diagnostics: { type: 'readonly', permission: 'tool:read' },
  command_status: { type: 'readonly', permission: 'tool:execute' },
  analyze_ast: { type: 'readonly', permission: 'tool:read' },
  get_preview_dom: { type: 'readonly', permission: 'tool:browser' },
  github_fetch_upstream: { type: 'readonly', permission: 'tool:github' },
  github_detect_conflicts: { type: 'readonly', permission: 'tool:github' },
  github_get_codeql_alerts: { type: 'readonly', permission: 'tool:github' },
  design_research: { type: 'readonly', permission: 'tool:read' },
  helper_git_status_summary: { type: 'readonly', permission: 'tool:read' },
  helper_validate_json: { type: 'readonly', permission: 'tool:read' },
  helper_scan_secret_strings: { type: 'readonly', permission: 'tool:read' },
  helper_check_gitignore: { type: 'readonly', permission: 'tool:read' },
  helper_run_pytest: { type: 'write', permission: 'tool:execute', requireApproval: true },
  helper_run_ruff: { type: 'write', permission: 'tool:execute', requireApproval: true },
  helper_run_semgrep: { type: 'write', permission: 'tool:execute', requireApproval: true },

  create_file: { type: 'write', permission: 'tool:write', requireApproval: true },
  edit_file: { type: 'write', permission: 'tool:write', requireApproval: true },
  patch_file: { type: 'write', permission: 'tool:write', requireApproval: true },
  replace_file_content: { type: 'write', permission: 'tool:write', requireApproval: true },
  multi_replace_file_content: { type: 'write', permission: 'tool:write', requireApproval: true },
  update_memory: { type: 'write', permission: 'tool:memory', requireApproval: false },
  run_command: { type: 'write', permission: 'tool:execute', requireApproval: true },
  send_command_input: { type: 'write', permission: 'tool:execute', requireApproval: true },
  git_clone: { type: 'write', permission: 'tool:write', requireApproval: true },
  github_create_branch: { type: 'write', permission: 'tool:github', requireApproval: true },
  github_post_comment: { type: 'write', permission: 'tool:github', requireApproval: true },
  github_create_pr: { type: 'write', permission: 'tool:github', requireApproval: true },
  github_create_check_run: { type: 'write', permission: 'tool:github', requireApproval: true },
  github_create_codespace: { type: 'write', permission: 'tool:github', requireApproval: true },
  github_trigger_workflow: { type: 'write', permission: 'tool:github', requireApproval: true },
  security_sandbox: { type: 'write', permission: 'tool:execute', requireApproval: true },
  delegate_task: { type: 'write', permission: 'tool:write', requireApproval: true },
  browser_goto: { type: 'write', permission: 'tool:browser', requireApproval: true },
  browser_click: { type: 'write', permission: 'tool:browser', requireApproval: true },
  browser_type: { type: 'write', permission: 'tool:browser', requireApproval: true },
  browser_screenshot: { type: 'write', permission: 'tool:browser', requireApproval: true },
  generate_image: { type: 'write', permission: 'tool:write', requireApproval: true },
  generate_ui_variant: { type: 'write', permission: 'tool:write', requireApproval: true },
}));

function stableParams(params) {
  try {
    return JSON.stringify(params || {});
  } catch {
    return String(params || '');
  }
}

export function getToolAuthPolicy(toolName) {
  return TOOL_POLICIES.get(toolName) || { type: 'write', permission: 'tool:write', requireApproval: true };
}

export function buildToolAuthSnapshot(user, extra = {}) {
  if (!user?.id) return null;
  return {
    type: user.provider === 'external-jwt' ? 'external-jwt' : 'user-session',
    userId: user.id,
    expiresAt: extra.expiresAt || null,
    tenantId: user.tenantId || extra.tenantId || null,
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    scopes: Array.isArray(user.scopes) ? user.scopes : [],
    ...extra,
  };
}

function getMcpRisk(toolDefinition = {}) {
  return String(
    toolDefinition.risk ||
    toolDefinition.metadata?.risk ||
    toolDefinition.annotations?.risk ||
    toolDefinition.annotations?.destructiveHint && 'write' ||
    ''
  ).toLowerCase();
}

function getEffectivePolicy(toolName, toolDefinition = null) {
  const declared = getToolAuthPolicy(toolName);
  if (TOOL_POLICIES.has(toolName)) return declared;

  if (toolName.includes('__') || toolDefinition?.serverName) {
    const risk = getMcpRisk(toolDefinition);
    const permission = inferMcpPermission(toolName, toolDefinition, risk);
    if (['none', 'safe'].includes(risk)) return { type: 'none' };
    if (['read', 'readonly', 'low'].includes(risk)) return { type: 'readonly', permission };
    return { type: 'write', permission, requireApproval: true, risk: risk || 'unknown_mcp' };
  }

  return declared;
}

function inferMcpPermission(toolName, toolDefinition = {}, risk = '') {
  const combined = [
    toolName,
    toolDefinition.serverName,
    toolDefinition.name,
    toolDefinition.description,
    risk,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b(sql|postgres|mysql|sqlite|database|db)\b/.test(combined)) return 'tool:sql';
  if (/\b(github|gitlab|repo|pull request)\b/.test(combined)) return 'tool:github';
  if (/\b(browser|page|dom|screenshot)\b/.test(combined)) return 'tool:browser';
  return 'tool:mcp';
}

function normalizePermissions(authSnapshot = {}) {
  return new Set([
    ...(Array.isArray(authSnapshot.permissions) ? authSnapshot.permissions : []),
    ...(Array.isArray(authSnapshot.scopes) ? authSnapshot.scopes : []),
  ].map(String));
}

function normalizeRoles(authSnapshot = {}) {
  return new Set((Array.isArray(authSnapshot.roles) ? authSnapshot.roles : []).map(String));
}

function hasPermission(authSnapshot, permission) {
  if (!permission) return true;
  const roles = normalizeRoles(authSnapshot);
  if (roles.has('admin') || roles.has('owner')) return true;

  const permissions = normalizePermissions(authSnapshot);
  const [domain] = permission.split(':');
  return (
    permissions.has('*') ||
    permissions.has(permission) ||
    permissions.has(`${domain}:*`)
  );
}

function assertPermission(toolName, policy, authSnapshot) {
  if (!hasPermission(authSnapshot, policy.permission)) {
    throw new ToolAuthError(`missing permission ${policy.permission || 'unknown'} for tool: ${toolName}`);
  }
}

function assertTenantScope(params, authSnapshot) {
  const requestedTenantId = params?.tenantId || params?.tenant_id;
  if (!requestedTenantId || !authSnapshot?.tenantId) return;
  if (String(requestedTenantId) === String(authSnapshot.tenantId)) return;
  if (hasPermission(authSnapshot, 'tenant:*')) return;
  throw new ToolAuthError('tool tenant scope does not match authenticated tenant');
}

export async function authorizeToolCall(toolName, params, context = {}) {
  const policy = getEffectivePolicy(toolName, context.toolDefinition);

  if (policy.type === 'none') return { policy, approved: true };

  if (!context.authSnapshot) {
    throw new ToolAuthError(`authentication required for tool: ${toolName}`);
  }

  assertPermission(toolName, policy, context.authSnapshot);
  assertTenantScope(params, context.authSnapshot);

  if (policy.type === 'readonly') return { policy, approved: true };

  if (policy.type === 'write' && policy.requireApproval) {
    const approved = await context.approvalFn?.(
      `Allow ${toolName}(${stableParams(params).slice(0, 240)})`,
      {
        toolName,
        params: stableParams(params),
        paramsHash: context.paramsHash,
        risk: policy.risk || context.toolDefinition?.risk || context.toolDefinition?.metadata?.risk || 'write',
        source: context.toolDefinition?.serverName ? 'mcp' : 'builtin',
      }
    );
    if (!approved) {
      throw new ToolAuthError(`user denied write operation: ${toolName}`);
    }
    return { policy, approved: true };
  }

  return { policy, approved: true };
}

export function listToolAuthPolicies() {
  return Object.fromEntries(TOOL_POLICIES.entries());
}
