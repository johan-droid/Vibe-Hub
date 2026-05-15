import { GoogleGenerativeAI } from '@google/generative-ai';
import { agentAuthManager } from '../auth/agent-auth.js';
import { countTokens, tokenize } from './tokenizer.js';
import { logger } from '../utils/detailed-logger.js';

let _geminiClient = null;
function getGeminiClient() {
  if (!_geminiClient) {
    const apiKey = agentAuthManager.getBearerToken('gemini');
    if (!apiKey) {
      throw new Error('[Embeddings] GEMINI_API_KEY is not set.');
    }
    _geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return _geminiClient;
}

/**
 * EmbeddingsService — Semantic Brain v1.0
 */
export class EmbeddingsService {
  constructor(modelName = 'text-embedding-004') {
    this.modelName = modelName;
  }

  /**
   * Generate a vector for a string.
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  async getEmbedding(text) {
    const tokens = tokenize(text);
    const tokenCount = countTokens(text);
    logger.info('EmbeddingsService', `Pre-tokenized text into ${tokens.length} discrete tokens (est. ${tokenCount} budget tokens).`);

    const model = getGeminiClient().getGenerativeModel({ model: this.modelName });
    
    // Retry logic (Gap #5 consistency)
    let retries = 3;
    let delay = 1000;
    
    while (retries >= 0) {
      try {
        const result = await model.embedContent(text);
        return result.embedding.values;
      } catch (err) {
        const isRetryable = err.message.includes('429') || err.message.includes('503') || err.message.includes('quota');
        if (isRetryable && retries > 0) {
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
  }
}

export const embeddingsService = new EmbeddingsService();
