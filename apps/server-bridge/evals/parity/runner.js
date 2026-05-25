import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { buildParityReport, scoreTaskDimensions } from './scoring.js';
import { validateParityManifest } from './schema.js';
import { createLiveAdapterRegistry } from './live-adapters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = path.join(__dirname, 'manifest.v1.json');
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DEFAULT_RUN_MODE = 'full';
const RUN_MODES = new Set(['full', 'degraded-provider', 'degraded-mcp']);
const MODE_REQUIRED_TASKS = Object.freeze({
  'degraded-provider': 'resilience-provider-fallback',
  'degraded-mcp': 'mcp-degraded-server-sequencing',
});

function resolveNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function clipText(value, max = 2000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function nowFrom(nowFn) {
  return toIsoString(nowFn());
}

function createRunId(nowFn = () => new Date()) {
  return nowFrom(nowFn).replace(/[:.]/g, '-');
}

function ensureRunMode(runMode) {
  const normalized = String(runMode || DEFAULT_RUN_MODE).trim().toLowerCase();
  if (!RUN_MODES.has(normalized)) {
    throw new Error(`Unsupported parity run mode "${runMode}". Expected one of: ${[...RUN_MODES].join(', ')}.`);
  }
  return normalized;
}

async function runCommand(command, args = [], { cwd, env, timeoutMs = 20 * 60 * 1000 } = {}) {
  const startedAt = Date.now();
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env,
        shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(command),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(Object.assign(new Error(`Timed out after ${timeoutMs}ms.`), {
          code: 1,
          stdout,
          stderr,
        }));
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
        reject(Object.assign(error, { stdout, stderr }));
      });
      child.on('close', (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(Object.assign(new Error(stderr.trim() || `Command exited with code ${code}.`), {
            code,
            signal,
            stdout,
            stderr,
          }));
          return;
        }
        resolve({ stdout, stderr, signal });
      });
    });

    return {
      ok: true,
      command,
      args,
      cwd,
      code: 0,
      signal: result.signal || null,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      cwd,
      command,
      args,
      cwd,
      code: Number.isInteger(error.code) ? error.code : 1,
      signal: error.signal || null,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || error.message || ''),
      durationMs: Date.now() - startedAt,
      error: error.message,
    };
  }
}

function createCommandEvidence(label, result) {
  const commandLine = [result.command, ...(result.args || [])].join(' ');
  const stdout = clipText(result.stdout);
  const stderr = clipText(result.stderr);
  const summary = result.ok
    ? `${label} succeeded in ${result.durationMs}ms.`
    : `${label} failed with exit code ${result.code} in ${result.durationMs}ms.`;

  return {
    type: 'command',
    label,
    status: result.ok ? 'passed' : 'failed',
    summary,
    details: {
      command: commandLine,
      cwd: result.cwd,
      exitCode: result.code,
      signal: result.signal,
      durationMs: result.durationMs,
      stdout,
      stderr,
      ...(result.error ? { error: result.error } : {}),
    },
  };
}

function createTranscriptEntry(source, message, details = undefined, at = new Date()) {
  return {
    at: toIsoString(at),
    source,
    message: String(message),
    ...(details !== undefined ? { details } : {}),
  };
}

function normalizeTaskResult(task, rawResult, startedAt, completedAt, baselines = {}, transcript = []) {
  const dimensions = {
    outcome_correctness: Number(rawResult?.dimensions?.outcome_correctness || 0),
    tool_choice_and_sequencing: Number(rawResult?.dimensions?.tool_choice_and_sequencing || 0),
    context_and_harnessing_accuracy: Number(rawResult?.dimensions?.context_and_harnessing_accuracy || 0),
    safety_and_policy_compliance: Number(rawResult?.dimensions?.safety_and_policy_compliance || 0),
    verification_discipline: Number(rawResult?.dimensions?.verification_discipline || 0),
  };
  const durationMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());

  return {
    taskId: task.id,
    title: task.title,
    workflow: task.workflow,
    categoryTargets: task.categoryTargets,
    status: rawResult?.status === 'passed' ? 'passed' : 'failed',
    durationMs,
    startedAt,
    completedAt,
    dimensions,
    scorePct: typeof rawResult?.scorePct === 'number'
      ? rawResult.scorePct
      : scoreTaskDimensions(dimensions),
    evidence: Array.isArray(rawResult?.evidence) ? rawResult.evidence : [],
    summary: String(rawResult?.summary || `Parity evaluator completed task ${task.id}.`),
    criticalFailures: Array.isArray(rawResult?.criticalFailures) ? rawResult.criticalFailures : [],
    baselines,
    transcript,
  };
}

