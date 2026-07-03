import { TokenGovernor, callRoutedGenerateContent } from '../token-governor.js';

export class PRManager {
  constructor() {
    this.governor = new TokenGovernor();
  }

  async handleGithubReview(comment, codeDiff) {
    const systemPrompt = "You are the PR Manager. Read this human code review comment. Translate it into a strict JSON 'Bug Report' specifying exactly which lines/logic need fixing. Output: { 'file': string, 'issue': string, 'suggested_fix': string }.";
    const userPrompt = `Code Diff:\n${codeDiff}\n\nHuman Comment:\n${comment}`;

    try {
      const response = await this.governor.getCompute('low', 'planner', (key, model, provider) => callRoutedGenerateContent(key, model, {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json' },
      }, { provider, jsonMode: true }));
      return JSON.parse(response.response.text());
    } catch (error) {
      console.error("Error in PRManager handling github review:", error);
      throw error;
    }
  }
}
