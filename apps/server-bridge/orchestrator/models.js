import { GoogleGenerativeAI } from '@google/generative-ai';
import { githubService } from '../github/index.js';

/**
 * ModelService — Phase 1 (Native Gemini Tool Calling)
 * 
 * Orchestrates calls to Gemini models using GEMINI_API_KEY.
 * Leverage massive context windows and structured outputs.
 */
export class ModelService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Define the native tool schema for GitHub
    this.githubToolDeclaration = {
      name: 'github_api_request',
      description: 'Dispatches secure REST calls to the GitHub API on behalf of the user.',
      parameters: {
        type: 'object',
        properties: {
          endpoint: {
            type: 'string',
            description: 'The GitHub API endpoint (e.g. /repos/{owner}/{repo}/pulls)'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            description: 'HTTP method'
          },
          body: {
            type: 'string',
            description: 'JSON stringified payload for POST/PATCH requests'
          }
        },
        required: ['endpoint', 'method']
      }
    };
  }

  /**
   * Run a chat completion using Google Gemini.
   */
  async chat(installationId, { model = 'gemini-2.0-flash', messages, max_tokens = 2048, useTools = true }) {
    const geminiModel = this.genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        maxOutputTokens: max_tokens,
      },
      tools: useTools ? [{ functionDeclarations: [this.githubToolDeclaration] }] : undefined
    });

    const lastMessage = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chatSession = geminiModel.startChat({
      history,
    });

    try {
      const result = await chatSession.sendMessage(lastMessage);

      const functionCalls = result.response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
         return { toolCalls: functionCalls };
      }

      return { content: result.response.text() };
    } catch (e) {
      console.error('[ModelService] Chat error:', e);
      throw e;
    }
  }
}

export const modelService = new ModelService();
