import { TokenGovernor } from '../token-governor.js';

export async function executeParallelSubTask(subTask, contractSchema) {
    const modelConfig = await TokenGovernor.requestModel('worker', 'Groq Llama-3-70B');

    const systemPrompt = `You are a Parallel Worker. Build the following sub-task: ${subTask}. You MUST strictly follow this Contract Schema: ${JSON.stringify(contractSchema)}. Output the full content of the files you create/modify in a strict JSON map. Do not include markdown.`;

    // Logic to execute the task with the model
    return {
        modelConfig,
        systemPrompt,
        subTask,
        contractSchema
    };
}
