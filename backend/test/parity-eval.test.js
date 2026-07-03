import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { createLiveAdapterRegistry } from '../evals/parity/live-adapters.js';
import { runParitySuite, loadParityManifest } from '../evals/parity/runner.js';
import { buildParityReport, scoreCategory, scoreTaskDimensions } from '../evals/parity/scoring.js';
import { validateParityManifest, validateParityReport } from '../evals/parity/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '..', 'evals', 'parity', 'manifest.v1.json');
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })));
});

async function makeTempDir(prefix) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(target);
  return target;
}

function perfectTaskResult(task, baselines = {}) {
  return {
    taskId: task.id,
    title: task.title,
    workflow: task.workflow,
    categoryTargets: task.categoryTargets,
    status: 'passed',
    durationMs: 0,
    startedAt: '2026-05-25T00:00:00.000Z',
    completedAt: '2026-05-25T00:00:00.000Z',
    dimensions: {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 5,
      context_and_harnessing_accuracy: 5,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    },
    scorePct: 100,
    evidence: [],
    summary: `${task.id} passed.`,
    criticalFailures: [],
    baselines,
    transcript: [],
  };
}

describe('parity eval manifest', () => {
  it('loads the versioned parity manifest and enforces rubric invariants', async () => {
    const manifest = await loadParityManifest(manifestPath);
    expect(manifest.suiteId).toBe('claude-codex-parity-v1');
    expect(manifest.tasks.length).toBeGreaterThanOrEqual(12);
    expect(manifest.rubric.dimensions).toHaveLength(5);

    const broken = {
      ...manifest,
      categoryWeights: manifest.categoryWeights.map((item, index) => (
        index === manifest.categoryWeights.length - 1
          ? { ...item, weight: item.weight - 1 }
          : item
      )),
    };
    expect(() => validateParityManifest(broken)).toThrow(/sum to 100/i);
  });
});

describe('parity scoring', () => {
  it('normalizes task dimensions and weighted category totals', async () => {
    const manifest = await loadParityManifest(manifestPath);
    expect(scoreTaskDimensions({
      outcome_correctness: 5,
      tool_choice_and_sequencing: 5,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 0,
      verification_discipline: 5,
    })).toBe(60);

    const codeTask = manifest.tasks.find(task => task.categoryTargets.includes('code_quality'));
    const categoryScore = scoreCategory('code_quality', manifest, [perfectTaskResult(codeTask)]);
    expect(categoryScore.rawScore).toBe(100);
    expect(categoryScore.weightedScore).toBe(30);
    expect(categoryScore.status).toBe('meets');
  });

  it('builds a deterministic report shape with disabled live adapters', async () => {
    const manifest = await loadParityManifest(manifestPath);
    const taskResults = manifest.tasks.map((task, index) => perfectTaskResult(task, task.liveBaselineEligible
      ? {
        claude_code: {
          adapterId: 'claude_code',
          status: 'disabled',
          scorePct: null,
          summary: 'claude_code live baseline adapter is disabled.',
          error: null,
          output: null,
        },
        codex: {
          adapterId: 'codex',
          status: 'disabled',
          scorePct: null,
          summary: 'codex live baseline adapter is disabled.',
          error: null,
          output: null,
        },
      }
      : {}));
    const report = buildParityReport({
      manifest,
      runId: 'fixed-run',
      runMode: 'full',
      startedAt: '2026-05-25T00:00:00.000Z',
      completedAt: '2026-05-25T00:00:00.000Z',
      generatedAt: '2026-05-25T00:00:00.000Z',
      taskResults,
      artifactPaths: {
        directory: '/tmp/evals/fixed-run',
        report: '/tmp/evals/fixed-run/report.json',
        summary: '/tmp/evals/fixed-run/summary.md',
        taskResults: '/tmp/evals/fixed-run/task-results.jsonl',
      },
    });

    expect(validateParityReport(report).overallScore).toBe(100);
    expect(report.status).toBe('meets parity');
    expect(report.liveBaselines).toEqual([
      expect.objectContaining({ adapterId: 'claude_code', status: 'disabled' }),
      expect.objectContaining({ adapterId: 'codex', status: 'disabled' }),
    ]);
    expect(report.summary).toContain('Run mode: full');
  });
});

describe('parity runner', () => {
  it('writes stable artifact files for a synthetic full run', async () => {
    const manifest = await loadParityManifest(manifestPath);
    const repoRoot = await makeTempDir('parity-runner-');
    const artifactDirectory = path.join(repoRoot, 'scratch', 'evals', 'fixed-run');
    const evaluatorMap = Object.fromEntries(
      [...new Set(manifest.tasks.map(task => task.localEvaluator))].map((id) => [id, async (task) => ({
        status: 'passed',
        summary: `Synthetic evaluator passed ${task.id}.`,
        dimensions: {
          outcome_correctness: 5,
          tool_choice_and_sequencing: 5,
          context_and_harnessing_accuracy: 5,
          safety_and_policy_compliance: 5,
          verification_discipline: 5,
        },
        evidence: [{
          type: 'synthetic',
          label: 'Synthetic pass',
          status: 'passed',
          summary: `Synthetic evaluator completed ${task.id}.`,
        }],
        criticalFailures: [],
      })])
    );
    const liveAdapters = [
      {
        id: 'claude_code',
        enabled: false,
        async run() {
          throw new Error('disabled adapters should not execute');
        },
      },
      {
        id: 'codex',
        enabled: false,
        async run() {
          throw new Error('disabled adapters should not execute');
        },
      },
    ];
    const nowFn = () => new Date('2026-05-25T12:00:00.000Z');

    const { report, artifactPaths } = await runParitySuite({
      manifest,
      repoRoot,
      artifactDirectory,
      runId: 'fixed-run',
      runMode: 'full',
      nowFn,
      evaluators: evaluatorMap,
      liveAdapters,
      env: {},
    });

    expect(report.overallScore).toBe(100);
    expect(report.status).toBe('meets parity');
    expect(artifactPaths.directory).toBe(artifactDirectory);

    const reportJson = JSON.parse(await fs.readFile(artifactPaths.report, 'utf-8'));
    const summary = await fs.readFile(artifactPaths.summary, 'utf-8');
    const taskJsonl = (await fs.readFile(artifactPaths.taskResults, 'utf-8')).trim().split('\n');

    expect(validateParityReport(reportJson).runId).toBe('fixed-run');
    expect(summary).toContain('Run ID: `fixed-run`');
    expect(taskJsonl).toHaveLength(manifest.tasks.length);
    expect(JSON.parse(taskJsonl[0])).toEqual(expect.objectContaining({
      taskId: manifest.tasks[0].id,
      status: 'passed',
    }));
  });
});

describe('live baseline adapters', () => {
  it('stay disabled by default until explicit commands are configured', async () => {
    const registry = createLiveAdapterRegistry({});
    expect(registry.map(item => item.id)).toEqual(['claude_code', 'codex']);
    expect(registry.every(item => item.enabled === false)).toBe(true);

    const result = await registry[0].run({ id: 'task-a' }, {
      env: {},
      repoRoot: process.cwd(),
      manifest: { suiteId: 'suite-a', thresholds: { liveBaselineDeltaPct: 10 } },
    });
    expect(result).toEqual(expect.objectContaining({
      adapterId: 'claude_code',
      status: 'disabled',
    }));
  });
});
