import { TokenGovernor } from '../token-governor.js';

export class LogParser {
  constructor() {
    this.governor = new TokenGovernor();
  }

  async parseFailureLog(massiveLog) {
    const aiClient = this.governor.requestModel('low', 'planner'); // Gemini 1.5 Flash
    const systemPrompt = "You are the Log Parser. Read this CI/CD log. Extract ONLY the specific stack trace or error message that caused the failure. Ignore boilerplate. Output under 150 tokens.";

    try {
      const response = await aiClient.generateContent({
        contents: [{ role: 'user', parts: [{ text: massiveLog }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 150 }
      });
      return response.response.text();
    } catch (error) {
      console.error("Error in LogParser parsing failure log:", error);
      throw error;
    }
  }
}
