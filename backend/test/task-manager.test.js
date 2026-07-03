/**
 * test/task-manager.test.js
 * Unit tests for the TaskManager queue engine.
 *
 * Fully isolated — no DB, no Gemini API, no Docker.
 * The AgentOrchestrator is replaced by a lightweight mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager, TASK_STATUS } from '../orchestrator/task-manager.js';
import { SharedContext } from '../orchestrator/context.js';

// ─── Mock orchestrator ────────────────────────────────────────────────────────

function makeMockOrchestrator(resultContent = 'Task complete.') {
  const ctx = new SharedContext();
  return {
    context:     ctx,
    userId:      '550e8400-e29b-41d4-a716-446655440000',
    projectName: 'test-project',
    experts:     {},
    // handlePrompt resolves immediately with a canned result
    handlePrompt: vi.fn().mockResolvedValue({ content: resultContent, toolCalls: [] }),
    // flushContext wipes history but keeps the astCache
    flushContext() {
      const preserved = { astCache: this.context.astCache, fileCache: this.context.fileCache };
      this.context = new SharedContext();
      this.context.astCache  = preserved.astCache;
      this.context.fileCache = preserved.fileCache;
    },
  };
}

// ─── Mock callbacks ───────────────────────────────────────────────────────────

function makeCallbacks(sendFn = vi.fn()) {
  return {
    onToolCall:      vi.fn(),
    onThought:       vi.fn(),
    onClarification: vi.fn(),
    onPlan:          vi.fn(),
    emitState:       vi.fn(),
    onStream:        vi.fn(),
    send:            sendFn,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TaskManager — queue operations', () => {
  let tm, orchestrator, callbacks, sent;

  beforeEach(() => {
    sent        = [];
    orchestrator = makeMockOrchestrator();
    callbacks   = makeCallbacks((payload) => sent.push(payload));
    tm          = new TaskManager(orchestrator, callbacks);
  });

  // ── addTask ─────────────────────────────────────────────────────────────────

  it('addTask pushes a task with PENDING status', () => {
    const id = tm.addTask('Fix login bug', 'Fix the auth flow');
    expect(tm.queue.has(id)).toBe(true);
    expect(tm.queue.get(id).status).toBe(TASK_STATUS.PENDING);
    expect(tm.queue.get(id).effortLevel).toBe('standard');
  });

  it('addTask uses the title as-is or falls back to prompt slice', () => {
    const id = tm.addTask('', 'Do something very long that will get sliced');
    expect(tm.queue.get(id).title).toBe('Do something very long that will get sliced');
  });

  it('addTask emits queue:update to the client', () => {
    tm.addTask('Task A', 'Prompt A');
    const update = sent.find(p => p.type === 'queue:update');
    expect(update).toBeDefined();
    expect(update.counts.total).toBe(1);
  });

  it('addTask preserves insertion order', () => {
    tm.addTask('T1', 'P1');
    tm.addTask('T2', 'P2');
    tm.addTask('T3', 'P3');
    expect(tm.order).toHaveLength(3);
    expect(tm.queue.get(tm.order[0]).title).toBe('T1');
    expect(tm.queue.get(tm.order[2]).title).toBe('T3');
  });

  // ── cancelTask ──────────────────────────────────────────────────────────────

  it('cancelTask marks a PENDING task as CANCELLED', () => {
    const id = tm.addTask('T', 'P');
    const result = tm.cancelTask(id);
    expect(result).toBe(true);
    expect(tm.queue.get(id).status).toBe(TASK_STATUS.CANCELLED);
  });

  it('cancelTask returns false for unknown id', () => {
    expect(tm.cancelTask('nonexistent-id')).toBe(false);
  });

  // ── prioritizeTask ──────────────────────────────────────────────────────────

  it('prioritizeTask moves a task to the front', () => {
    tm.addTask('T1', 'P1');
    tm.addTask('T2', 'P2');
    const lastId = tm.addTask('T3', 'P3');
    tm.prioritizeTask(lastId);
    expect(tm.order[0]).toBe(lastId);
  });

  // ── getStatus ───────────────────────────────────────────────────────────────

  it('getStatus returns correct counts', () => {
    tm.addTask('T1', 'P1');
    tm.addTask('T2', 'P2');
    const id = tm.addTask('T3', 'P3');
    tm.cancelTask(id);

    const status = tm.getStatus();
    expect(status.counts.total).toBe(3);
    expect(status.counts.pending).toBe(2);
    expect(status.counts.cancelled).toBe(1);
  });

  // ── runQueue ─────────────────────────────────────────────────────────────────

  it('runQueue executes tasks sequentially and calls flushContext between them', async () => {
    tm.addTask('T1', 'P1');
    tm.addTask('T2', 'P2');

    const flushSpy = vi.spyOn(orchestrator, 'flushContext');

    await tm.runQueue();

    // handlePrompt should be called once per task
    expect(orchestrator.handlePrompt).toHaveBeenCalledTimes(2);
    // flushContext should be called once per task (after each)
    expect(flushSpy).toHaveBeenCalledTimes(2);
  });

  it('runQueue skips CANCELLED tasks', async () => {
    const id = tm.addTask('T1', 'P1');
    tm.addTask('T2', 'P2');
    tm.cancelTask(id);

    await tm.runQueue();

    expect(orchestrator.handlePrompt).toHaveBeenCalledTimes(1); // Only T2 ran
  });

  it('runQueue marks tasks as DONE on success', async () => {
    const id = tm.addTask('T', 'P');
    await tm.runQueue();
    expect(tm.queue.get(id).status).toBe(TASK_STATUS.DONE);
  });

  it('runQueue marks tasks as FAILED on error and continues', async () => {
    orchestrator.handlePrompt = vi.fn()
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce({ content: 'OK', toolCalls: [] });

    const id1 = tm.addTask('Fail', 'Will fail');
    const id2 = tm.addTask('Pass', 'Will pass');

    await tm.runQueue();

    expect(tm.queue.get(id1).status).toBe(TASK_STATUS.FAILED);
    expect(tm.queue.get(id2).status).toBe(TASK_STATUS.DONE);
  });

  it('runQueue emits queue:done when finished', async () => {
    tm.addTask('T', 'P');
    await tm.runQueue();
    const done = sent.find(p => p.type === 'queue:done');
    expect(done).toBeDefined();
  });

  // ── _summarize ───────────────────────────────────────────────────────────────

  it('_summarize caps output at 400 characters', () => {
    const long = 'A '.repeat(300);
    const result = tm._summarize(long);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('_summarize returns fallback for empty input', () => {
    expect(tm._summarize('')).toBe('[No output]');
    expect(tm._summarize(null)).toBe('[No output]');
  });

  // ── Context flushing ─────────────────────────────────────────────────────────

  it('flushContext resets history but preserves astCache', () => {
    orchestrator.context.addMessage('user', 'Hello');
    orchestrator.context.astCache.set('file.js', [{ name: 'foo', kind: 'function' }]);

    orchestrator.flushContext();

    expect(orchestrator.context.history).toHaveLength(0);
    expect(orchestrator.context.astCache.size).toBe(1);
  });
});
