import { GoogleGenerativeAI } from '@google/generative-ai';

let _geminiClient = null;
function getGeminiClient() {
  if (!_geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('[Embeddings] GEMINI_API_KEY is not set.');
    }
    _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
          console.warn(`[Embeddings] Error: ${err.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          retries--;
          delay *= 2;
          continue;
        }
        console.error('[Embeddings] Fatal error:', err.message);
        throw err;
      }
    }
  }
}

export const embeddingsService = new EmbeddingsService();
