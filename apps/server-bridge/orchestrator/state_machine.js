import { createMachine, assign } from 'xstate';
import OrgContextBuilder from '../org_core/context_builder.js';
import UserContextBuilder from '../user_env/context_builder.js';
import semanticGraphBuilder from '../memory/loader.js';
import SandboxExecutor from '../sandbox/docker_executor.js';
import llmClient from './llm_client.js';

const agentMachine = createMachine({
  id: 'SaaSCodingAgent',
  initial: 'idle',
  context: {
    userId: null,
    taskPrompt: null,
    retries: 0,
    maxRetries: 3,
    orgContext: null,
    userContext: null,
    astGraph: null,
    generatedCode: null,
    sandboxError: null,
    targetFile: null
  },
  states: {
    idle: {
      on: { 
        START_TASK: {
          target: 'loading_contexts',
          actions: assign({
            userId: (context, event) => event.userId,
            taskPrompt: (context, event) => event.prompt,
            targetFile: (context, event) => event.targetFile
          })
        }
      }
    },
    
    loading_contexts: {
      invoke: {
        src: async (context) => {
          const org = await OrgContextBuilder.buildGlobalConstraints();
          const user = await UserContextBuilder.buildUserPreferences(context.userId);
          return { org, user };
        },
        onDone: {
          target: 'parsing_ast',
          actions: assign({
            orgContext: (context, event) => event.data.org,
            userContext: (context, event) => event.data.user
          })
        },
        onError: 'fatal_failure'
      }
    },

    parsing_ast: {
      invoke: {
        src: async (context) => {
          if (!context.targetFile) {
            return { parsed: false, error: 'No target file specified' };
          }
          return await semanticGraphBuilder.buildSemanticGraph(context.targetFile);
        },
        onDone: {
          target: 'drafting_code',
          actions: assign({ astGraph: (context, event) => event.data })
        },
        onError: 'fatal_failure'
      }
    },

    drafting_code: {
      invoke: {
        // Execute the live API call using the current machine context
        src: async (context) => {
          return await llmClient.generateCode(
            context.orgContext,
            context.userContext,
            context.taskPrompt,
            context.astGraph,
            context.sandboxError // Will be null on first pass, populated on rollbacks
          );
        },
        onDone: {
          target: 'sandboxing',
          actions: assign({ generatedCode: (context, event) => event.data })
        },
        onError: {
          target: 'fatal_failure',
          // Log the error. If the API fails, the machine halts.
          actions: (context, event) => console.error("API Failure:", event.data)
        }
      }
    },

    sandboxing: {
      invoke: {
        src: async (context) => {
          return await SandboxExecutor.executeLocalDockerSandbox(context.generatedCode);
        },
        onDone: [
          {
            target: 'success',
            cond: (context, event) => event.data.success === true
          },
          {
            target: 'evaluating_failure',
            actions: assign({ sandboxError: (context, event) => event.data.error_trace })
          }
        ],
        onError: 'evaluating_failure'
      }
    },

    evaluating_failure: {
      always: [
        {
          target: 'rollback',
          cond: (context) => context.retries >= context.maxRetries
        },
        {
          target: 'drafting_code',
          actions: assign({ retries: (context) => context.retries + 1 })
        }
      ]
    },

    rollback: {
      entry: assign({
        retries: 0,
        taskPrompt: (context) => `${context.taskPrompt}\n\nSYSTEM OVERRIDE: Your previous architectural approach failed completely with error: ${context.sandboxError}. Do NOT retry the same logic. Pivot to a completely different design pattern.` 
      }),
      always: 'drafting_code'
    },

    success: { type: 'final' },
    fatal_failure: { type: 'final' }
  }
});

export default agentMachine;
