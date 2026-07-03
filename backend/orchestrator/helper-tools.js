import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';
import { SandboxProviderRouter } from '../sandbox/providers.js';

const execFileAsync = promisify(execFile);
const SECRET_PATTERN = /(sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9_]{20,}|xox[baprs]-[a-zA-Z0-9-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----)/;
const RESTRICTED_FILE_PATTERN = /(^|[\\/])(?:\.git|\.env(?:\.|$)|credentials|id_rsa|id_ed25519|.*(?:secret|token|api[_-]?key).*)/i;

export const HELPER_AGENT_TOOLS = [
  {
    name: 'helper_git_status_summary',
    description: 'Read-only helper inspired by Coding Open Agent Tools. Summarizes git status and diff stats without modifying files.',
    parameters: {
      type: 'OBJECT',
      properties: {
        workspacePath: { type: 'STRING', description: 'Optional repository root. Defaults to current process directory.' },
      },
      required: [],
    },
    metadata: { source: 'helper-tool-pack', risk: 'readonly' },
  },
  {
    name: 'helper_validate_json',
    description: 'Read-only helper inspired by Basic Open Agent Tools. Validates a JSON file and reports parse errors.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Workspace-relative JSON file path.' },
        workspacePath: { type: 'STRING', description: 'Optional repository root. Defaults to current process directory.' },
      },
      required: ['path'],
    },
    metadata: { source: 'helper-tool-pack', risk: 'readonly' },
  },
  {
    name: 'helper_scan_secret_strings',
    description: 'Read-only helper inspired by Coding Open Agent Tools. Scans an explicit non-secret file for credential-like strings.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Workspace-relative file path to scan. Secret-like file names are refused.' },
        workspacePath: { type: 'STRING', description: 'Optional repository root. Defaults to current process directory.' },
      },
      required: ['path'],
    },
    metadata: { source: 'helper-tool-pack', risk: 'readonly' },
  },
  {
    name: 'helper_check_gitignore',
    description: 'Read-only helper inspired by Coding Open Agent Tools. Checks whether common local secret files are ignored.',
    parameters: {
      type: 'OBJECT',
      properties: {
        workspacePath: { type: 'STRING', description: 'Optional repository root. Defaults to current process directory.' },
      },
      required: [],
    },
    metadata: { source: 'helper-tool-pack', risk: 'readonly' },
  },
  {
    name: 'helper_run_pytest',
    description: 'Runs Pytest inside the configured sandbox provider. Use for Python verification; requires approval because it executes code.',
    parameters: verificationToolSchema('Additional pytest args, e.g. ["tests/test_api.py", "-q"].'),
    metadata: { source: 'verification-tool-pack', risk: 'write' },
  },
  {
    name: 'helper_run_ruff',
    description: 'Runs Ruff inside the configured sandbox provider using python -m ruff check. Requires approval because it executes project code tooling.',
    parameters: verificationToolSchema('Additional ruff args, e.g. ["app", "--select", "F"].'),
    metadata: { source: 'verification-tool-pack', risk: 'write' },
  },
  {
    name: 'helper_run_semgrep',
    description: 'Runs Semgrep inside the configured sandbox provider using python -m semgrep. Requires approval because it executes project code tooling.',
    parameters: verificationToolSchema('Additional semgrep args. Defaults to ["--config", "auto", "."].'),
    metadata: { source: 'verification-tool-pack', risk: 'write' },
  },
];

export function isHelperTool(toolName) {
  return HELPER_AGENT_TOOLS.some(tool => tool.name === toolName);
}

