import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
   * Run a chat completion using Google Gemini with native tool calling.
   */
  async chat(installationId, { model = 'gemini-2.0-flash', messages, tools = [], max_tokens = 2048 }) {
    // Map abstract tool definitions to Gemini FunctionDeclarations
    const functionDeclarations = tools.map(t => {
      // Handle cases where the format might be { name, description, parameters } or { type: 'function', function: { name, ... } }
      const funcDef = t.function || t;
      return {
        name: funcDef.name,
        description: funcDef.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: funcDef.parameters?.properties || {},
          required: funcDef.parameters?.required || [],
        }
      };
    });

    const geminiModel = this.genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        maxOutputTokens: max_tokens,
      },
      tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => {
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'model',
          parts: m.tool_calls.map(tc => ({
            functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) }
          }))
        };
      } else if (m.role === 'tool') {
        let responseContent;
        try {
          responseContent = JSON.parse(m.content);
        } catch(e) {
          responseContent = { result: m.content };
        }
        return {
          role: 'user', // In Gemini, function responses are sent by the 'user' role
          parts: [{ functionResponse: { name: m.name || m.tool_call_id, response: responseContent } }]
        };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || " " }] // Text cannot be empty
      };
    });

    const lastMessage = messages[messages.length - 1];
    const chatSession = geminiModel.startChat({ history });

    let result;
    try {
      if (lastMessage.role === 'tool') {
        let responseContent;
        try {
          responseContent = JSON.parse(lastMessage.content);
        } catch(e) {
          responseContent = { result: lastMessage.content };
        }
        result = await chatSession.sendMessage([{
          functionResponse: {
            name: lastMessage.name || lastMessage.tool_call_id,
            response: responseContent
          }
        }]);
      } else {
        result = await chatSession.sendMessage(lastMessage.content || " ");
      }
    } catch (err) {
      console.error("[ModelService] Error calling Gemini API:", err);
      throw err;
    }

    const response = result.response;
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
      return {
        choices: [{
          message: {
            tool_calls: calls.map(call => ({
              id: Math.random().toString(36).substring(7),
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.args)
              }
            }))
          }
        }]
      };
    }

    return {
      choices: [{
        message: {
          content: response.text()
        }
      }]
    };
  }
}

export const modelService = new ModelService();
