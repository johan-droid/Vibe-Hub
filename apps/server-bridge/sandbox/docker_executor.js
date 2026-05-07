import crypto from 'crypto';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 64_000;

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

  const normalized = path.normalize(scriptPath);
  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error('scriptPath must be a relative path inside the workspace.');
  }

  return normalized.replace(/\\/g, '/');
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

function runDocker({ workspacePath, image, containerArgs, timeoutMs }) {
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
    `${toDockerMountPath(workspacePath)}:/workspace:ro`,
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
    }, timeout);

    child.stdout.on('data', (chunk) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: false,
        exitCode: null,
        timedOut,
        stdout,
        stderr,
        error: error.message,
        sandbox: { type: 'local_docker', network: 'none' },
      });
    });

    child.on('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
        sandbox: { type: 'local_docker', network: 'none' },
      });
    });
  });
}

export class SandboxExecutor {
  static async executeLocalDockerSandbox({ workspacePath, scriptPath, runtime = 'node', timeoutMs } = {}) {
    const resolvedWorkspace = resolveWorkspacePath(workspacePath);
    const relativeScriptPath = normalizeScriptPath(scriptPath);
    const config = getRuntimeConfig(runtime);

    return runDocker({
      workspacePath: resolvedWorkspace,
      image: config.image,
      containerArgs: [config.executable, `/workspace/${relativeScriptPath}`],
      timeoutMs,
    });
  }

  static async executeLocalDockerCommand({ workspacePath, command, args = [], timeoutMs } = {}) {
    if (!command || typeof command !== 'string') {
      throw new Error('command is required for local Docker sandbox execution.');
    }

    const config = getRuntimeConfig(command);
    const safeArgs = Array.isArray(args) ? args.map(String) : [];

    return runDocker({
      workspacePath: resolveWorkspacePath(workspacePath),
      image: config.image,
      containerArgs: [config.executable, ...safeArgs],
      timeoutMs,
    });
  }
}

export default SandboxExecutor;
