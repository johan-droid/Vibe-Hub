import { GoogleGenerativeAI } from '@google/generative-ai';
import { githubService } from '../github/index.js';

/**
 * ModelService — Phase 2
 * 
 * Orchestrates calls to Gemini models using GEMINI_API_KEY.
 * Leverage massive context windows and structured outputs.
 */
export class ModelService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  /**
   * Run a chat completion using Google Gemini.
   */
  async chat(installationId, { model = 'gemini-2.0-flash', messages, max_tokens = 2048 }) {
    const geminiModel = this.genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        maxOutputTokens: max_tokens,
        responseMimeType: 'application/json', // Default to structured JSON if possible
      }
    });

    // Convert messages to Gemini format if necessary
    // Gemini usually takes a prompt or a history. 
    // Here we assume a simple prompt for now or implement message mapping.
    const lastMessage = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chatSession = geminiModel.startChat({
      history,
    });

    const result = await chatSession.sendMessage(lastMessage);
    const responseText = result.response.text();

    try {
      return JSON.parse(responseText);
    } catch (e) {
      // If not JSON, wrap it
      return {
        choices: [{
          message: {
            content: responseText
          }
        }]
      };
    }
  }
}

export const modelService = new ModelService();
