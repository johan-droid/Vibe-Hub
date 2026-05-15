import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function triageAndRoute(userPrompt) {
  const governor = new TokenGovernor();
  const systemPrompt = "You are the Triage Router. Analyze the prompt. Identify the intent (bug_fix or feature_request). Identify the 2-3 specific file paths in the VFS that are relevant to this request. Output strict JSON: { 'intent': string, 'target_files': string[], 'complexity': 'low'|'high' }.";

  const result = await governor.getCompute('low', 'router', (key, model, provider) => (
    callRoutedTextModel(key, model, systemPrompt, userPrompt, { provider, maxOutputTokens: 512, jsonMode: true })
  ));
  try {
      return JSON.parse(result);
  } catch (e) {
      return { intent: "unknown", target_files: [], complexity: "high" };
  }
}
