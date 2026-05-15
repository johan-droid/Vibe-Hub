import { executeSequentialTask } from './agents/sequential-coder.js';
import { executeParallelSubTask } from './agents/parallel-worker.js';
import { LeadArchitect } from './agents/lead-architect.js';

export class WorkerOrchestrator {
    static async runSequential(plan, targetFiles) {
        return await executeSequentialTask(plan, targetFiles);
    }

    static async runArchitectedFeature(featureRequest, {
        architect = new LeadArchitect(),
        executeTask = executeParallelSubTask,
        returnGroundTruth = true,
    } = {}) {
        const phasedPlan = await architect.buildParallelMatrix(featureRequest);
        return await this.runPhasedExecution(phasedPlan, { executeTask, returnGroundTruth });
    }

    /**
     * Phased Execution (Sync Node Pattern)
     * Phase 1 (Sync): Sequential execution to establish ground truth
     * Phase 2 (Parallel): Parallel execution consuming Phase 1 output
     */
    static async runPhasedExecution(phasedPlan, { executeTask = executeParallelSubTask, returnGroundTruth = false } = {}) {
        const results = [];
        const groundTruth = {
            syncOutputs: [],
            generatedTypes: {},
            ast: {},
            files: {},
            exports: [],
        };

        const phases = Array.isArray(phasedPlan?.phases) ? phasedPlan.phases : [];

        for (const phase of phases) {
            const tasks = Array.isArray(phase.tasks) ? phase.tasks : [];
            if (phase.name === 'sync') {
                // SYNC NODE: Establish ground truth sequentially
                for (const task of tasks) {
                    const res = await executeTask(task, groundTruth);
                    results.push(res);
                    const parsed = parseWorkerOutput(res.modelOutput);
                    groundTruth.syncOutputs.push({ task, output: parsed, raw: res.modelOutput });
                    mergeGroundTruth(groundTruth, parsed);
                }
            } else {
                // PARALLEL BATCH: Consume established ground truth
                const batchPromises = tasks.map(task => executeTask(task, groundTruth));
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            }
        }

        return returnGroundTruth ? { results, groundTruth } : results;
    }

    // Legacy parallel support
    static async runParallel(subTasks, _contractSchema) {
        return await this.runPhasedExecution({
            phases: [
                { name: 'sync', tasks: [] },
                { name: 'parallel', tasks: subTasks.map(task => ({ ...task, groundTruth: 'actual-sync-output' })) }
            ]
        });
    }
}

function parseWorkerOutput(modelOutput) {
    if (!modelOutput) return {};
    if (typeof modelOutput === 'object') return modelOutput;
    try {
        return JSON.parse(modelOutput);
    } catch {
        console.warn('[Orchestrator] Failed to parse worker output for ground truth context');
        return {};
    }
}

function mergeGroundTruth(groundTruth, parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.generatedTypes && typeof parsed.generatedTypes === 'object') {
        Object.assign(groundTruth.generatedTypes, parsed.generatedTypes);
    }
    if (parsed.types && typeof parsed.types === 'object') {
        Object.assign(groundTruth.generatedTypes, parsed.types);
    }
    if (parsed.ast && typeof parsed.ast === 'object') {
        Object.assign(groundTruth.ast, parsed.ast);
    }
    if (parsed.files && typeof parsed.files === 'object') {
        Object.assign(groundTruth.files, parsed.files);
    }
    if (Array.isArray(parsed.exports)) {
        groundTruth.exports.push(...parsed.exports);
    }
}