async function loadManifestFromPath(manifestPath = DEFAULT_MANIFEST_PATH) {
  const source = await fs.readFile(manifestPath, 'utf-8');
  return validateParityManifest(JSON.parse(source));
}

function createMemoStore() {
  const cache = new Map();
  return async function memo(key, factory) {
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve().then(factory));
    }
    return cache.get(key);
  };
}

function renderSummaryMarkdown(report) {
  const criticalFailures = report.criticalFailures.length > 0
    ? report.criticalFailures.map(item => `- \`${item.ruleId}\` on \`${item.taskId}\`: ${item.message}`).join('\n')
    : '- None';
  const liveBaselines = report.liveBaselines.length > 0
    ? report.liveBaselines.map(item => `- \`${item.adapterId}\`: ${item.summary}`).join('\n')
    : '- None';
  const categoryRows = report.categoryScores
    .map(category => `| ${category.label} | ${category.rawScore}% | ${category.weight}% | ${category.weightedScore} | ${category.status} |`)
    .join('\n');
  const taskRows = report.taskResults
    .map(task => `| ${task.taskId} | ${task.status} | ${task.scorePct}% | ${task.workflow} | ${task.summary.replace(/\|/g, '\\|')} |`)
    .join('\n');

  return [
    `# ${report.title}`,
    '',
    `- Run ID: \`${report.runId}\``,
    `- Run mode: \`${report.runMode}\``,
    `- Generated: \`${report.generatedAt}\``,
    `- Status: **${report.status}**`,
    `- Overall score: **${report.overallScore}%**`,
    '',
    '## Categories',
    '',
    '| Category | Raw | Weight | Weighted | Status |',
    '| --- | ---: | ---: | ---: | --- |',
    categoryRows,
    '',
    '## Critical Failures',
    '',
    criticalFailures,
    '',
    '## Live Baselines',
    '',
    liveBaselines,
    '',
    '## Tasks',
    '',
    '| Task | Status | Score | Workflow | Summary |',
    '| --- | --- | ---: | --- | --- |',
    taskRows,
    '',
    '## Narrative Summary',
    '',
    '```text',
    report.summary,
    '```',
    '',
  ].join('\n');
}

function modeFailureFor(mode, taskResults) {
  if (mode === DEFAULT_RUN_MODE) return [];
  const requiredTaskId = MODE_REQUIRED_TASKS[mode];
  if (!requiredTaskId) return [];
  const matched = taskResults.find(task => task.taskId === requiredTaskId);
  if (matched?.status === 'passed') return [];
  return [{
    ruleId: `${mode}_verification_incomplete`,
    taskId: requiredTaskId,
    message: `Run mode ${mode} requires task ${requiredTaskId} to pass in order to count as a completed verification mode.`,
  }];
}

async function writeTaskResultsJsonl(taskResultsPath, taskResult) {
  await fs.appendFile(taskResultsPath, `${JSON.stringify(taskResult)}\n`, 'utf-8');
}

function createDisabledBaselineResult(adapterId) {
  return {
    adapterId,
    status: 'disabled',
    scorePct: null,
    summary: `${adapterId} live baseline adapter is disabled.`,
    error: null,
    output: null,
  };
}

