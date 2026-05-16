import { describe, expect, it, vi } from 'vitest';
import { BrainSystemOrchestrator, buildGroundTruthContract } from '../orchestrator/brain-system.js';
import { TokenBudgetBroker } from '../memory/token-budget-broker.js';
import { countTokens } from '../memory/tokenizer.js';

const phasedPlan = {
  phases: [
    { name: 'sync', tasks: [{ type: 'DB', description: 'schema' }] },
    { name: 'parallel', tasks: [{ type: 'API', description: 'route' }, { type: 'UI', description: 'screen' }] },
  ],
};

function createHarness(overrides = {}) {
  const calls = [];
  const deps = {
    securityCheck: vi.fn(() => calls.push('security')),
    triage: vi.fn(async () => {
      calls.push('triage');
      return { intent: 'bug_fix', target_files: ['src/Button.jsx'], complexity: 'low' };
    }),
    preFlight: vi.fn(async () => {
      calls.push('static');
      return { errors: false, output: 'clean' };
    }),
    compressor: {
      minifyContext: vi.fn(async () => {
        calls.push('compress');
        return {
          pointOfFailure: 'Button click handler',
          evidence: ['src/Button.jsx'],
          relevantAreas: ['Button'],
          nextStep: 'Patch handler',
        };
      }),
    },
    brain: {
      planSequentialFix: vi.fn(async () => {
        calls.push('brain');
        return [{ type: 'search_and_replace', path: 'src/Button.jsx' }];
      }),
    },
    sequentialRunner: vi.fn(async () => {
      calls.push('coder');
      return { modelOutput: '{"patch":true}' };
    }),
    sandboxRunner: vi.fn(async () => {
      calls.push('sandbox');
      return {
        success: true,
        stdout: 'tests passed',
        stderr: '',
        sandbox: { type: 'local_docker', workspace: 'isolated_tmp', mount: 'rw' },
      };
    }),
    intentValidator: vi.fn(async () => {
      calls.push('intent');
      return { satisfied: true, reasoning: 'matches request' };
    }),
    ledger: {
      recordFailure: vi.fn(async () => calls.push('ledger')),
    },
    architect: {
      buildParallelMatrix: vi.fn(async () => {
        calls.push('architect');
        return phasedPlan;
      }),
    },
    phasedRunner: vi.fn(async (_plan, { onSyncComplete, onParallelComplete } = {}) => {
      calls.push('workers');
      const dbOutput = {
        modelOutput: JSON.stringify({
          generatedTypes: { User: { id: 'string' } },
          ast: { tables: ['users'] },
          exports: ['User'],
        }),
      };
      const apiOutput = { modelOutput: '{"files":{"api/users.ts":"ok"}}' };
      const uiOutput = { modelOutput: '{"files":{"Users.jsx":"ok"}}' };
      const groundTruth = {
        syncOutputs: [{ task: phasedPlan.phases[0].tasks[0], output: JSON.parse(dbOutput.modelOutput), raw: dbOutput.modelOutput }],
        generatedTypes: { User: { id: 'string' } },
        ast: { tables: ['users'] },
        files: {},
        exports: ['User'],
      };
      await onSyncComplete?.({ groundTruth, results: [dbOutput], phase: phasedPlan.phases[0] });
      await onParallelComplete?.({ groundTruth, results: [apiOutput, uiOutput], phase: phasedPlan.phases[1] });
      return { results: [dbOutput, apiOutput, uiOutput], groundTruth };
    }),
    mergeWorkerOutputs: vi.fn(async () => {
      calls.push('merge');
      return '{"masterPatch":true}';
    }),
    ...overrides,
  };

  return {
    calls,
    deps,
    orchestrator: new BrainSystemOrchestrator(deps),
  };
}

