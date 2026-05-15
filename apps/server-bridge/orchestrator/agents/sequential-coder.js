import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function executeSequentialTask(plan, targetFiles) {
    const governor = new TokenGovernor();
    const systemPrompt = "You are the Sequential Coder. Follow the provided Architectural Plan. Output ONLY a JSON object containing 'search_and_replace' blocks for the target files. Do not rewrite entire files. No conversational text.";
    const userPrompt = `Plan: ${JSON.stringify(plan)}\nTarget Files: ${JSON.stringify(targetFiles)}`;
    const modelOutput = await governor.getCompute('low', 'worker', (key, model, provider) => (
        callRoutedTextModel(key, model, systemPrompt, userPrompt, { provider, jsonMode: true })
    ));

    return {
        modelOutput,
        systemPrompt,
        plan,
        targetFiles
    };
}
