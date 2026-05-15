export class ToolAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolAuthError';
  }
}

const TOOL_POLICIES = new Map(Object.entries({
  ask_clarification: { type: 'none' },
  create_plan: { type: 'none' },
  list_files: { type: 'readonly' },
  read_file: { type: 'readonly' },
  grep_search: { type: 'readonly' },
  search_symbols: { type: 'readonly' },
  check_diagnostics: { type: 'readonly' },
  command_status: { type: 'readonly' },
  analyze_ast: { type: 'readonly' },
  get_preview_dom: { type: 'readonly' },
  github_fetch_upstream: { type: 'readonly' },
  github_detect_conflicts: { type: 'readonly' },
  github_get_codeql_alerts: { type: 'readonly' },
  design_research: { type: 'readonly' },

  create_file: { type: 'write', requireApproval: true },
  edit_file: { type: 'write', requireApproval: true },
  patch_file: { type: 'write', requireApproval: true },
  replace_file_content: { type: 'write', requireApproval: true },
  multi_replace_file_content: { type: 'write', requireApproval: true },
  update_memory: { type: 'write', requireApproval: false },
  run_command: { type: 'write', requireApproval: true },
  send_command_input: { type: 'write', requireApproval: true },
  git_clone: { type: 'write', requireApproval: true },
  github_create_branch: { type: 'write', requireApproval: true },
  github_post_comment: { type: 'write', requireApproval: true },
  github_create_pr: { type: 'write', requireApproval: true },
  github_create_check_run: { type: 'write', requireApproval: true },
  github_create_codespace: { type: 'write', requireApproval: true },
  github_trigger_workflow: { type: 'write', requireApproval: true },
  security_sandbox: { type: 'write', requireApproval: true },
  delegate_task: { type: 'write', requireApproval: true },
  browser_goto: { type: 'write', requireApproval: true },
  browser_click: { type: 'write', requireApproval: true },
  browser_type: { type: 'write', requireApproval: true },
  browser_screenshot: { type: 'write', requireApproval: true },
  generate_image: { type: 'write', requireApproval: true },
  generate_ui_variant: { type: 'write', requireApproval: true },
}));

function stableParams(params) {
  try {
    return JSON.stringify(params || {});
  } catch {
    return String(params || '');
  }
}

export function getToolAuthPolicy(toolName) {
  return TOOL_POLICIES.get(toolName) || { type: 'write', requireApproval: true };
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
    if (['none', 'safe'].includes(risk)) return { type: 'none' };
    if (['read', 'readonly', 'low'].includes(risk)) return { type: 'readonly' };
    return { type: 'write', requireApproval: true, risk: risk || 'unknown_mcp' };
  }

  return declared;
}

export async function authorizeToolCall(toolName, params, context = {}) {
  const policy = getEffectivePolicy(toolName, context.toolDefinition);

  if (policy.type === 'none') return { policy, approved: true };

  if (!context.authSnapshot) {
    throw new ToolAuthError(`authentication required for tool: ${toolName}`);
  }

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
