/**
 * Agent State Machine — XState-based DAG Execution with Rollback
 * ================================================================
 *
 * Replaces linear task execution with a Directed Acyclic Graph (DAG)
 * where each action is a node. Failed branches trigger automatic rollback
 * to parent nodes with alternate strategy injection.
 */

import { createMachine, createActor, assign } from 'xstate';
import { v4 as uuid } from 'uuid';

// ─── DAG Node Structure ───────────────────────────────────────────────────────

export class ExecutionNode {
  constructor({ parentId = null, action, codeSnapshot = new Map() }) {
    this.id = uuid();
    this.parentId = parentId;
    this.action = action; // { name: string, args: object }
    this.result = null;
    this.verification = { passed: false, attempts: 0, maxAttempts: 3 };
    this.children = [];
    this.state = 'pending'; // pending | running | success | failed | rolledback
    this.codeSnapshot = codeSnapshot; // Map<filePath, content> - state before this action
    this.createdAt = new Date().toISOString();
    this.errorLog = [];
  }
}

// ─── Rollback System ──────────────────────────────────────────────────────────

export class RollbackSystem {
  constructor(onRestoreFiles) {
    this.nodeMap = new Map(); // id -> ExecutionNode
    this.currentBranch = []; // Stack of node IDs in current execution path
    this.onRestoreFiles = onRestoreFiles; // Callback to restore files from snapshot
  }

  registerNode(node) {
    this.nodeMap.set(node.id, node);
    if (node.parentId) {
      const parent = this.nodeMap.get(node.parentId);
      if (parent) parent.children.push(node.id);
    }
    this.currentBranch.push(node.id);
  }

  /**
   * Rollback to parent node after 3 failed verification attempts
   * Returns: { success: boolean, targetNode: ExecutionNode | null, injectPrompt: string }
   */
  async rollback(nodeId) {
    const node = this.nodeMap.get(nodeId);
    if (!node) return { success: false, targetNode: null, injectPrompt: '' };

    // Check if we've exceeded max attempts
    if (node.verification.attempts < node.verification.maxAttempts) {
      return { 
        success: false, 
        targetNode: null, 
        injectPrompt: '' 
      };
    }

    // Find parent node
    const parentId = node.parentId;
    if (!parentId) {
      // No parent - entire task failed
      node.state = 'failed';
      return { 
        success: false, 
        targetNode: null, 
        injectPrompt: 'CRITICAL: All architectural paths exhausted. Task cannot be completed with current approach.' 
      };
    }

    const parent = this.nodeMap.get(parentId);
    if (!parent) {
      return { success: false, targetNode: null, injectPrompt: '' };
    }

    // Mark current node as failed
    node.state = 'failed';

    // Restore code to parent snapshot
    if (parent.codeSnapshot && parent.codeSnapshot.size > 0) {
      await this.onRestoreFiles(parent.codeSnapshot);
    }

    // Trim current branch back to parent
    const parentIndex = this.currentBranch.indexOf(parentId);
    if (parentIndex !== -1) {
      this.currentBranch = this.currentBranch.slice(0, parentIndex + 1);
    }

    // Generate rollback prompt
    const errorSummary = node.errorLog.slice(-3).join('; ');
    const injectPrompt = `Previous architectural path failed after ${node.verification.attempts} attempts. Errors: ${errorSummary}. Try a completely different approach - consider alternative algorithms, design patterns, or implementation strategies.`;

    return {
      success: true,
      targetNode: parent,
      injectPrompt
    };
  }

  getCurrentNode() {
    if (this.currentBranch.length === 0) return null;
    return this.nodeMap.get(this.currentBranch[this.currentBranch.length - 1]);
  }

  getBranchPath() {
    return this.currentBranch.map(id => this.nodeMap.get(id)).filter(Boolean);
  }
}

// ─── XState Machine Definition ────────────────────────────────────────────────

