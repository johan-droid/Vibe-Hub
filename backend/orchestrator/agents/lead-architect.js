import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export class LeadArchitect {
  async buildParallelMatrix(featureRequest) {
    const governor = new TokenGovernor();
    const systemPrompt = `You are the Lead Architect. Break this feature into a phased execution plan.
PHASE 1 (Sync Node): Database schema changes and shared type definitions.
PHASE 2 (Parallel): API and UI implementation.

Phase 2 workers will consume the ACTUAL output (Ground Truth) of Phase 1. 
Do NOT hallucinate a 'contract_schema'.

Output strict JSON in this format:
{
  "phases": [
    { "name": "sync", "tasks": [{ "type": "DB", "description": "..." }] },
    { "name": "parallel", "tasks": [{ "type": "API", "description": "..." }, { "type": "UI", "description": "..." }] }
  ]
}`;
    try {
      const plannerOutput = await governor.getCompute('high', 'planner', (key, model, provider) => (
        callRoutedTextModel(key, model, systemPrompt, featureRequest, { provider, maxOutputTokens: 2048, jsonMode: true })
      ));
      return normalizePhasedPlan(JSON.parse(plannerOutput));
    } catch (err) {
      // Log the failure — silent fallback previously masked LLM errors from monitoring
      logger.error('LeadArchitect', `buildParallelMatrix failed: ${err.message}. Returning degraded 2-task plan.`);
      return normalizePhasedPlan({
        phases: [
          {
            name: 'sync',
            tasks: [{ type: 'DB', description: 'Database schema and shared types' }],
          },
          {
            name: 'parallel',
            tasks: [
              { type: 'API', description: 'API endpoints implementation' },
              { type: 'UI',  description: 'User interface implementation' },
            ],
          },
        ],
        _degraded: true,
        _degradedReason: err.message,
      });
    }
  }
}

export function normalizePhasedPlan(plan = {}) {
  const phases = Array.isArray(plan.phases) ? plan.phases : [];
  const allTasks = phases.flatMap(phase => Array.isArray(phase.tasks) ? phase.tasks : []);
  const dbTasks = allTasks.filter(task => String(task.type || '').toUpperCase() === 'DB');
  const apiTasks = allTasks.filter(task => String(task.type || '').toUpperCase() === 'API');
  const uiTasks = allTasks.filter(task => String(task.type || '').toUpperCase() === 'UI');
  const otherParallelTasks = allTasks.filter(task => !['DB', 'API', 'UI'].includes(String(task.type || '').toUpperCase()));

  const syncTasks = dbTasks.length > 0
    ? dbTasks
    : [{ type: 'DB', description: 'Database schema and shared types ground-truth sync node' }];
  const parallelTasks = [...apiTasks, ...uiTasks, ...otherParallelTasks]
    .map(task => ({
      ...task,
      dependsOn: task.dependsOn || ['sync:DB'],
      groundTruth: 'actual-sync-output',
    }));

  return {
    phases: [
      { name: 'sync', tasks: syncTasks },
      { name: 'parallel', tasks: parallelTasks },
    ],
  };
}
