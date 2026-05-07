import fs from 'fs/promises';
import { describe, expect, it } from 'vitest';
import { RolloutRecorder, createTempRolloutRoot } from '../orchestrator/rollout_recorder.js';

describe('RolloutRecorder', () => {
  it('writes durable plan, status, implementation, and JSONL event artifacts', async () => {
    const rootDir = await createTempRolloutRoot();

    try {
      const recorder = await RolloutRecorder.create({
        rootDir,
        userId: 'user-123',
        projectName: 'selina-workspace',
        prompt: 'Improve the dashboard UI',
        effortLevel: 'deep',
      });

      await recorder.writePlan(['Inspect current UI', 'Apply scoped changes', 'Verify build']);
      await recorder.record('tool_call_started', {
        name: 'read_file',
        apiKey: 'secret-value',
        args: { path: 'src/App.jsx' },
      });
      await recorder.record('tool_call_finished', 'authorization: Bearer abc123 token="nested-secret"');
      await recorder.appendImplementation('Updated SaaS shell aesthetics.');
      await recorder.updateStatus('completed', 'Build passed.');

      const paths = recorder.getPaths();
      const plan = await fs.readFile(paths.plan, 'utf-8');
      const status = await fs.readFile(paths.status, 'utf-8');
      const implementation = await fs.readFile(paths.implementation, 'utf-8');
      const events = await fs.readFile(paths.events, 'utf-8');

      expect(plan).toContain('Inspect current UI');
      expect(status).toContain('completed');
      expect(implementation).toContain('Updated SaaS shell aesthetics.');
      expect(events).toContain('"type":"tool_call_started"');
      expect(events).toContain('"apiKey":"[redacted]"');
      expect(events).not.toContain('secret-value');
      expect(events).not.toContain('abc123');
      expect(events).not.toContain('nested-secret');
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('sanitizes user-controlled path segments inside the rollout root', async () => {
    const rootDir = await createTempRolloutRoot();

    try {
      const recorder = await RolloutRecorder.create({
        rootDir,
        userId: '../admin',
        projectName: '../../outside',
        runId: '../escape',
        prompt: 'test',
      });

      const paths = recorder.getPaths();
      expect(paths.directory.startsWith(rootDir)).toBe(true);
      expect(paths.directory).not.toContain('..');
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('links rollout artifacts to session and parent rollout IDs', async () => {
    const rootDir = await createTempRolloutRoot();

    try {
      const recorder = await RolloutRecorder.create({
        rootDir,
        runId: 'child-run',
        sessionId: 'root-run',
        parentRolloutId: 'parent-run',
        projectName: 'selina-workspace',
        prompt: 'test',
      });

      const paths = recorder.getPaths();
      const plan = await fs.readFile(paths.plan, 'utf-8');
      await recorder.record('retry', { reason: 'verification failed' });
      const events = await fs.readFile(paths.events, 'utf-8');

      expect(paths.sessionId).toBe('root-run');
      expect(paths.parentRolloutId).toBe('parent-run');
      expect(paths.directory).toContain('root-run');
      expect(plan).toContain('Session: `root-run`');
      expect(events).toContain('"sessionId":"root-run"');
      expect(events).toContain('"parent_rollout_id":"parent-run"');
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
