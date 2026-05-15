import { createMachine, assign, fromPromise } from 'xstate';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import OrgContextBuilder from '../org_core/context_builder.js';
import UserContextBuilder from '../user_env/context_builder.js';
import semanticGraphBuilder from '../memory/loader.js';
import llmClient from './llm_client.js';
import { vfs } from '../vfs/container.js';
import { SandboxExecutor } from '../sandbox/docker_executor.js';

const SANDBOX_TIMEOUT_MS = Number.parseInt(process.env.SELINA_SANDBOX_TIMEOUT_MS || '10000', 10);
export const EFFORT_RETRY_LIMITS = Object.freeze({
  quick: 0,
  standard: 3,
  deep: 5,
});

export function normalizeEffortLevel(effortLevel = 'standard') {
  return Object.prototype.hasOwnProperty.call(EFFORT_RETRY_LIMITS, effortLevel)
    ? effortLevel
    : 'standard';
}

export function retryLimitForEffort(effortLevel = 'standard') {
  return EFFORT_RETRY_LIMITS[normalizeEffortLevel(effortLevel)];
}

function chooseCandidateFilename(targetFile) {
  const ext = path.extname(targetFile || '').toLowerCase();
  if (['.js', '.mjs', '.cjs'].includes(ext)) return `candidate${ext}`;
  return 'candidate.js';
}

