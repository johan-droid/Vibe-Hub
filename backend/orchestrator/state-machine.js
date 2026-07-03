/**
 * Agent State Machine — XState-based DAG Execution with Rollback
 * ================================================================
 *
 * Replaces linear task execution with a Directed Acyclic Graph (DAG)
 * where each action is a node. Failed branches trigger automatic rollback
 * to parent nodes with alternate strategy injection.
 */

import { createMachine, createActor, assign, fromPromise } from 'xstate';
import { v4 as uuid } from 'uuid';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';

const execFileAsync = promisify(execFile);
const CHECKPOINT_REF_PREFIX = 'refs/selina/checkpoints';

// ─── DAG Node Structure ───────────────────────────────────────────────────────

export class ExecutionNode {
  constructor({ parentId = null, action, checkpointRef = null, checkpointCommit = null }) {
    this.id = uuid();
    this.parentId = parentId;
    this.action = action; // { name: string, args: object }
    this.result = null;
    this.verification = { passed: false, attempts: 0, maxAttempts: 3 };
    this.children = [];
    this.state = 'pending'; // pending | running | success | failed | rolledback
    this.checkpointRef = checkpointRef;
    this.checkpointCommit = checkpointCommit;
    this.createdAt = new Date().toISOString();
    this.errorLog = [];
  }
}

// ─── Git Checkpoint Store ─────────────────────────────────────────────────────

export class GitCheckpointStore {
  constructor({ workDir = process.env.SELINA_GIT_WORKTREE || process.cwd(), gitBin = 'git' } = {}) {
    this.workDir = path.resolve(workDir);
    this.gitBin = gitBin;
  }

  async _git(args, options = {}) {
    const { stdout } = await execFileAsync(this.gitBin, args, {
      cwd: this.workDir,
      timeout: options.timeout || 30_000,
      env: {
        ...sanitizeEnvironment(process.env, { inherit: 'core' }),
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Selina Checkpoint',
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'selina-checkpoint@local',
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Selina Checkpoint',
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'selina-checkpoint@local',
        ...(options.env || {}),
      },
      maxBuffer: 10 * 1024 * 1024,
    });
    return String(stdout || '').trim();
  }

  async _repoRoot() {
    return this._git(['rev-parse', '--show-toplevel']);
  }

  async createCheckpoint(nodeId) {
    await this._repoRoot();
    const ref = `${CHECKPOINT_REF_PREFIX}/${nodeId}`;
    const tempIndex = path.join(os.tmpdir(), `selina-git-index-${nodeId}-${uuid()}`);

    try {
      const env = { GIT_INDEX_FILE: tempIndex };
      await this._git(['read-tree', 'HEAD'], { env }).catch(() => null);
      await this._git(['add', '-A', '--', '.'], { env });
      const tree = await this._git(['write-tree'], { env });
      const head = await this._git(['rev-parse', '--verify', 'HEAD']).catch(() => '');
      const commitArgs = ['commit-tree', tree, '-m', `selina-node-${nodeId}`];
      if (head) commitArgs.splice(2, 0, '-p', head);
      const commit = await this._git(commitArgs, { env });
      await this._git(['update-ref', ref, commit]);
      return { ref, commit };
    } finally {
      await fs.rm(tempIndex, { force: true }).catch(() => null);
    }
  }

  async restoreCheckpoint(ref) {
    if (!ref || !String(ref).startsWith(`${CHECKPOINT_REF_PREFIX}/`)) {
      throw new Error('Refusing to restore an unscoped Selina checkpoint ref.');
    }
    await this._git(['reset', '--hard', ref], { timeout: 60_000 });
    return { restored: true, ref };
  }
}

// ─── Rollback System ──────────────────────────────────────────────────────────

export class RollbackSystem {
  constructor(onRestoreCheckpoint) {
    this.nodeMap = new Map(); // id -> ExecutionNode
    this.currentBranch = []; // Stack of node IDs in current execution path
    this.onRestoreCheckpoint = onRestoreCheckpoint; // Callback to restore Git checkpoint refs
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

    // Restore code to parent Git checkpoint without keeping file contents in JS memory.
    if (parent.checkpointRef) {
      await this.onRestoreCheckpoint(parent.checkpointRef);
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
    onMerge,
    onSecurityAudit,
    onApplyAndExecute,
    onIntentValidation,
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
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const node = input.currentNode;
            node.state = 'running';
            
            // Execute the action (tool call)
            const result = await onExecuteAction(node.action);
            node.result = result;
            
            return { result };
          }),
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
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const node = input.currentNode;
            node.verification.attempts++;
            