function prepareEvalEnvironment(baseEnv = process.env) {
  const env = {
    ...baseEnv,
    JWT_SECRET: baseEnv.JWT_SECRET || 'parity-eval-secret',
    VIBE_MASTER_KEY: baseEnv.VIBE_MASTER_KEY || 'parity-eval-master-key',
    SELINA_ACTION_GRANT_SECRET: baseEnv.SELINA_ACTION_GRANT_SECRET || 'parity-eval-action-grant-secret',
  };

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = env.JWT_SECRET;
  }
  if (!process.env.VIBE_MASTER_KEY) {
    process.env.VIBE_MASTER_KEY = env.VIBE_MASTER_KEY;
  }
  if (!process.env.SELINA_ACTION_GRANT_SECRET) {
    process.env.SELINA_ACTION_GRANT_SECRET = env.SELINA_ACTION_GRANT_SECRET;
  }

  return env;
}

async function loadDefaultEvaluators() {
  const module = await import('./evaluators.js');
  return module.parityEvaluators;
}

export async function runParitySuite(options = {}) {
  const nowFn = options.nowFn || (() => new Date());
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const serverRoot = path.join(repoRoot, 'apps', 'server-bridge');
  const env = prepareEvalEnvironment(options.env || process.env);
  const runMode = ensureRunMode(options.runMode || DEFAULT_RUN_MODE);
  const runId = options.runId || createRunId(nowFn);
  const manifest = options.manifest
    ? validateParityManifest(options.manifest)
    : await loadManifestFromPath(options.manifestPath || DEFAULT_MANIFEST_PATH);
  const evaluatorMap = options.evaluators || await loadDefaultEvaluators();
  const liveAdapters = options.liveAdapters || createLiveAdapterRegistry(env);
  const startedAt = nowFrom(nowFn);
  const artifactDirectory = options.artifactDirectory || path.join(repoRoot, 'scratch', 'evals', runId);
  const artifactPaths = {
    directory: artifactDirectory,
    report: path.join(artifactDirectory, 'report.json'),
    summary: path.join(artifactDirectory, 'summary.md'),
    taskResults: path.join(artifactDirectory, 'task-results.jsonl'),
  };

  await fs.mkdir(artifactDirectory, { recursive: true });
  await fs.writeFile(artifactPaths.taskResults, '', 'utf-8');

  const memo = createMemoStore();
  const commandCache = new Map();
  const runCommandMemoized = async (cacheKey, factory) => {
    if (!commandCache.has(cacheKey)) {
      commandCache.set(cacheKey, Promise.resolve().then(factory));
    }
    return commandCache.get(cacheKey);
  };
  const context = {
    repoRoot,
    serverRoot,
    runId,
    runMode,
    env,
    manifest,
    memo,
    async readFile(relativeOrAbsolutePath) {
      const target = path.isAbsolute(relativeOrAbsolutePath)
        ? relativeOrAbsolutePath
        : path.join(repoRoot, relativeOrAbsolutePath);
      return fs.readFile(target, 'utf-8');
    },
    async runRootNpm(cacheKey, args = [], commandOptions = {}) {
      return runCommandMemoized(cacheKey, () => runCommand(resolveNpmCommand(), args, {
        cwd: repoRoot,
        env,
        ...commandOptions,
      }));
    },
    async runServerVitest(cacheKey, files = [], commandOptions = {}) {
      return context.runRootNpm(cacheKey, [
        'test',
        '--workspace=apps/server-bridge',
        '--',
        '--run',
        ...files,
      ], commandOptions);
    },
    commandEvidence: createCommandEvidence,
  };

  const taskResults = [];
  for (const task of manifest.tasks) {
    const taskStartedAt = nowFrom(nowFn);
    const transcript = [createTranscriptEntry('runner', `Started task ${task.id}.`, {
      workflow: task.workflow,
      localEvaluator: task.localEvaluator,
      categoryTargets: task.categoryTargets,
    }, taskStartedAt)];
    const evaluator = evaluatorMap[task.localEvaluator];

    let rawResult;
    if (!evaluator) {
      rawResult = {
        status: 'failed',
        summary: `No local evaluator is registered for ${task.localEvaluator}.`,
        dimensions: {
          outcome_correctness: 0,
          tool_choice_and_sequencing: 0,
          context_and_harnessing_accuracy: 0,
          safety_and_policy_compliance: 0,
          verification_discipline: 0,
        },
        evidence: [{
          type: 'runner',
          label: 'Missing evaluator',
          status: 'failed',
          summary: `Task ${task.id} references unknown evaluator ${task.localEvaluator}.`,
          details: { taskId: task.id, localEvaluator: task.localEvaluator },
        }],
        criticalFailures: [],
      };
    } else {
      try {
        rawResult = await evaluator(task, context);
      } catch (error) {
        rawResult = {
          status: 'failed',
          summary: `Evaluator ${task.localEvaluator} threw before completing task ${task.id}.`,
          dimensions: {
            outcome_correctness: 0,
            tool_choice_and_sequencing: 0,
            context_and_harnessing_accuracy: 0,
            safety_and_policy_compliance: 0,
            verification_discipline: 0,
          },
          evidence: [{
            type: 'runner',
            label: 'Evaluator exception',
            status: 'failed',
            summary: `Evaluator ${task.localEvaluator} threw an exception.`,
            details: {
              message: error.message,
              stack: clipText(error.stack, 4000),
            },
          }],
          criticalFailures: [],
        };
      }
    }

    const baselines = {};
    if (task.liveBaselineEligible) {
      for (const adapter of liveAdapters) {
        const adapterEnabled = Object.prototype.hasOwnProperty.call(adapter, 'enabled')
          ? adapter.enabled
          : true;
        const baselineResult = adapterEnabled
          ? await adapter.run(task, context)
          : createDisabledBaselineResult(adapter.id);
        baselines[adapter.id] = baselineResult;
        transcript.push(createTranscriptEntry(
          `baseline:${adapter.id}`,
          baselineResult.summary,
          {
            status: baselineResult.status,
            scorePct: baselineResult.scorePct,
            ...(baselineResult.error ? { error: baselineResult.error } : {}),
          },
          nowFn(),
        ));
      }
    }

    const taskCompletedAt = nowFrom(nowFn);
    transcript.push(createTranscriptEntry('evaluator', rawResult.summary, {
      status: rawResult.status,
      criticalFailures: rawResult.criticalFailures || [],
    }, taskCompletedAt));

    const taskResult = normalizeTaskResult(task, rawResult, taskStartedAt, taskCompletedAt, baselines, transcript);
    await writeTaskResultsJsonl(artifactPaths.taskResults, taskResult);
    taskResults.push(taskResult);
  }

  const completedAt = nowFrom(nowFn);
  const modeFailures = modeFailureFor(runMode, taskResults);
  if (modeFailures.length > 0) {
    const requiredTaskId = MODE_REQUIRED_TASKS[runMode];
    const targetTask = taskResults.find(task => task.taskId === requiredTaskId) || taskResults[0];
    if (targetTask) {
      targetTask.criticalFailures = [...(targetTask.criticalFailures || []), ...modeFailures];
      targetTask.transcript.push(createTranscriptEntry(
        'runner',
        modeFailures[0].message,
        { runMode, taskId: requiredTaskId },
        completedAt,
      ));
    }
    await fs.writeFile(
      artifactPaths.taskResults,
      `${taskResults.map(task => JSON.stringify(task)).join('\n')}\n`,
      'utf-8',
    );
  }

  const report = buildParityReport({
    manifest,
    runId,
    runMode,
    startedAt,
    completedAt,
    generatedAt: nowFrom(nowFn),
    taskResults,
    artifactPaths,
  });
  const summaryMarkdown = renderSummaryMarkdown(report);

  await fs.writeFile(artifactPaths.report, JSON.stringify(report, null, 2), 'utf-8');
  await fs.writeFile(artifactPaths.summary, summaryMarkdown, 'utf-8');

  return {
    manifest,
    report,
    artifactPaths,
  };
}

export async function loadParityManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  return loadManifestFromPath(manifestPath);
}

export function getDefaultParityManifestPath() {
  return DEFAULT_MANIFEST_PATH;
}

export function getDefaultParityRepoRoot() {
  return DEFAULT_REPO_ROOT;
}