async function executeGeneratedCodeInLocalDocker(input) {
  if (!input.generatedCode || typeof input.generatedCode !== 'string') {
    return { success: false, error_trace: 'No generated code was produced for sandbox execution.' };
  }

  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), `selina-xstate-${crypto.randomUUID()}-`));
  const scriptPath = chooseCandidateFilename(input.targetFile);
  const testScriptPath = 'candidate.test.js';

  try {
    await fs.writeFile(path.join(workspacePath, scriptPath), input.generatedCode, 'utf-8');

    // Write generated tests if available
    if (input.generatedTests && input.generatedTests.trim().length > 0) {
      await fs.writeFile(path.join(workspacePath, testScriptPath), input.generatedTests, 'utf-8');
    }

    const result = await SandboxExecutor.executeLocalDockerSandbox({
      workspacePath,
      scriptPath,
      runtime: 'node',
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    let testOutput = '';
    if (result.success && input.generatedTests && input.generatedTests.trim().length > 0) {
      const testResult = await SandboxExecutor.executeLocalDockerCommand({
        workspacePath,
        command: 'node',
        args: ['--test', testScriptPath],
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });
      testOutput = testResult.stdout + '\n' + testResult.stderr;
      if (!testResult.success) {
        return {
          success: false,
          error_trace: `Test execution failed:\n${testOutput}`,
          sandbox: testResult.sandbox,
        };
      }
    }

    if (result.success) {
      return { success: true, sandbox: result.sandbox, stdout: result.stdout, testOutput };
    }

    return {
      success: false,
      error_trace: result.error || result.stderr || result.stdout || `Sandbox exited with code ${result.exitCode}`,
      sandbox: result.sandbox,
    };
  } finally {
    await fs.rm(workspacePath, { recursive: true, force: true });
  }
}

const agentMachine = createMachine({
  id: 'SaaSCodingAgent',
  initial: 'idle',
  context: {
    userId: null,
    taskPrompt: null,
    retries: 0,
    maxRetries: 3,
    rollbacks: 0,
    maxRollbacks: 1,
    effortLevel: 'standard',
    crossFileCoherenceEnabled: false,
    orgContext: null,
    userContext: null,
    astGraph: null,
    generatedCode: null,
    sandboxError: null,
    targetFile: null,
    originalCode: '',
    requestId: null,
    stagedFile: null,
    generatedTests: null,
    testOutput: null
  },
  states: {
    idle: {
      on: { 
        START_TASK: {
          target: 'loading_contexts',
          actions: assign({
            userId: ({ event }) => event.userId,
            taskPrompt: ({ event }) => event.prompt,
            targetFile: ({ event }) => event.targetFile,
            originalCode: ({ event }) => event.originalCode || '',
            requestId: ({ event }) => event.requestId || null,
            retries: () => 0,
            maxRetries: ({ event }) => retryLimitForEffort(event.effortLevel),
            rollbacks: () => 0,
            maxRollbacks: ({ event }) => normalizeEffortLevel(event.effortLevel) === 'quick' ? 0 : 1,
            effortLevel: ({ event }) => normalizeEffortLevel(event.effortLevel),
            crossFileCoherenceEnabled: ({ event }) => normalizeEffortLevel(event.effortLevel) === 'deep',
            sandboxError: () => null,
            stagedFile: () => null
          })
        }
      }
    },
    
    loading_contexts: {
      invoke: {
        input: ({ context }) => context,
        src: fromPromise(async ({ input }) => {
          const org = await OrgContextBuilder.buildGlobalConstraints();
          const user = await UserContextBuilder.buildUserPreferences(input.userId);
          return { org, user };
        }),
        onDone: {
          target: 'parsing_ast',
          actions: assign({
            orgContext: ({ event }) => event.output.org,
            userContext: ({ event }) => event.output.user
          })
        },
        onError: {
          target: 'fatal_failure',
          actions: assign({
            sandboxError: ({ event }) => event.error?.message || String(event.error)
          })
        }
      }
    },

    parsing_ast: {
      invoke: {
        input: ({ context }) => context,
        src: fromPromise(async ({ input }) => {
          if (!input.targetFile) {
            return { parsed: false, error: 'No target file specified' };
          }
          return await semanticGraphBuilder.buildSemanticGraph(input.targetFile);
        }),
        onDone: {
          target: 'drafting_code',
          actions: assign({ astGraph: ({ event }) => event.output })
        },
        onError: {
          target: 'fatal_failure',
          actions: assign({
            sandboxError: ({ event }) => event.error?.message || String(event.error)
          })
        }
      }
    },

    drafting_code: {
      invoke: {
        // Execute the live API call using the current machine context
        input: ({ context }) => context,
        src: fromPromise(async ({ input }) => {
          return await llmClient.generateCode(
            input.orgContext,
            input.userContext,
            input.taskPrompt,
            input.astGraph,
            input.sandboxError // Will be null on first pass, populated on rollbacks
          );
        }),
        onDone: {
          target: 'generating_tests',
          actions: assign({ generatedCode: ({ event }) => event.output })
        },
        onError: {
          target: 'fatal_failure',
          // Log the error. If the API fails, the machine halts.
          actions: assign({
            sandboxError: ({ event }) => event.error?.message || String(event.error)
          })
        }
      }
    },


    generating_tests: {
      invoke: {
        input: ({ context }) => context,
        src: fromPromise(async ({ input }) => {
          const testPrompt = `Generate a comprehensive test suite for the following code using Node.js native 'node:test' and 'node:assert'. No markdown, ONLY valid JS code.

` + input.generatedCode;
          return await llmClient.generateCode(
            input.orgContext,
            input.userContext,
            testPrompt,
            { file: 'test_candidate.js', strict_imports: [], strict_exports: [], internal_functions: [] },
            null
          );
        }),
        onDone: {
          target: 'sandboxing',
          actions: assign({ generatedTests: ({ event }) => event.output })
        },
        onError: {
          target: 'sandboxing',
          actions: assign({ generatedTests: () => '// Test generation failed' })
        }
      }
    },

    sandboxing: {
      invoke: {
        input: ({ context }) => context,
        src: fromPromise(async ({ input }) => executeGeneratedCodeInLocalDocker(input)),
        onDone: [
          {
            target: 'success',
            guard: ({ event }) => event.output.success === true,
            actions: assign({ testOutput: ({ event }) => event.output.testOutput })
          },
          {
            target: 'evaluating_failure',
            actions: assign({ sandboxError: ({ event }) => event.output.error_trace })
          }
        ],
        onError: {
          target: 'evaluating_failure',
          actions: assign({
            sandboxError: ({ event }) => event.error?.message || String(event.error)
          })
        }
      }
    },

    evaluating_failure: {
      always: [
        {
          target: 'fatal_failure',
          guard: ({ context }) => context.retries >= context.maxRetries && context.rollbacks >= context.maxRollbacks
        },
        {
          target: 'rollback',
          guard: ({ context }) => context.retries >= context.maxRetries
        },
        {
          target: 'drafting_code',
          actions: assign({ retries: ({ context }) => context.retries + 1 })
        }
      ]
    },

    rollback: {
      entry: assign({
        retries: 0,
        rollbacks: ({ context }) => context.rollbacks + 1,
        taskPrompt: ({ context }) => `${context.taskPrompt}\n\nSYSTEM OVERRIDE: Your previous architectural approach failed completely with error: ${context.sandboxError}. Do NOT retry the same logic. Pivot to a completely different design pattern.` 
      }),
      always: 'drafting_code'
    },

    success: {
      type: 'final',
      entry: assign({
        // Stage the verified code in VFS for user approval
        stagedFile: ({ context }) => {
          const entry = vfs.stageFile(
            context.targetFile,
            context.originalCode || '', // Original content loaded by the router
            context.generatedCode,
            {
              agentVersion: 'v6',
              retries: context.retries,
              sandboxVerified: true,
              userId: context.userId,
              requestId: context.requestId,
              effortLevel: context.effortLevel,
              crossFileCoherenceEnabled: context.crossFileCoherenceEnabled,
              testOutput: context.testOutput
            }
          );
          return entry;
        }
      })
    },
    fatal_failure: { type: 'final' }
  }
});

export default agentMachine;