export const createAgentMachine = (deps) => {
  const { 
    onExecuteAction, 
    onVerify, 
    onDebate, 
    onRollback,
    onComplete 
  } = deps;

  return createMachine({
    id: 'agentExecution',
    initial: 'idle',
    context: {
      currentNode: null,
      rollbackCount: 0,
      maxRollbacks: 5,
      taskPrompt: '',
      alternateStrategy: '',
      executionHistory: []
    },
    states: {
      idle: {
        on: {
          START: {
            target: 'executing',
            actions: assign({
              taskPrompt: ({ event }) => event.prompt,
              currentNode: ({ event }) => event.initialNode
            })
          }
        }
      },

      executing: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'executing']
        }),
        invoke: {
          src: async ({ context }) => {
            const node = context.currentNode;
            node.state = 'running';
            
            // Execute the action (tool call)
            const result = await onExecuteAction(node.action);
            node.result = result;
            
            return { result };
          },
          onDone: {
            target: 'verifying',
            actions: assign({
              currentNode: ({ context }) => {
                context.currentNode.state = 'success';
                return context.currentNode;
              }
            })
          },
          onError: {
            target: 'failed',
            actions: assign({
              currentNode: ({ context, event }) => {
                context.currentNode.state = 'failed';
                context.currentNode.errorLog.push(event.error.message);
                return context.currentNode;
              }
            })
          }
        }
      },

      verifying: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'verifying']
        }),
        invoke: {
          src: async ({ context }) => {
            const node = context.currentNode;
            node.verification.attempts++;
            
            // Run verification (e.g., build, test, lint)
            const verification = await onVerify(node);
            node.verification.passed = verification.passed;
            
            return verification;
          },
          onDone: [
            {
              guard: ({ event }) => event.output.passed,
              target: 'debating'
            },
            {
              guard: ({ context }) => context.currentNode.verification.attempts >= 3,
              target: 'rollback'
            },
            {
              target: 'executing',
              actions: assign({
                alternateStrategy: () => 'Verification failed. Retry with corrections.'
              })
            }
          ],
          onError: {
            target: 'failed'
          }
        }
      },

      debating: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'debating']
        }),
        invoke: {
          src: async ({ context }) => {
            // Peer review phase
            const debateResult = await onDebate(context.currentNode);
            return debateResult;
          },
          onDone: [
            {
              guard: ({ event }) => event.output.approved,
              target: 'complete'
            },
            {
              guard: ({ context }) => context.currentNode.verification.attempts >= 3,
              target: 'rollback'
            },
            {
              target: 'executing',
              actions: assign({
                alternateStrategy: ({ event }) => `Peer review rejected: ${event.output.feedback}`
              })
            }
          ]
        }
      },

      rollback: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'rollback'],
          rollbackCount: ({ context }) => context.rollbackCount + 1
        }),
        invoke: {
          src: async ({ context }) => {
            const rollbackResult = await onRollback(context.currentNode);
            return rollbackResult;
          },
          onDone: [
            {
              guard: ({ context }) => context.rollbackCount >= context.maxRollbacks,
              target: 'failed'
            },
            {
              guard: ({ event }) => event.output.success,
              target: 'executing',
              actions: assign({
                currentNode: ({ event }) => event.output.targetNode,
                alternateStrategy: ({ event }) => event.output.injectPrompt
              })
            },
            {
              target: 'failed'
            }
          ]
        }
      },

      complete: {
        entry: [
          assign({
            executionHistory: ({ context }) => [...context.executionHistory, 'complete']
          }),
          ({ context }) => onComplete(context.currentNode)
        ],
        type: 'final'
      },

      failed: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'failed']
        }),
        type: 'final'
      }
    }
  });
};

// ─── Enhanced Task Manager with State Machine ─────────────────────────────────

export class StateMachineTaskManager {
  constructor(orchestrator, callbacks) {
    this.orchestrator = orchestrator;
    this.callbacks = callbacks;
    this.rollbackSystem = new RollbackSystem(this._restoreFiles.bind(this));
    this.actor = null;
    this.fileCache = new Map(); // Current file states for snapshotting
  }

