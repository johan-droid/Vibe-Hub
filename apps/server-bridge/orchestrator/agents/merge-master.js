import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function synthesizeDiffs(workerOutputs, contractSchema) {
  // Use Governor to request 'low' complexity 'planner' (Gemini 1.5 Flash).
  // System Prompt: "You are the Merge Master. You have multiple code diffs from parallel workers. Ensure they follow the Contract Schema. Resolve any naming collisions. Output a single, unified JSON Master Patch."
  const governor = new TokenGovernor();
  const systemPrompt = `You are the Merge Master. You have multiple code diffs from parallel workers. Ensure they follow the Contract Schema. Resolve any naming collisions. Output a single, unified JSON Master Patch.`;
  const prompt = `Worker Outputs: ${JSON.stringify(workerOutputs)}\nContract Schema: ${JSON.stringify(contractSchema)}`;

  const masterPatch = await governor.getCompute('low', 'planner', (key, model, provider) => (
    callRoutedTextModel(key, model, systemPrompt, prompt, { provider, maxOutputTokens: 4096, jsonMode: true })
  ));
  return masterPatch;
}
