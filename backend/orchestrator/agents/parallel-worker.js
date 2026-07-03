import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function executeParallelSubTask(subTask, groundTruthContext) {
    const governor = new TokenGovernor();

    const systemPrompt = `You are a Parallel Worker. Build the following sub-task: ${subTask}. You MUST strictly follow the Ground Truth Context (actual output from earlier phases): ${JSON.stringify(groundTruthContext)}. Output the full content of the files you create/modify in a strict JSON map. Do not include markdown.`;
    const userPrompt = `Sub-task: ${subTask}\nGround Truth Context: ${JSON.stringify(groundTruthContext)}`;

    const modelOutput = await governor.getCompute('low', 'worker', (key, model, provider) => (
        callRoutedTextModel(key, model, systemPrompt, userPrompt, {
            provider,
            maxOutputTokens: 4096,
            jsonMode: true
        })
    ));

    return {
        modelOutput,
        systemPrompt,
        subTask,
        groundTruthContext
    };
}
