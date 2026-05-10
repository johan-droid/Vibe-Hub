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

// ─── Mock DB ────────────────────────────────────────────────────────────────
vi.mock('../memory/loader.js', () => ({
  appendBrainJournal: vi.fn().mockResolvedValue(undefined),
  loadMemory: vi.fn().mockResolvedValue({ userMemory: null, brainJournal: [] })
}));

// ─── Mock orchestrator ────────────────────────────────────────────────────────

function makeMockOrchestrator(resultContent = 'Task complete.') {
  const ctx = new SharedContext();
  return {
    context:     ctx,
    userId:      null,
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

  it('addTask initializes a task in PENDING state', () => {
    const id = tm.addTask({ prompt: 'test' });
    expect(id).toBeDefined();

    const status = tm.taskMap.get(id);
    expect(status.status).toBe(TASK_STATUS.PENDING);
    expect(status.details.prompt).toBe('test');
    expect(tm.queue.length).toBe(1);
  });

  it('addTask skips adding if task is already in terminal state or running', () => {
    const id = tm.addTask({ prompt: 'first' });

    // Fake a running state
    tm.taskMap.get(id).status = TASK_STATUS.RUNNING;

    const dupId = tm.addTask({ prompt: 'first' });
    // Should return existing ID, queue length remains 1
    expect(dupId).toBe(id);
    expect(tm.queue.length).toBe(1);
  });

  // ── cancelTask ──────────────────────────────────────────────────────────────

  it('cancelTask marks a PENDING task as CANCELLED', () => {
    const id = tm.addTask({ prompt: 'to cancel' });
    tm.cancelTask(id);

    expect(tm.taskMap.get(id).status).toBe(TASK_STATUS.CANCELLED);
  });

  it('cancelTask ignores already finished tasks', () => {
    const id = tm.addTask({ prompt: 'already done' });
    tm.taskMap.get(id).status = TASK_STATUS.DONE;
    tm.cancelTask(id);
    // Should remain DONE
    expect(tm.taskMap.get(id).status).toBe(TASK_STATUS.DONE);
  });

  // ── getPendingTasks ─────────────────────────────────────────────────────────

  it('getPendingTasks returns only PENDING tasks', () => {
    const id1 = tm.addTask({ prompt: '1' });
    const id2 = tm.addTask({ prompt: '2' });

    tm.cancelTask(id1);

    const pending = tm.getPendingTasks();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(id2);
  });

  // ── clearQueue ──────────────────────────────────────────────────────────────

  it('clearQueue removes everything', () => {
    tm.addTask({ prompt: '1' });
    tm.addTask({ prompt: '2' });
    tm.clearQueue();
    expect(tm.queue.length).toBe(0);
    expect(tm.taskMap.size).toBe(0);
  });

  // ── runQueue ────────────────────────────────────────────────────────────────

  it('runQueue executes tasks sequentially and calls flushContext between them', async () => {
    const id1 = tm.addTask({ prompt: 'task 1' });
    const id2 = tm.addTask({ prompt: 'task 2' });

    // Spy on flushContext
    const flushSpy = vi.spyOn(orchestrator, 'flushContext');

    // Manually trigger runQueue
    await tm.runQueue();

    expect(tm.taskMap.get(id1).status).toBe(TASK_STATUS.DONE);
    expect(tm.taskMap.get(id2).status).toBe(TASK_STATUS.DONE);

    // flushContext should be called after each completed task
    expect(flushSpy).toHaveBeenCalledTimes(2);

    // Orchestrator handlePrompt should be called 2 times
    expect(orchestrator.handlePrompt).toHaveBeenCalledTimes(2);
  });

  it('runQueue skips CANCELLED tasks', async () => {
    const id1 = tm.addTask({ prompt: 'task 1' });
    const id2 = tm.addTask({ prompt: 'task 2' });

    tm.cancelTask(id1);

    await tm.runQueue();
    expect(tm.taskMap.get(id1).status).toBe(TASK_STATUS.CANCELLED);
    expect(tm.taskMap.get(id2).status).toBe(TASK_STATUS.DONE);
  });

  it('runQueue marks tasks as DONE on success', async () => {
    const id = tm.addTask({ prompt: 'task 1' });
    await tm.runQueue();

    const status = tm.taskMap.get(id);
    expect(status.status).toBe(TASK_STATUS.DONE);
    expect(status.result.content).toBe('Task complete.');
  });

  it('runQueue marks tasks as FAILED on error and continues', async () => {
    orchestrator.handlePrompt.mockRejectedValueOnce(new Error('Test failure'));

    const id1 = tm.addTask({ prompt: 'fail task' });
    const id2 = tm.addTask({ prompt: 'success task' });

    await tm.runQueue();

    expect(tm.taskMap.get(id1).status).toBe(TASK_STATUS.FAILED);
    expect(tm.taskMap.get(id2).status).toBe(TASK_STATUS.DONE);
  });

  it('runQueue emits queue:done when finished', async () => {
    tm.addTask({ prompt: 'task 1' });
    await tm.runQueue();

    // Find the emitted 'queue:done' payload
    const donePayload = sent.find(p => p.type === 'queue:done');
    expect(donePayload).toBeDefined();
  });
});
