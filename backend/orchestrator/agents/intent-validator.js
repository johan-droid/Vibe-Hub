import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export async function validateIntent(userPrompt, sandboxLogs, finalCode) {
  // Use Governor to request 'low' complexity (Groq Llama-3-8B).
  // System Prompt: "Compare the User Intent with the Sandbox Execution Logs. Did the code actually do what was asked? Output JSON: { 'satisfied': boolean, 'reasoning': string }."
  const governor = new TokenGovernor();
  const systemPrompt = `Compare the User Intent with the Sandbox Execution Logs. Did the code actually do what was asked? Output JSON: { 'satisfied': boolean, 'reasoning': string }.`;
  const prompt = `User Prompt: ${userPrompt}\nSandbox Logs: ${sandboxLogs}\nFinal Code: ${finalCode}`;
  const resultStr = await governor.getCompute('low', 'validator', (key, model, provider) => (
    callRoutedTextModel(key, model, systemPrompt, prompt, { provider, maxOutputTokens: 512, jsonMode: true })
  ));

  try {
      return JSON.parse(resultStr);
  } catch (e) {
      return { satisfied: false, reasoning: "Failed to parse JSON output." };
  }
}
