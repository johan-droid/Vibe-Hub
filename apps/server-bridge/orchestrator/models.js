import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * ModelService — Phase 4 (Native Google SDK)
 * 
 * Leverages the full power of Google Generative AI SDK:
 * - Native tool-calling with function declarations
 * - Structured JSON outputs via responseMimeType
 * - Massive context windows (up to 2M tokens with gemini-1.5-pro)
 * - Streaming responses for real-time feedback
 */
export class ModelService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    // Model configuration cache
    this.modelConfigs = {
      'gemini-1.5-flash': { maxOutputTokens: 8192, contextWindow: 1048576 },
      'gemini-1.5-pro': { maxOutputTokens: 8192, contextWindow: 2097152 },
      'gemini-2.0-flash': { maxOutputTokens: 8192, contextWindow: 1048576 },
    };
  }

  /**
   * Run a chat completion using native Google Generative AI SDK.
   * Supports tool-calling, structured outputs, and streaming.
   */
  async chat({ 
    model = 'gemini-2.0-flash', 
    messages, 
    max_tokens = 2048,
    tools = [],
    systemInstruction = '',
    responseMimeType = null, // 'application/json' for structured output
    temperature = 0.7,
    topP = 0.95,
    stream = false
  }) {
    const modelConfig = this.modelConfigs[model] || { maxOutputTokens: 8192, contextWindow: 1048576 };
    
    // Convert OpenAI-style messages to Google format
    const formattedHistory = this._formatMessages(messages);
    
    const generativeModel = this.genAI.getGenerativeModel({
      model,
      tools: tools.length > 0 ? tools : undefined,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        maxOutputTokens: Math.min(max_tokens, modelConfig.maxOutputTokens),
        temperature,
        topP,
        ...(responseMimeType && { responseMimeType }),
      },
    });

    try {
      if (stream) {
        // Streaming mode for real-time responses
        const result = await generativeModel.generateContentStream({
          contents: formattedHistory,
        });
        
        // Return async iterator for streaming
        return {
          stream: true,
          iterator: result.stream,
          text: async () => {
            let fullText = '';
            for await (const chunk of result.stream) {
              fullText += chunk.text();
            }
            return fullText;
          }
        };
      } else {
        // Standard mode
        const result = await generativeModel.generateContent({
          contents: formattedHistory,
        });
        
        const response = result.response;
        return {
          text: response.text(),
          candidates: response.candidates,
          usageMetadata: response.usageMetadata,
          functionCalls: response.functionCalls?.() || [],
        };
      }
    } catch (error) {
      console.error('[GoogleGenerativeAI] Error:', error.message);
      throw new Error(`[Google Generative AI] ${error.message}`);
    }
  }

  /**
   * Generate structured JSON output using responseMimeType.
   * Ideal for deterministic outputs like design tokens, configs, etc.
   */
  async generateStructuredJSON({ 
    model = 'gemini-2.0-flash',
    prompt, 
    schema,
    systemInstruction = ''
  }) {
    const result = await this.chat({
      model,
      messages: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      responseMimeType: 'application/json',
      max_tokens: 4096,
    });
    
    try {
      return JSON.parse(result.text);
    } catch (parseError) {
      console.error('[ModelService] Failed to parse JSON response:', parseError);
      throw new Error('Model returned invalid JSON');
    }
  }

  /**
   * Convert OpenAI-style messages to Google Generative AI format
   */
  _formatMessages(messages) {
    const contents = [];
    let currentRole = null;
    let currentParts = [];

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      
      if (role !== currentRole) {
        if (currentRole && currentParts.length > 0) {
          contents.push({ role: currentRole, parts: currentParts });
        }
        currentRole = role;
        currentParts = [];
      }
      
      // Handle different part types
      if (msg.parts) {
        currentParts.push(...msg.parts);
      } else if (msg.content) {
        currentParts.push({ text: msg.content });
      } else if (msg.text) {
        currentParts.push({ text: msg.text });
      }
    }
    
    // Push final message
    if (currentRole && currentParts.length > 0) {
      contents.push({ role: currentRole, parts: currentParts });
    }
    
    return contents;
  }

  /**
   * Create a reusable chat session with history management
   */
  createChatSession({ 
    model = 'gemini-2.0-flash',
    systemInstruction = '',
    tools = [],
    history = []
  }) {
    const generativeModel = this.genAI.getGenerativeModel({
      model,
      tools: tools.length > 0 ? tools : undefined,
      systemInstruction: systemInstruction || undefined,
    });

    const chat = generativeModel.startChat({
      history: this._formatMessages(history),
    });

    return {
      sendMessage: async (message) => {
        const result = await chat.sendMessage(message);
        return {
          text: result.response.text(),
          functionCalls: result.response.functionCalls?.() || [],
        };
      },
      sendMessageStream: async (message) => {
        const result = await chat.sendMessageStream(message);
        return {
          stream: result.stream,
          text: async () => {
            let fullText = '';
            for await (const chunk of result.stream) {
              fullText += chunk.text();
            }
            return fullText;
          }
        };
      }
    };
  }
}

export const modelService = new ModelService();
