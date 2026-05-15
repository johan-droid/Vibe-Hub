import { executeSequentialTask } from './agents/sequential-coder.js';
import { executeParallelSubTask } from './agents/parallel-worker.js';

export class WorkerOrchestrator {
    static async runSequential(plan, targetFiles) {
        return await executeSequentialTask(plan, targetFiles);
    }

    static async runParallel(subTasks, contractSchema) {
        const concurrencyLimit = 3;
        const results = [];

        for (let i = 0; i < subTasks.length; i += concurrencyLimit) {
            const batch = subTasks.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (subTask) => {
                return executeParallelSubTask(subTask, contractSchema);
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }
}