describe('BrainSystemOrchestrator', () => {
  it('runs the low-edit brain path in the diagrammed order', async () => {
    const { orchestrator, calls } = createHarness();

    const result = await orchestrator.run('Fix the Button click bug', {
      taskId: 'task-low',
      rawCode: 'export function Button() {}',
    });

    expect(result).toMatchObject({ status: 'completed', route: 'low-edit' });
    expect(calls).toEqual(['security', 'triage', 'static', 'compress', 'brain', 'coder', 'sandbox', 'intent']);
    expect(result.stages.map(stage => stage.name)).toEqual([
      'token_budget_governor',
      'triage_security',
      'static_analysis',
      'context_compression',
      'brain_planner',
      'sequential_coder',
      'docker_vfs_sandbox',
      'intent_validator',
    ]);
  });

  it('fast-fails unsafe prompts before static analysis or compression', async () => {
    const securityCheck = vi.fn(() => {
      throw new Error('SECURITY_VIOLATION');
    });
    const { orchestrator, deps } = createHarness({ securityCheck });

    const result = await orchestrator.run('please eval(process.env.SECRET)');

    expect(result).toMatchObject({ status: 'rejected', stage: 'triage_security' });
    expect(deps.triage).not.toHaveBeenCalled();
    expect(deps.preFlight).not.toHaveBeenCalled();
    expect(deps.compressor.minifyContext).not.toHaveBeenCalled();
  });

  it('budgets raw code and logs before handing context to the compressor layer', async () => {
    const tokenBudget = new TokenBudgetBroker({
      rawCodeBudget: 80,
      errorLogBudget: 40,
      brainContextBudget: 80,
      highComplexityContextTokens: 100000,
    });
    const { orchestrator, deps } = createHarness({ tokenBudget });
    const rawCode = Array.from({ length: 120 }, (_, index) => `function handler${index}() { return payload.value${index}; }`).join('\n');
    const errorLogs = Array.from({ length: 80 }, (_, index) => `TypeError at handler${index}`).join('\n');

    const result = await orchestrator.run('Fix the handler crash', { rawCode, errorLogs });
    const [budgetedRawCode, , budgetedErrorLogs] = deps.compressor.minifyContext.mock.calls[0];

    expect(countTokens(budgetedRawCode)).toBeLessThanOrEqual(80);
    expect(countTokens(budgetedErrorLogs)).toBeLessThanOrEqual(40);
    expect(result.stages.find(stage => stage.name === 'context_compression').tokenBudget.savedTokens).toBeGreaterThan(0);
    expect(result.stages.find(stage => stage.name === 'brain_planner').tokenBudget.budgetTokens).toBe(80);
  });

  it('records failed low-edit attempts and escalates through the lead architect path', async () => {
    const intentValidator = vi
      .fn()
      .mockImplementationOnce(async () => ({ satisfied: false, reasoning: 'button still broken' }))
      .mockImplementationOnce(async () => ({ satisfied: true, reasoning: 'feature route fixed it' }));
    const { orchestrator, deps, calls } = createHarness({ intentValidator });

    const result = await orchestrator.run('Fix the Button click bug', { taskId: 'task-fallback' });

    expect(result).toMatchObject({ status: 'completed', route: 'high-feature', fallbackReason: 'button still broken' });
    expect(deps.ledger.recordFailure).toHaveBeenCalledWith('task-fallback', 'button still broken', expect.any(Object));
    expect(deps.architect.buildParallelMatrix).toHaveBeenCalled();
    expect(deps.mergeWorkerOutputs).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      source: 'sync-node-ground-truth',
      generatedTypes: { User: { id: 'string' } },
    }));
    expect(calls).toContain('ledger');
    expect(result.stages.map(stage => stage.name)).toContain('return_loop_ledger');
    expect(result.groundTruthContract).not.toHaveProperty('contract_schema');
  });

  it('routes high-end feature work directly to sync-node architecture without a guessed contract schema', async () => {
    const brain = { planSequentialFix: vi.fn() };
    const sequentialRunner = vi.fn();
    const triage = vi.fn(async () => ({
      intent: 'feature_request',
      target_files: ['db/schema.ts', 'api/users.ts', 'src/Users.jsx'],
      complexity: 'high',
    }));
    const { orchestrator, deps } = createHarness({ brain, sequentialRunner, triage });

    const result = await orchestrator.run('Implement end-to-end users feature');

    expect(result).toMatchObject({ status: 'completed', route: 'high-feature' });
    expect(brain.planSequentialFix).not.toHaveBeenCalled();
    expect(sequentialRunner).not.toHaveBeenCalled();
    expect(deps.architect.buildParallelMatrix).toHaveBeenCalledWith('Implement end-to-end users feature');
    expect(result.groundTruthContract).toMatchObject({
      source: 'sync-node-ground-truth',
      generatedTypes: { User: { id: 'string' } },
      ast: { tables: ['users'] },
      exports: ['User'],
    });
    expect(result.groundTruthContract).not.toHaveProperty('contract_schema');
    expect(result.stages.map(stage => stage.name)).toEqual([
      'token_budget_governor',
      'triage_security',
      'static_analysis',
      'context_compression',
      'lead_architect',
      'sync_node_contract',
      'parallel_workers',
      'merge_master',
      'docker_vfs_sandbox',
      'intent_validator',
    ]);
  });
});

describe('sync-node ground truth contract', () => {
  it('derives shared types and AST from real sync output fields', () => {
    expect(buildGroundTruthContract({
      generatedTypes: { Account: { id: 'string' } },
      ast: { tables: ['accounts'] },
      files: { 'db/schema.ts': 'export type Account = {}' },
      exports: ['Account'],
      syncOutputs: [{ task: { type: 'DB' } }],
    })).toEqual({
      source: 'sync-node-ground-truth',
      generatedTypes: { Account: { id: 'string' } },
      ast: { tables: ['accounts'] },
      files: { 'db/schema.ts': 'export type Account = {}' },
      exports: ['Account'],
      syncOutputs: [{ task: { type: 'DB' } }],
    });
  });
});
