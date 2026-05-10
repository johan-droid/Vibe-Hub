import { TokenGovernor } from '../token-governor.js';

export async function executeSequentialTask(plan, targetFiles) {
    const modelConfig = await TokenGovernor.requestModel('worker', 'Groq Llama-3-70B');

    const systemPrompt = "You are the Sequential Coder. Follow the provided Architectural Plan. Output ONLY a JSON object containing 'search_and_replace' blocks for the target files. Do not rewrite entire files. No conversational text.";

    // Logic to execute the task with the model
    return {
        modelConfig,
        systemPrompt,
        plan,
        targetFiles
    };
}
