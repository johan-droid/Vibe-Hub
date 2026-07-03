/**
 * TaskManager V6 — XState-based Execution with DAG Rollback
 * ============================================================
 *
 * Replaces linear task queue with a state machine that tracks
 * each action as a node in a Directed Acyclic Graph.
 *
 * Key Features:
 *   - Rollback on 3 consecutive verification failures
 *   - Automatic code restoration to parent node state
 *   - Alternate strategy injection after rollback
 *   - Maintains legacy queue API for compatibility
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { 
  StateMachineTaskManager, 
  ExecutionNode, 
  RollbackSystem 
} from './state-machine.js';

// ─── Task status constants ────────────────────────────────────────────────────

export const TASK_STATUS = {
  PENDING:    'pending',
  RUNNING:    'running',
  EXECUTING:  'executing',
  VERIFYING:  'verifying',
  DEBATING:   'debating',
  ROLLINGBACK:'rollingback',
  DONE:       'done',
  FAILED:     'failed',
  CANCELLED:  'cancelled',
};

// ─── V6 TaskManager ───────────────────────────────────────────────────────────

export class TaskManager extends EventEmitter {
  /**
   * @param {import('./index.js').AgentOrchestrator} orchestrator
   * @param {Object} callbacks - WebSocket callbacks for the active session
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

    // V6: State machine integration
    this.useStateMachine = process.env.USE_XSTATE_MACHINE === 'true';
    this.stateMachines = new Map(); // taskId -> StateMachineTaskManager
  }

  // ─── Public API (Legacy Compatible) ────────────────────────────────────────

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
      executionHistory: [], // V6: Track state transitions
    };
    this.queue.set(id, task);
    this.order.push(id);
    this._broadcast('queue:update', this._snapshot());
    return id;
  }

  cancelTask(id) {
    const task = this.queue.get(id);
    if (!task) return false;
    if (task.status === TASK_STATUS.PENDING) {
      task.status = TASK_STATUS.CANCELLED;
      this._broadcast('queue:update', this._snapshot());
      return true;
    }
    return false;
  }

  prioritizeTask(id) {
    if (!this.queue.has(id)) return false;
    this.order = [id, ...this.order.filter(i => i !== id)];
    this._broadcast('queue:update', this._snapshot());
    return true;
  }

  getStatus() {
    return this._snapshot();
  }

  // ─── V6: State Machine Execution ─────────────────────────────────────────────

  async runQueue() {
    if (this._running) return;
    this._running = true;
    this._aborted = false;
    this._broadcast('queue:started', { total: this._pendingCount() });

    try {
      for (const id of this.order) {
        if (this._aborted) break;

        const task = this.queue.get(id);
        if (!task || task.status !== TASK_STATUS.PENDING) continue;

        if (this.useStateMachine) {
          await this._executeTaskV6(task);
        } else {
          await this._executeTaskLegacy(task);
        }
      }
    } finally {
      this._running = false;
      this._broadcast('queue:done', this._snapshot());
    }
  }

  abortQueue() {
    this._aborted = true;
  }

  /**
   * V6 Execution: XState-based with rollback
   */
  async _executeTaskV6(task) {
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    this._broadcast('task:start', { id: task.id, title: task.title });

    // Create state machine for this task
    const smTaskManager = new StateMachineTaskManager(this.orchestrator, {
      ...this.callbacks,
      send: (payload) => this._broadcast(payload.type, payload)
    });
    
    this.stateMachines.set(task.id, smTaskManager);

    try {
      const result = await smTaskManager.executeTask(task);
      
      if (result.success) {
        task.status = TASK_STATUS.DONE;
        task.result = this._summarize(result.node?.result || '[Completed]');
        task.executionHistory = ['idle', 'executing', 'verifying', 'debating', 'complete'];
        
        this._broadcast('task:complete', {
          id: task.id,
          title: task.title,
          summary: task.result,
          full: result.node?.result,
          history: task.executionHistory
        });
      } else {
        task.status = TASK_STATUS.FAILED;
        task.error = 'Task failed after max rollbacks or verification attempts';
        task.executionHistory = result.history || ['idle', 'failed'];
        
        this._broadcast('task:failed', {
          id: task.id,
          title: task.title,
          error: task.error,
          history: task.executionHistory
        });
      }

      // Persist to brain journal
      if (this.orchestrator.userId && result.success) {
        const { appendBrainJournal } = await import('../memory/loader.js');
        await appendBrainJournal(
          this.orchestrator.userId,
          this.orchestrator.projectName,
          `[Task: ${task.title}] ${task.result}`,
        ).catch(() => {});
      }

    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.error = err.message;
      this._broadcast('task:failed', {
        id: task.id,
        title: task.title,
        error: err.message
      });
    } finally {
      task.completedAt = new Date().toISOString();
      this.stateMachines.delete(task.id);
      this._broadcast('queue:update', this._snapshot());
    }
  }

  /**
   * Legacy Execution: Linear (fallback)
   */
  async _executeTaskLegacy(task) {
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    this._broadcast('task:start', { id: task.id, title: task.title });

    try {
      const result = await this.orchestrator.handlePrompt(
        task.prompt,
        task.effortLevel,
        this.callbacks.onToolCall,
        this.callbacks.onThought,
        this.callbacks.onClarification,
        this.callbacks.onPlan,
        undefined,
        (state, message) => {
          this.callbacks.emitState(state, message);
          this._broadcast('task:state', { id: task.id, state, message });
        },
        this.callbacks.onStream,
      );

      const content = typeof result === 'string'
        ? result
        : result?.content ?? '[No output]';

      task.status = TASK_STATUS.DONE;
      task.completedAt = new Date().toISOString();
      task.result = this._summarize(content);

      this._broadcast('task:complete', {
        id: task.id,
        title: task.title,
        summary: task.result,
        full: content,
      });

      if (this.orchestrator.userId) {
        const { appendBrainJournal } = await import('../memory/loader.js');
        await appendBrainJournal(
          this.orchestrator.userId,
          this.orchestrator.projectName,
          `[Task: ${task.title}] ${task.result}`,
        ).catch(() => {});
      }

    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.completedAt = new Date().toISOString();
      task.error = err.message;
      this._broadcast('task:failed', { id: task.id, title: task.title, error: err.message });
    }

    this._broadcast('queue:update', this._snapshot());
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _summarize(content) {
    if (!content || typeof content !== 'string') return '[No output]';
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const summary = sentences.slice(0, 3).join(' ').trim() || content.slice(0, 400);
    return summary.length > 400 ? summary.slice(0, 397) + '...' : summary;
  }

  _pendingCount() {
    return [...this.queue.values()].filter(t => t.status === TASK_STATUS.PENDING).length;
  }

  _snapshot() {
    return {
      running:  this._running,
      aborted:  this._aborted,
      v6Mode:   this.useStateMachine,
      tasks:    this.order.map(id => this.queue.get(id)).filter(Boolean),
      counts: {
        total:     this.queue.size,
        pending:   [...this.queue.values()].filter(t => t.status === TASK_STATUS.PENDING).length,
        running:   [...this.queue.values()].filter(t => t.status === TASK_STATUS.RUNNING).length,
        executing: [...this.queue.values()].filter(t => t.status === TASK_STATUS.EXECUTING).length,
        verifying: [...this.queue.values()].filter(t => t.status === TASK_STATUS.VERIFYING).length,
        debating:  [...this.queue.values()].filter(t => t.status === TASK_STATUS.DEBATING).length,
        rollingback:[...this.queue.values()].filter(t => t.status === TASK_STATUS.ROLLINGBACK).length,
        done:      [...this.queue.values()].filter(t => t.status === TASK_STATUS.DONE).length,
        failed:    [...this.queue.values()].filter(t => t.status === TASK_STATUS.FAILED).length,
        cancelled: [...this.queue.values()].filter(t => t.status === TASK_STATUS.CANCELLED).length,
      },
    };
  }

  _broadcast(type, payload) {
    try {
      this.callbacks.send({ type, ...payload });
    } catch {}
    this.emit(type, payload);
  }
}

export default TaskManager;