  /**
   * Capture current file state before executing an action
   */
  async _captureCodeSnapshot() {
    const snapshot = new Map();
    // Files are tracked through the onToolCall callback
    // This will be populated by intercepting read_file/write_file calls
    for (const [path, content] of this.fileCache) {
      snapshot.set(path, content);
    }
    return snapshot;
  }

  /**
   * Restore files from a snapshot during rollback
   */
  async _restoreFiles(snapshot) {
    const restored = [];
    for (const [path, content] of snapshot) {
      // Write the old content back
      await this.callbacks.onToolCall('write_file', { path, content });
      this.fileCache.set(path, content);
      restored.push(path);
    }
    return restored;
  }

  /**
   * Execute a task using the state machine
   */
  async executeTask(task) {
    // Initialize the first node
    const initialNode = new ExecutionNode({
      parentId: null,
      action: { name: 'init', args: { prompt: task.prompt } },
      codeSnapshot: await this._captureCodeSnapshot()
    });
    
    this.rollbackSystem.registerNode(initialNode);

    // Create the machine with dependencies
    const machine = createAgentMachine({
      onExecuteAction: async (action) => {
        // Track file reads/writes
        const wrappedToolCall = async (name, args) => {
          if (name === 'read_file') {
            const result = await this.callbacks.onToolCall(name, args);
            this.fileCache.set(args.path, result);
            return result;
          }
          if (name === 'write_file' || name === 'edit_file') {
            // Capture snapshot before modification
            const currentContent = this.fileCache.get(args.path);
            if (currentContent) {
              initialNode.codeSnapshot.set(args.path, currentContent);
            }
            const result = await this.callbacks.onToolCall(name, args);
            this.fileCache.set(args.path, args.content || result);
            return result;
          }
          return this.callbacks.onToolCall(name, args);
        };

        // Execute through orchestrator
        return await this.orchestrator.handlePrompt(
          `${task.prompt}\n\nAction: ${action.name}`,
          task.effortLevel,
          wrappedToolCall,
          this.callbacks.onThought,
          this.callbacks.onClarification,
          this.callbacks.onPlan,
          undefined,
          this.callbacks.emitState,
          this.callbacks.onStream
        );
      },

      onVerify: async (node) => {
        // V6: Docker sandbox verification for true isolation
        // Fallback: Run build/test via tool call
        try {
          const buildResult = await this.callbacks.onToolCall('run_command', {
            command: 'npm',
            args: ['run', 'build']
          });
          const parsed = typeof buildResult === 'string' ? JSON.parse(buildResult) : buildResult;
          return { passed: parsed.exitCode === 0, output: parsed };
        } catch (err) {
          return { passed: false, error: err.message };
        }
      },

      onDebate: async (node) => {
        // Peer review through reviewer expert
        if (this.orchestrator.experts.reviewer) {
          const reviewPrompt = `Review this action: ${JSON.stringify(node.action)}. Result: ${JSON.stringify(node.result)}. Return APPROVED or REJECTED with feedback.`;
          const review = await this.orchestrator.experts.reviewer.execute(
            reviewPrompt,
            'Reviewer',
            async () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {},
            () => {}
          );
          const approved = review.content?.includes('APPROVED');
          return { approved, feedback: review.content };
        }
        return { approved: true };
      },

      onRollback: async (node) => {
        return await this.rollbackSystem.rollback(node.id);
      },

      onComplete: (node) => {
        this.callbacks.send({ type: 'task:complete', node });
      }
    });

    // Create and start the actor
    this.actor = createActor(machine);
    
    return new Promise((resolve, reject) => {
      this.actor.subscribe({
        next: (state) => {
          if (state.status === 'done') {
            if (state.value === 'complete') {
              resolve({ success: true, node: state.context.currentNode });
            } else {
              resolve({ success: false, node: state.context.currentNode, history: state.context.executionHistory });
            }
          }
        },
        error: reject
      });

      this.actor.start();
      this.actor.send({ type: 'START', prompt: task.prompt, initialNode });
    });
  }
}

export default StateMachineTaskManager;
