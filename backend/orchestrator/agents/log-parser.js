import { TokenGovernor, callRoutedGenerateContent } from '../token-governor.js';

export class LogParser {
  constructor() {
    this.governor = new TokenGovernor();
  }

  async parseFailureLog(massiveLog) {
    const systemPrompt = "You are the Log Parser. Read this CI/CD log. Extract ONLY the specific stack trace or error message that caused the failure. Ignore boilerplate. Output under 150 tokens.";

    try {
      const response = await this.governor.getCompute('low', 'planner', (key, model, provider) => callRoutedGenerateContent(key, model, {
        contents: [{ role: 'user', parts: [{ text: massiveLog }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 150 }
      }, { provider }));
      return response.response.text();
    } catch (error) {
      console.error("Error in LogParser parsing failure log:", error);
      throw error;
    }
  }
}
