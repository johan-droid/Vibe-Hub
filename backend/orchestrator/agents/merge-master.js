import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function synthesizeDiffs(workerOutputs, groundTruthContext = {}) {
  const governor = new TokenGovernor();
  const { systemPrompt, prompt } = buildMergeSynthesisPrompt(workerOutputs, groundTruthContext);

  // MergeMaster reconciles parallel outputs — highest synthesis risk, use planner model
  const masterPatch = await governor.getCompute('high', 'planner', (key, model, provider) => (
    callRoutedTextModel(key, model, systemPrompt, prompt, { provider, maxOutputTokens: 4096, jsonMode: true })
  ));
  return masterPatch;
}

export function buildMergeSynthesisPrompt(workerOutputs, groundTruthContext = {}) {
  const systemPrompt = `You are the Merge Master. You have multiple code diffs from workers. Reconcile them against the Ground Truth Context produced by completed sync nodes. Treat generated types, AST, files, and exports in that context as authoritative. Resolve naming collisions and output a single strict JSON Master Patch.`;
  const prompt = `Worker Outputs: ${JSON.stringify(workerOutputs)}\nGround Truth Context: ${JSON.stringify(groundTruthContext)}`;
  return { systemPrompt, prompt };
}
