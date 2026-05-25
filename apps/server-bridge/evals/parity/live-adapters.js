import { spawn } from 'child_process';
import { scoreTaskDimensions } from './scoring.js';

function parseCommandJson(raw, envName) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${envName} must be a JSON array of command arguments: ${error.message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(item => typeof item === 'string' && item.length > 0)) {
    throw new Error(`${envName} must be a non-empty JSON array of strings.`);
  }

  return parsed;
}

function normalizeAdapterResult(adapterId, task, raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      adapterId,
      status: 'failed',
      scorePct: null,
      summary: `${adapterId} returned an invalid result payload for task ${task.id}.`,
      error: 'Invalid adapter payload',
      output: raw,
    };
  }

  const status = raw.status === 'completed' || raw.status === 'failed'
    ? raw.status
    : 'completed';
  const scorePct = typeof raw.scorePct === 'number'
    ? raw.scorePct
    : raw.dimensions
    ? scoreTaskDimensions(raw.dimensions)
    : null;

  return {
    adapterId,
    status,
    scorePct,
    summary: String(raw.summary || `${adapterId} completed task ${task.id}.`),
    error: raw.error ? String(raw.error) : null,
    output: raw.output ?? raw,
  };
}

async function executeAdapterCommand(command, payload, { cwd, env, timeoutMs = 120000 } = {}) {
  const [file, ...args] = command;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Adapter exited with code ${code}.`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });

  const stdout = String(result.stdout || '').trim();
  if (!stdout) return {};
  return JSON.parse(stdout);
}

function createAdapter({ adapterId, envVar, cwdResolver = (context) => context.repoRoot } = {}) {
  return {
    id: adapterId,
    isEnabled(env = process.env) {
      return Boolean(env[envVar]);
    },
    async run(task, context) {
      const rawConfig = context.env[envVar];
      if (!rawConfig) {
        return {
          adapterId,
          status: 'disabled',
          scorePct: null,
          summary: `${adapterId} live baseline adapter is disabled. Set ${envVar} to a JSON argv array to enable it.`,
          error: null,
          output: null,
        };
      }

      try {
        const command = parseCommandJson(rawConfig, envVar);
        const payload = {
          adapterId,
          suiteId: context.manifest.suiteId,
          task,
          thresholds: context.manifest.thresholds,
        };
        const raw = await executeAdapterCommand(command, payload, {
          cwd: cwdResolver(context),
          env: context.env,
        });
        return normalizeAdapterResult(adapterId, task, raw);
      } catch (error) {
        return {
          adapterId,
          status: 'failed',
          scorePct: null,
          summary: `${adapterId} live baseline adapter failed for task ${task.id}.`,
          error: error.message,
          output: null,
        };
      }
    },
  };
}

export function createLiveAdapterRegistry(env = process.env) {
  return [
    createAdapter({ adapterId: 'claude_code', envVar: 'CLAUDE_CODE_EVAL_CMD_JSON' }),
    createAdapter({ adapterId: 'codex', envVar: 'CODEX_EVAL_CMD_JSON' }),
  ].map(adapter => ({
    ...adapter,
    enabled: adapter.isEnabled(env),
  }));
}
