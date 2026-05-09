import { TokenGovernor } from '../token-governor.js';

export async function auditMasterPatch(masterPatch) {
  // Use Governor to request 'high' complexity 'planner' (NVIDIA NIM).
  // System Prompt: "You are the Security Gate. Audit this Master Patch for SQL injection, XSS, or hardcoded secrets. If safe, output 'CLEARED'. If unsafe, output a detailed 'VULNERABILITY_REPORT'."
  const governor = new TokenGovernor();
  const llmClient = await governor.requestModel('planner', 'high');

  const systemPrompt = `You are the Security Gate. Audit this Master Patch for SQL injection, XSS, or hardcoded secrets. If safe, output 'CLEARED'. If unsafe, output a detailed 'VULNERABILITY_REPORT'.`;
  const prompt = `Master Patch: ${JSON.stringify(masterPatch)}`;

  const result = await llmClient.generate(systemPrompt, prompt);
  return result;
}