            // Run verification (e.g., build, test, lint)
            const verification = await onVerify(node);
            node.verification.passed = verification.passed;
            
            return verification;
          }),
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
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            // Peer review phase
            const debateResult = await onDebate(input.currentNode);
            return debateResult;
          }),
          onDone: [
            {
              guard: ({ event }) => event.output.approved,
              target: 'merging'
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
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const rollbackResult = await onRollback(input.currentNode);
            return rollbackResult;
          }),
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



      merging: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'merging']
        }),
        invoke: {
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const result = await onMerge(input.currentNode);
            return result;
          }),
          onDone: {
            target: 'securityAuditing',
            actions: assign({
              currentNode: ({ context, event }) => {
                context.currentNode.masterPatch = event.output;
                return context.currentNode;
              }
            })
          },
          onError: {
            target: 'failed'
          }
        }
      },

      securityAuditing: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'securityAuditing']
        }),
        invoke: {
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const result = await onSecurityAudit(input.currentNode);
            if (result !== 'CLEARED') {
                throw new Error("Security audit failed: " + result);
            }
            return result;
          }),
          onDone: {
            target: 'executingSandbox'
          },
          onError: {
            target: 'failed',
            actions: assign({
               currentNode: ({ context, event }) => {
                 context.currentNode.errorLog.push(event.error.message);
                 return context.currentNode;
               }
            })
          }
        }
      },

      executingSandbox: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'executingSandbox']
        }),
        invoke: {
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const result = await onApplyAndExecute(input.currentNode);
            return result;
          }),
          onDone: {
            target: 'intentValidating',
            actions: assign({
              currentNode: ({ context, event }) => {
                context.currentNode.sandboxLogs = event.output.logs;
                return context.currentNode;
              }
            })
          },
          onError: {
            target: 'failed',
            actions: assign({
               currentNode: ({ context, event }) => {
                 context.currentNode.errorLog.push(event.error.message);
                 return context.currentNode;
               }
            })
          }
        }
      },

      intentValidating: {
        entry: assign({
          executionHistory: ({ context }) => [...context.executionHistory, 'intentValidating']
        }),
        invoke: {
          input: ({ context }) => context,
          src: fromPromise(async ({ input }) => {
            const result = await onIntentValidation(input.currentNode);
            if (!result.satisfied) {
                throw new Error("Intent validation failed: " + result.reasoning);
            }
            return result;
          }),
          onDone: {
            target: 'complete'
          },
          onError: {
            target: 'rollback',
            actions: assign({
                alternateStrategy: ({ event }) => "Intent validation failed: " + event.error.message
            })
          }
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
    this.gitCheckpoints = new GitCheckpointStore({ workDir: callbacks?.workspacePath || process.cwd() });
    this.rollbackSystem = new RollbackSystem(this._restoreCheckpoint.bind(this));
    this.actor = null;
  }

  /**
   * Capture the current worktree state in Git before executing an action.
   * Stores only a ref/commit id on the node; file contents live in Git objects.
   */
  async _checkpointNode(node) {
    if (!node || node.checkpointRef) return node;
    const checkpoint = await this.gitCheckpoints.createCheckpoint(node.id);
    node.checkpointRef = checkpoint.ref;
    node.checkpointCommit = checkpoint.commit;
    return node;
  }

  /**
   * Restore files from a Git checkpoint during rollback
   */
  async _restoreCheckpoint(checkpointRef) {
    return this.gitCheckpoints.restoreCheckpoint(checkpointRef);
  }

  _isMutationTool(name) {
    return ['write_file', 'edit_file', 'create_file', 'patch_file', 'replace_file_content', 'multi_replace_file_content'].includes(name);
  }

  /**
   * Execute a task using the state machine
   */
  async executeTask(task) {
    // Initialize the first node
    const initialNode = new ExecutionNode({
      parentId: null,
      action: { name: 'init', args: { prompt: task.prompt } }
    });
    await this._checkpointNode(initialNode);
    
    this.rollbackSystem.registerNode(initialNode);

    // Create the machine with dependencies
    const machine = createAgentMachine({
      onExecuteAction: async (action) => {
        // Track file reads/writes
        const wrappedToolCall = async (name, args) => {
          if (this._isMutationTool(name)) {
            await this._checkpointNode(input.currentNode || initialNode);
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
