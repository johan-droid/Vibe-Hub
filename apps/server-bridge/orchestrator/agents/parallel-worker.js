import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function executeParallelSubTask(subTask, contractSchema) {
    const governor = new TokenGovernor();
    const systemPrompt = `You are a Parallel Worker. Build the following sub-task: ${subTask}. You MUST strictly follow this Contract Schema: ${JSON.stringify(contractSchema)}. Output the full content of the files you create/modify in a strict JSON map. Do not include markdown.`;
    const userPrompt = `Sub-task: ${subTask}\nContract Schema: ${JSON.stringify(contractSchema)}`;
    const modelOutput = await governor.getCompute('low', 'worker', (key, model, provider) => (
        callRoutedTextModel(key, model, systemPrompt, userPrompt, { provider, jsonMode: true })
    ));

    return {
        modelOutput,
        systemPrompt,
        subTask,
        contractSchema
    };
}
