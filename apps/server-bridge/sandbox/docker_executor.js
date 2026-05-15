import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 64_000;
const SANDBOX_DIR_PREFIX = 'selina_sandbox_';
const RESTRICTED_PATH_SEGMENTS = new Set([
  '.aws',
  '.azure',
  '.docker',
  '.git',
  '.gnupg',
  '.kube',
  '.ssh',
]);
const RESTRICTED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.yarnrc',
  'credentials',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa',
]);
const RESTRICTED_FILE_PATTERNS = [
  /(^|[._-])(secret|secrets|credential|credentials|token|tokens|api[_-]?key|private[_-]?key)($|[._-])/i,
  /\.(pem|p12|pfx|key)$/i,
];

const RUNTIME_CONFIG = {
  node: { image: 'node:20-alpine', executable: 'node' },
  npm: { image: 'node:20-alpine', executable: 'npm' },
  sh: { image: 'alpine:3.20', executable: '/bin/sh' },
  bash: { image: 'alpine:3.20', executable: '/bin/sh' },
  python: { image: 'python:3.12-alpine', executable: 'python3' },
  python3: { image: 'python:3.12-alpine', executable: 'python3' },
  bun: { image: 'oven/bun:1-alpine', executable: 'bun' },
};

function clampTimeout(timeoutMs) {
  const parsed = Number.parseInt(timeoutMs, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(parsed, 1_000), MAX_TIMEOUT_MS);
}

function appendLimited(current, chunk) {
  const next = current + chunk.toString();
  return next.length > MAX_OUTPUT_CHARS ? next.slice(-MAX_OUTPUT_CHARS) : next;
}

function resolveWorkspacePath(workspacePath) {
  return path.resolve(workspacePath || process.cwd());
}

function toDockerMountPath(workspacePath) {
  return workspacePath.replace(/\\/g, '/');
}

function normalizeScriptPath(scriptPath) {
  if (!scriptPath || typeof scriptPath !== 'string') {
    throw new Error('scriptPath is required for local Docker sandbox execution.');
  }

  return normalizeSandboxRelativePath(scriptPath, 'scriptPath');
}

function normalizeSandboxRelativePath(targetPath, fieldName = 'path') {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error(`${fieldName} must be a non-empty relative path.`);
  }

  const normalized = path.normalize(targetPath);
  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${fieldName} must be a relative path inside the workspace.`);
  }

  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0 || parts.some(part => part === '..')) {
    throw new Error(`${fieldName} must point to a file inside the workspace.`);
  }

  return parts.join('/');
}

function assertAllowedSandboxPath(relativePath) {
  const normalized = normalizeSandboxRelativePath(relativePath);
  const parts = normalized.split('/');
  const basename = parts[parts.length - 1].toLowerCase();

  if (parts.some(part => RESTRICTED_PATH_SEGMENTS.has(part.toLowerCase()))) {
    throw new Error(`Refusing to copy restricted sandbox path: ${relativePath}`);
  }

  if (basename.startsWith('.env') || RESTRICTED_FILE_NAMES.has(basename)) {
    throw new Error(`Refusing to copy restricted sandbox file: ${relativePath}`);
  }
  if (RESTRICTED_FILE_PATTERNS.some(pattern => pattern.test(basename))) {
    throw new Error(`Refusing to copy secret-like sandbox file: ${relativePath}`);
  }

  return normalized;
}

function isLikelyFileArg(arg) {
  if (!arg || typeof arg !== 'string') return false;
  if (arg.startsWith('-')) return false;
  if (/^[a-z]+:\/\//i.test(arg)) return false;
  if (arg.includes('=')) return false;
  return arg.startsWith('.') || arg.includes('/') || arg.includes('\\') || /\.[a-z0-9]+$/i.test(arg);
}

async function maybeInferExistingFileArg(workspaceRoot, arg) {
  if (!isLikelyFileArg(arg)) return null;
  const relativePath = normalizeSandboxRelativePath(arg, 'command argument');
  const sourcePath = path.resolve(workspaceRoot, relativePath);
  const relativeToRoot = path.relative(workspaceRoot, sourcePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Command argument escapes workspace: ${arg}`);
  }

  try {
    const stat = await fs.stat(sourcePath);
    return stat.isFile() ? relativePath : null;
  } catch {
    return null;
  }
}

async function inferRequestedPathsFromArgs(workspaceRoot, args = []) {
  const requestedPaths = [];
  for (const arg of args) {
    const inferredPath = await maybeInferExistingFileArg(workspaceRoot, String(arg));
    if (inferredPath) requestedPaths.push(inferredPath);
  }
  return requestedPaths;
}

function uniquePaths(paths = []) {
  return [...new Set(paths.filter(Boolean).map(item => assertAllowedSandboxPath(item)))];
}

