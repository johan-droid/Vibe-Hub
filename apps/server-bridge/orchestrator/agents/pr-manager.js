import { TokenGovernor } from '../token-governor.js';

export class PRManager {
  constructor() {
    this.governor = new TokenGovernor();
  }

  async handleGithubReview(comment, codeDiff) {
    const aiClient = this.governor.requestModel('low', 'planner'); // Gemini 1.5 Flash
    const systemPrompt = "You are the PR Manager. Read this human code review comment. Translate it into a strict JSON 'Bug Report' specifying exactly which lines/logic need fixing. Output: { 'file': string, 'issue': string, 'suggested_fix': string }.";
    const userPrompt = `Code Diff:\n${codeDiff}\n\nHuman Comment:\n${comment}`;

    try {
      const response = await aiClient.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      });
      return JSON.parse(response.response.text());
    } catch (error) {
      console.error("Error in PRManager handling github review:", error);
      throw error;
    }
  }
}
