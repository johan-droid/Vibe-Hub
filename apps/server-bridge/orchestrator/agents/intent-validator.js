import { TokenGovernor } from '../token-governor.js';

export async function validateIntent(userPrompt, sandboxLogs, finalCode) {
  // Use Governor to request 'low' complexity (Groq Llama-3-8B).
  // System Prompt: "Compare the User Intent with the Sandbox Execution Logs. Did the code actually do what was asked? Output JSON: { 'satisfied': boolean, 'reasoning': string }."
  const governor = new TokenGovernor();
  // Assume mapping Groq Llama-3-8B to low complexity or specific model
  const llmClient = await governor.requestModel('validator', 'low');

  const systemPrompt = `Compare the User Intent with the Sandbox Execution Logs. Did the code actually do what was asked? Output JSON: { 'satisfied': boolean, 'reasoning': string }.`;
  const prompt = `User Prompt: ${userPrompt}\nSandbox Logs: ${sandboxLogs}\nFinal Code: ${finalCode}`;

  const resultStr = await llmClient.generate(systemPrompt, prompt);
  try {
      return JSON.parse(resultStr);
  } catch (e) {
      return { satisfied: false, reasoning: "Failed to parse JSON output." };
  }
}