async function copyRequestedFile({ sourceRoot, sandboxRoot, relativePath }) {
  const sourcePath = path.resolve(sourceRoot, relativePath);
  const targetPath = path.resolve(sandboxRoot, relativePath);
  const relativeToSourceRoot = path.relative(sourceRoot, sourcePath);
  const relativeToSandboxRoot = path.relative(sandboxRoot, targetPath);

  if (relativeToSourceRoot.startsWith('..') || path.isAbsolute(relativeToSourceRoot)) {
    throw new Error(`Refusing to copy path outside workspace: ${relativePath}`);
  }
  if (relativeToSandboxRoot.startsWith('..') || path.isAbsolute(relativeToSandboxRoot)) {
    throw new Error(`Refusing to write outside sandbox workspace: ${relativePath}`);
  }

  const stat = await fs.stat(sourcePath);
  if (!stat.isFile()) {
    throw new Error(`Sandbox can only copy explicit files, not directories: ${relativePath}`);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function createIsolatedSandboxWorkspace({ workspacePath, requestedPaths = [] }) {
  const sourceRoot = resolveWorkspacePath(workspacePath);
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), SANDBOX_DIR_PREFIX));
  const copiedPaths = uniquePaths(requestedPaths);

  try {
    for (const relativePath of copiedPaths) {
      await copyRequestedFile({ sourceRoot, sandboxRoot, relativePath });
    }
    return { sourceRoot, sandboxRoot, copiedPaths };
  } catch (error) {
    await fs.rm(sandboxRoot, { recursive: true, force: true });
    throw error;
  }
}

function getRuntimeConfig(runtime = 'node') {
  const normalized = String(runtime || 'node').toLowerCase();
  const config = RUNTIME_CONFIG[normalized];
  if (!config) {
    throw new Error(`Unsupported local Docker runtime: ${runtime}`);
  }
  return config;
}

async function cleanupContainer(containerName) {
  try {
    await execFileAsync('docker', ['rm', '-f', containerName], {
      timeout: 5_000,
      env: sanitizeEnvironment(process.env, { inherit: 'core' }),
    });
  } catch {
    // Best-effort cleanup only. The docker run command also uses --rm.
  }
}

async function cleanupSandboxWorkspace(sandboxRoot) {
  if (!sandboxRoot) return;
  await fs.rm(sandboxRoot, { recursive: true, force: true }).catch(() => null);
}

function runDocker({ sandboxWorkspacePath, image, containerArgs, timeoutMs, copiedPaths = [] }) {
  const timeout = clampTimeout(timeoutMs);
  const containerName = `selina-sandbox-${crypto.randomUUID()}`;
  const dockerArgs = [
    'run',
    '--rm',
    '--name',
    containerName,
    '--network',
    'none',
    '--cpus',
    '1',
    '--memory',
    '512m',
    '--pids-limit',
    '128',
    '-v',
    `${toDockerMountPath(sandboxWorkspacePath)}:/workspace:rw`,
    '-w',
    '/workspace',
    image,
    ...containerArgs,
  ];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn('docker', dockerArgs, {
      shell: false,
      env: sanitizeEnvironment(process.env, { inherit: 'core' }),
    });
    const timer = setTimeout(async () => {
      timedOut = true;
      child.kill('SIGKILL');
      await cleanupContainer(containerName);
      await cleanupSandboxWorkspace(sandboxWorkspacePath);
    }, timeout);

    child.stdout.on('data', (chunk) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', async (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanupSandboxWorkspace(sandboxWorkspacePath);
      resolve({
        success: false,
        exitCode: null,
        timedOut,
        stdout,
        stderr,
        error: error.message,
        sandbox: {
          type: 'local_docker',
          network: 'none',
          workspace: 'isolated_tmp',
          mount: 'rw',
          copiedFiles: copiedPaths,
        },
      });
    });

    child.on('close', async (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await cleanupSandboxWorkspace(sandboxWorkspacePath);
      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
        sandbox: {
          type: 'local_docker',
          network: 'none',
          workspace: 'isolated_tmp',
          mount: 'rw',
          copiedFiles: copiedPaths,
        },
      });
    });
  });
}

export class SandboxExecutor {
  static async executeLocalDockerSandbox({ workspacePath, scriptPath, runtime = 'node', timeoutMs, includePaths = [] } = {}) {
    const relativeScriptPath = normalizeScriptPath(scriptPath);
    const config = getRuntimeConfig(runtime);
    const extraPaths = Array.isArray(includePaths) ? includePaths.map(String) : [];
    const isolatedWorkspace = await createIsolatedSandboxWorkspace({
      workspacePath,
      requestedPaths: [relativeScriptPath, ...extraPaths],
    });

    return runDocker({
      sandboxWorkspacePath: isolatedWorkspace.sandboxRoot,
      image: config.image,
      containerArgs: [config.executable, `/workspace/${relativeScriptPath}`],
      timeoutMs,
      copiedPaths: isolatedWorkspace.copiedPaths,
    });
  }

  static async executeLocalDockerCommand({ workspacePath, command, args = [], timeoutMs, includePaths = [] } = {}) {
    if (!command || typeof command !== 'string') {
      throw new Error('command is required for local Docker sandbox execution.');
    }

    const config = getRuntimeConfig(command);
    const safeArgs = Array.isArray(args) ? args.map(String) : [];
    const extraPaths = Array.isArray(includePaths) ? includePaths.map(String) : [];
    const resolvedWorkspace = resolveWorkspacePath(workspacePath);
    const inferredPaths = await inferRequestedPathsFromArgs(resolvedWorkspace, safeArgs);
    const isolatedWorkspace = await createIsolatedSandboxWorkspace({
      workspacePath: resolvedWorkspace,
      requestedPaths: [...inferredPaths, ...extraPaths],
    });

    return runDocker({
      sandboxWorkspacePath: isolatedWorkspace.sandboxRoot,
      image: config.image,
      containerArgs: [config.executable, ...safeArgs],
      timeoutMs,
      copiedPaths: isolatedWorkspace.copiedPaths,
    });
  }
}

export default SandboxExecutor;
