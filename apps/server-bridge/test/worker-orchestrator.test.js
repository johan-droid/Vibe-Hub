import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadArchitect, normalizePhasedPlan } from '../orchestrator/agents/lead-architect.js';
import { buildMergeSynthesisPrompt } from '../orchestrator/agents/merge-master.js';
import { TokenGovernor } from '../orchestrator/token-governor.js';
import { WorkerOrchestrator } from '../orchestrator/worker-orchestrator.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LeadArchitect sync-node planning', () => {
  it('routes planner work through TokenGovernor.getCompute and normalizes LLM output', async () => {
    const getCompute = vi.spyOn(TokenGovernor.prototype, 'getCompute').mockResolvedValue(JSON.stringify({
      contract_schema: { guessed: true },
      phases: [
        { name: 'parallel', tasks: [{ type: 'UI', description: 'user table' }] },
        { name: 'sync', tasks: [{ type: 'DB', description: 'users schema' }] },
      ],
    }));

    const plan = await new LeadArchitect().buildParallelMatrix('Add a user table');

    expect(getCompute).toHaveBeenCalledWith('high', 'planner', expect.any(Function));
    expect(plan.contract_schema).toBeUndefined();
    expect(plan.phases[0].tasks).toEqual([{ type: 'DB', description: 'users schema' }]);
    expect(plan.phases[1].tasks[0]).toMatchObject({
      type: 'UI',
      groundTruth: 'actual-sync-output',
      dependsOn: ['sync:DB'],
    });
  });

  it('normalizes plans so DB sync work precedes API/UI workers without a guessed contract schema', () => {
    const plan = normalizePhasedPlan({
      contract_schema: { hallucinated: true },
      phases: [
        { name: 'parallel', tasks: [{ type: 'UI', description: 'screen' }, { type: 'API', description: 'route' }] },
        { name: 'sync', tasks: [{ type: 'DB', description: 'schema' }] },
      ],
    });

    expect(plan.contract_schema).toBeUndefined();
    expect(plan.phases[0]).toMatchObject({ name: 'sync' });
    expect(plan.phases[0].tasks[0]).toMatchObject({ type: 'DB' });
    expect(plan.phases[1].tasks.map(task => task.type)).toEqual(['API', 'UI']);
    expect(plan.phases[1].tasks.every(task => task.groundTruth === 'actual-sync-output')).toBe(true);
  });
});

describe('WorkerOrchestrator sync node execution', () => {
  it('connects LeadArchitect output to phased execution for feature requests', async () => {
    const architect = {
      buildParallelMatrix: vi.fn(async () => ({
        phases: [
          { name: 'sync', tasks: [{ type: 'DB', description: 'schema' }] },
          { name: 'parallel', tasks: [{ type: 'API', description: 'route' }] },
        ],
      })),
    };
    const executionOrder = [];

    const result = await WorkerOrchestrator.runArchitectedFeature('Add users', {
      architect,
      executeTask: async (task) => {
        executionOrder.push(task.type);
        return task.type === 'DB'
          ? { modelOutput: JSON.stringify({ generatedTypes: { User: { id: 'string' } } }) }
          : { modelOutput: '{}' };
      },
    });

    expect(architect.buildParallelMatrix).toHaveBeenCalledWith('Add users');
    expect(executionOrder).toEqual(['DB', 'API']);
    expect(result.groundTruth.generatedTypes.User.id).toBe('string');
  });

  it('runs sync DB output first and passes actual generated types/AST to parallel workers', async () => {
    const calls = [];
    const plan = {
      phases: [
        { name: 'sync', tasks: [{ type: 'DB', description: 'create users table' }] },
        { name: 'parallel', tasks: [{ type: 'API', description: 'users route' }, { type: 'UI', description: 'users screen' }] },
      ],
    };

    await WorkerOrchestrator.runPhasedExecution(plan, {
      executeTask: async (task, groundTruth) => {
        calls.push({ task, groundTruth: structuredClone(groundTruth) });
        if (task.type === 'DB') {
          return {
            modelOutput: JSON.stringify({
              generatedTypes: { User: { id: 'string', displayName: 'string' } },
              ast: { tables: ['users'] },
              exports: ['User'],
            }),
          };
        }
        return { modelOutput: '{}' };
      },
    });

    expect(calls[0].task.type).toBe('DB');
    expect(calls[1].groundTruth.generatedTypes.User.displayName).toBe('string');
    expect(calls[2].groundTruth.ast.tables).toEqual(['users']);
    expect(calls[1].groundTruth.syncOutputs).toHaveLength(1);
  });
});

describe('Merge synthesis ground truth', () => {
  it('uses sync-node ground truth instead of a hallucinated contract schema', () => {
    const { systemPrompt, prompt } = buildMergeSynthesisPrompt(
      [{ file: 'api/users.ts' }],
      { generatedTypes: { User: { displayName: 'string' } }, ast: { tables: ['users'] } },
    );

    expect(systemPrompt).toContain('Ground Truth Context');
    expect(prompt).toContain('"generatedTypes"');
    expect(`${systemPrompt}\n${prompt}`).not.toContain('Contract Schema');
  });
});