export async function executeHelperTool(toolName, args = {}, context = {}) {
  const workspaceRoot = resolveWorkspaceRoot(args.workspacePath || context.workspacePath || process.cwd());

  if (toolName === 'helper_git_status_summary') {
    const [status, diffStat] = await Promise.all([
      git(workspaceRoot, ['status', '--short']),
      git(workspaceRoot, ['diff', '--stat']),
    ]);
    return {
      success: true,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
    };
  }

  if (toolName === 'helper_validate_json') {
    const absolutePath = resolveSafeFile(workspaceRoot, args.path);
    const text = await fs.readFile(absolutePath, 'utf-8');
    try {
      JSON.parse(text);
      return { success: true, path: normalizeRelative(args.path), valid: true };
    } catch (error) {
      return { success: false, path: normalizeRelative(args.path), valid: false, error: error.message };
    }
  }

  if (toolName === 'helper_scan_secret_strings') {
    const absolutePath = resolveSafeFile(workspaceRoot, args.path, { refuseSecretLikePath: true });
    const text = await fs.readFile(absolutePath, 'utf-8');
    return {
      success: true,
      path: normalizeRelative(args.path),
      matches: SECRET_PATTERN.test(text) ? ['credential-like-pattern'] : [],
    };
  }

  if (toolName === 'helper_check_gitignore') {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const text = await fs.readFile(gitignorePath, 'utf-8').catch(() => '');
    const requiredPatterns = ['.env', '.env.*', '*.pem', '*.key'];
    const missing = requiredPatterns.filter(pattern => !text.includes(pattern));
    return {
      success: missing.length === 0,
      checked: requiredPatterns,
      missing,
    };
  }

  if (toolName === 'helper_run_pytest') {
    return runVerificationCommand({
      args,
      commandArgs: ['-m', 'pytest', ...safeStringArray(args.args || ['-q'])],
    });
  }

  if (toolName === 'helper_run_ruff') {
    return runVerificationCommand({
      args,
      commandArgs: ['-m', 'ruff', 'check', ...safeStringArray(args.args || ['.'])],
    });
  }

  if (toolName === 'helper_run_semgrep') {
    return runVerificationCommand({
      args,
      commandArgs: ['-m', 'semgrep', ...safeStringArray(args.args || ['--config', 'auto', '.'])],
    });
  }

  throw new Error(`Unknown helper tool: ${toolName}`);
}

function verificationToolSchema(argsDescription) {
  return {
    type: 'OBJECT',
    properties: {
      workspacePath: { type: 'STRING', description: 'Optional repository root. Defaults to current process directory.' },
      includePaths: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Explicit files to copy into the isolated verification sandbox.' },
      args: { type: 'ARRAY', items: { type: 'STRING' }, description: argsDescription },
      sandboxProvider: { type: 'STRING', enum: ['docker-local', 'e2b-vibekit'], description: 'Optional sandbox provider. Defaults to docker-local.' },
      timeoutMs: { type: 'NUMBER', description: 'Maximum execution time in milliseconds.' },
    },
    required: [],
  };
}

async function runVerificationCommand({ args, commandArgs }) {
  const workspaceRoot = resolveWorkspaceRoot(args.workspacePath || process.cwd());
  const providers = new SandboxProviderRouter();
  const result = await providers.executeCommand({
    provider: args.sandboxProvider,
    workspacePath: workspaceRoot,
    command: 'python3',
    args: commandArgs,
    includePaths: safeStringArray(args.includePaths || []),
    timeoutMs: args.timeoutMs,
  });

  return {
    ...result,
    verification: {
      tool: commandArgs.slice(0, 2).join(' '),
      sandboxProvider: args.sandboxProvider || process.env.SELINA_SANDBOX_PROVIDER || 'docker-local',
    },
  };
}

function resolveWorkspaceRoot(workspacePath) {
  return path.resolve(workspacePath || process.cwd());
}

function resolveSafeFile(root, targetPath, { refuseSecretLikePath = false } = {}) {
  const relativePath = normalizeRelative(targetPath);
  if (refuseSecretLikePath && RESTRICTED_FILE_PATTERN.test(relativePath)) {
    throw new Error(`Refusing to scan secret-like helper path: ${targetPath}`);
  }

  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Helper tool path escapes workspace: ${targetPath}`);
  }
  return absolutePath;
}

function normalizeRelative(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Helper tool path must be a non-empty relative path.');
  }
  const normalized = path.normalize(targetPath);
  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`Helper tool path escapes workspace: ${targetPath}`);
  }
  return normalized.split(/[\\/]+/).filter(Boolean).join('/');
}

async function git(workspaceRoot, args) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: workspaceRoot,
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      env: sanitizeEnvironment(process.env, { inherit: 'core' }),
      maxBuffer: 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || error.message };
  }
}

function safeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item));
}
