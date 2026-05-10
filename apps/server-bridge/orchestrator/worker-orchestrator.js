import { executeSequentialTask } from './agents/sequential-coder.js';
import { executeParallelSubTask } from './agents/parallel-worker.js';
import { KeyRotator } from './key-rotator.js';

export class WorkerOrchestrator {
    static async runSequential(plan, targetFiles) {
        const key = await KeyRotator.getFreshKey();
        return await executeSequentialTask(plan, targetFiles, key);
    }

    static async runParallel(subTasks, contractSchema) {
        const concurrencyLimit = 3;
        const results = [];

        for (let i = 0; i < subTasks.length; i += concurrencyLimit) {
            const batch = subTasks.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (subTask) => {
                const key = await KeyRotator.getFreshKey(); // Fresh key per parallel worker to prevent 429s
                return executeParallelSubTask(subTask, contractSchema, key);
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }
}
