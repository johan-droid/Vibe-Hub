import { TokenGovernor } from '../models.js';

export async function triageAndRoute(userPrompt) {
  const governor = new TokenGovernor();
  const model = governor.requestModel('low', 'Groq Llama-3-8B');

  const systemPrompt = "You are the Triage Router. Analyze the prompt. Identify the intent (bug_fix or feature_request). Identify the 2-3 specific file paths in the VFS that are relevant to this request. Output strict JSON: { 'intent': string, 'target_files': string[], 'complexity': 'low'|'high' }.";

  const result = await model.generate(systemPrompt, userPrompt);
  try {
      return JSON.parse(result);
  } catch (e) {
      return { intent: "unknown", target_files: [], complexity: "high" };
  }
}
