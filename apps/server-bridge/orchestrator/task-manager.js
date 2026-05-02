/**
 * TaskManager — Vibe-Hub Brain v5.0 (Token-Efficient Queue Engine)
 * ─────────────────────────────────────────────────────────────────
 *
 * Manages a queue of agent tasks, executing them sequentially.
 * Between tasks, conversation context is flushed and the result is
 * compressed into a 1-3 sentence summary stored in the Brain Journal.
 *
 * Token Conservation Strategy
 * ───────────────────────────
 *   1. Each task starts with a CLEAN conversation history.
 *   2. The AST symbol cache (project structure) is PRESERVED — no re-indexing.
 *   3. Semantic memory (pgvector) surfaces only the top-k relevant entries
 *      for each task, not the full journal.
 *   4. Between tasks: only the summary (not the full response) is stored.
 *
 * Lifecycle per task
 * ──────────────────
 *   PENDING → RUNNING → DONE (or FAILED / CANCELLED)
 *                ↓
 *         flush context
 *                ↓
 *       save summary to journal
 *                ↓
 *         start next task
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// ─── Task status constants ────────────────────────────────────────────────────

export const TASK_STATUS = {
  PENDING:   'pending',
  RUNNING:   'running',
  DONE:      'done',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
};

// ─── TaskManager class ────────────────────────────────────────────────────────

export class TaskManager extends EventEmitter {
  /**
   * @param {import('./index.js').AgentOrchestrator} orchestrator
   * @param {Object} callbacks - WebSocket callbacks for the active session
   * @param {Function} callbacks.onToolCall
   * @param {Function} callbacks.onThought
   * @param {Function} callbacks.onClarification
   * @param {Function} callbacks.onPlan
   * @param {Function} callbacks.emitState
   * @param {Function} callbacks.onStream
   * @param {Function} callbacks.send  - Raw WS send (for queue status updates)
   */
  constructor(orchestrator, callbacks) {
    super();
    this.orchestrator = orchestrator;
    this.callbacks    = callbacks;

    /** @type {Map<string, Task>} */
    this.queue    = new Map();
    this.order    = []; // Ordered list of task IDs
    this._running = false;
    this._aborted = false;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add a task to the end of the queue.
   * @returns {string} The new task ID.
   */
  addTask(title, prompt, effortLevel = 'standard') {
    const id = uuid();
    const task = {
      id,
      title:       title || prompt.slice(0, 60),
      prompt,
      effortLevel,
      status:      TASK_STATUS.PENDING,
      createdAt:   new Date().toISOString(),
      startedAt:   null,
      completedAt: null,
      result:      null,
      error:       null,
    };
    this.queue.set(id, task);
    this.order.push(id);
    this._broadcast('queue:update', this._snapshot());
    console.log(`[TaskManager] Added task "${task.title}" (${id.slice(0, 8)})`);
    return id;
  }

  /**
   * Mark a pending task as cancelled. Running tasks are not interrupted.
   */
  cancelTask(id) {
    const task = this.queue.get(id);
    if (!task) return false;
    if (task.status === TASK_STATUS.PENDING) {
      task.status = TASK_STATUS.CANCELLED;
      this._broadcast('queue:update', this._snapshot());
      return true;
    }
    return false; // Can't cancel running/done tasks
  }

  /**
   * Move a pending task to the front of the queue.
   */
  prioritizeTask(id) {
    if (!this.queue.has(id)) return false;
    this.order = [id, ...this.order.filter(i => i !== id)];
    this._broadcast('queue:update', this._snapshot());
    return true;
  }

  /**
   * Returns a serialisable snapshot of the full queue.
   */
  getStatus() {
    return this._snapshot();
  }

  /**
   * Start executing pending tasks sequentially.
   * Safe to call multiple times — re-entrant calls are ignored.
   */
  async runQueue() {
    if (this._running) {
      console.log('[TaskManager] Queue already running, ignoring re-entry.');
      return;
    }
    this._running = true;
    this._aborted = false;
    this._broadcast('queue:started', { total: this._pendingCount() });

    try {
      for (const id of this.order) {
        if (this._aborted) break;

        const task = this.queue.get(id);
        if (!task || task.status !== TASK_STATUS.PENDING) continue;

        await this._executeTask(task);

        // Flush conversation history between tasks to conserve tokens.
        // The AST cache (symbol index) is intentionally preserved.
        this.orchestrator.flushContext();
      }
    } finally {
      this._running = false;
      this._broadcast('queue:done', this._snapshot());
      console.log('[TaskManager] Queue complete.');
    }
  }

  /**
   * Abort the queue after the current task finishes.
   */
  abortQueue() {
    this._aborted = true;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Execute a single task through the AgentOrchestrator.
   */
  async _executeTask(task) {
    task.status    = TASK_STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    this._broadcast('task:start', { id: task.id, title: task.title });
    console.log(`[TaskManager] ▶ Starting task "${task.title}"`);

    try {
      const result = await this.orchestrator.handlePrompt(
        task.prompt,
        task.effortLevel,
        this.callbacks.onToolCall,
        this.callbacks.onThought,
        this.callbacks.onClarification,
        this.callbacks.onPlan,
        undefined, // onMemoryUpdate handled internally
        (state, message) => {
          // Forward state with task context
          this.callbacks.emitState(state, message);
          this._broadcast('task:state', { id: task.id, state, message });
        },
        this.callbacks.onStream,
      );

      const content = typeof result === 'string'
        ? result
        : result?.content ?? '[No output]';

      task.status      = TASK_STATUS.DONE;
      task.completedAt = new Date().toISOString();
      // Store only a compact summary — not the full response — to save tokens
      task.result      = this._summarize(content);

      this._broadcast('task:complete', {
        id:      task.id,
        title:   task.title,
        summary: task.result,
        full:    content,
      });

      console.log(`[TaskManager] ✓ Task "${task.title}" done.`);

      // Persist a compact entry to the Brain Journal for future semantic retrieval
      if (this.orchestrator.userId) {
        const { appendBrainJournal } = await import('../memory/loader.js');
        await appendBrainJournal(
          this.orchestrator.userId,
          this.orchestrator.projectName,
          `[Task: ${task.title}] ${task.result}`,
        ).catch(err => console.warn('[TaskManager] Memory persist failed:', err.message));
      }

    } catch (err) {
      task.status      = TASK_STATUS.FAILED;
      task.completedAt = new Date().toISOString();
      task.error       = err.message;
      this._broadcast('task:failed', { id: task.id, title: task.title, error: err.message });
      console.error(`[TaskManager] ✗ Task "${task.title}" failed:`, err.message);
      // Continue to next task even on failure
    }

    this._broadcast('queue:update', this._snapshot());
  }

  /**
   * Trim a long response to a compact summary (≤ 3 sentences, ≤ 400 chars).
   * This is what gets stored in the Brain Journal between tasks.
   */
  _summarize(content) {
    if (!content || typeof content !== 'string') return '[No output]';
    // Take the first 3 sentences or 400 chars, whichever is shorter
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const summary   = sentences.slice(0, 3).join(' ').trim() || content.slice(0, 400);
    return summary.length > 400 ? summary.slice(0, 397) + '...' : summary;
  }

  _pendingCount() {
    return [...this.queue.values()].filter(t => t.status === TASK_STATUS.PENDING).length;
  }

  _snapshot() {
    return {
      running:  this._running,
      aborted:  this._aborted,
      tasks:    this.order.map(id => this.queue.get(id)).filter(Boolean),
      counts: {
        total:     this.queue.size,
        pending:   [...this.queue.values()].filter(t => t.status === TASK_STATUS.PENDING).length,
        running:   [...this.queue.values()].filter(t => t.status === TASK_STATUS.RUNNING).length,
        done:      [...this.queue.values()].filter(t => t.status === TASK_STATUS.DONE).length,
        failed:    [...this.queue.values()].filter(t => t.status === TASK_STATUS.FAILED).length,
        cancelled: [...this.queue.values()].filter(t => t.status === TASK_STATUS.CANCELLED).length,
      },
    };
  }

  /**
   * Send a typed event over the WebSocket back to the connected client.
   */
  _broadcast(type, payload) {
    try {
      this.callbacks.send({ type, ...payload });
    } catch {
      // Client may have disconnected — safe to ignore
    }
    this.emit(type, payload);
  }
}
