import { PromptOrchestrator } from './context.js';

class LLMClient {
  constructor() {
    // Inject via environment variables in a production setup
    this.apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY; 
    this.endpoint = process.env.LLM_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.model = process.env.LLM_MODEL || 'gemini-2.0-flash';
  }

  /**
   * Executes the API call using the strictly formatted prompts.
   */
  async generateCode(orgContext, userContext, taskPrompt, astGraph, sandboxError = null) {
    if (!this.apiKey) {
      throw new Error("CRITICAL: LLM API key is missing. Cannot generate code.");
    }

    // 1. Compile the strict prompt structures
    const systemInstruction = PromptOrchestrator.buildSystemPrompt(orgContext, userContext);
    const userInstruction = PromptOrchestrator.buildTaskPrompt(taskPrompt, astGraph, sandboxError);

    try {
      // 2. Execute the network request
      // Using Gemini API format (adjust if using OpenAI/Anthropic)
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: systemInstruction + '\n\n' + userInstruction }
            ]
          }],
          generationConfig: {
            temperature: 0.2, // Keep temperature low for deterministic coding tasks
            maxOutputTokens: 8192
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LLM API returned status ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      
      // Extract the raw code from the response
      let rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Crude markdown block stripper for safety
      if (rawCode.startsWith('```')) {
        const lines = rawCode.split('\n');
        // Remove first line (```javascript or ```) and last line (```)
        rawCode = lines.slice(1, lines.length - 1).join('\n');
      }

      return rawCode;

    } catch (error) {
      throw new Error(`Failed to communicate with LLM provider: ${error.message}`);
    }
  }
}

export default new LLMClient();
