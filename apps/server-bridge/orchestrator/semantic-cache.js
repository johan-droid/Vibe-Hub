import crypto from 'crypto';
import { pool } from '../db.js';
import { embeddingsService } from '../memory/embeddings.js';
import logger from '../utils/detailed-logger.js';

class SemanticCacheManager {
  constructor() {
    this.enabled = process.env.SEMANTIC_CACHE_ENABLED !== 'false';
    this.similarityThreshold = Number.parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.95');
    this.fallbackToExactOnly = false;
  }

  hashPrompt(prompt) {
    return crypto
      .createHash('sha256')
      .update(String(prompt || '').trim().toLowerCase())
      .digest('hex');
  }

  async get(prompt) {
    if (!this.enabled) return null;

    try {
      const hash = this.hashPrompt(prompt);

      // 1. O(1) Exact SHA-256 match first (highly efficient, saves API calls)
      const exactResult = await pool.query(
        'SELECT response FROM semantic_cache WHERE prompt_hash = $1',
        [hash]
      );

      if (exactResult.rows.length > 0) {
        logger.info('SemanticCache', `Exact cache hit for prompt hash: ${hash}`);
        await pool.query(
          'UPDATE semantic_cache SET last_used_at = NOW() WHERE prompt_hash = $1',
          [hash]
        );
        return exactResult.rows[0].response;
      }

      // 2. Vector Semantic Similarity Lookup (if enabled and embedding client is functional)
      if (this.fallbackToExactOnly) return null;

      try {
        const queryEmbedding = await embeddingsService.getEmbedding(prompt, {
          cacheKeyNamespace: 'semantic-cache',
        });

        if (queryEmbedding && Array.isArray(queryEmbedding)) {
          const vectorStr = `[${queryEmbedding.join(',')}]`;
          const semanticResult = await pool.query(
            `SELECT prompt, response, 1 - (embedding <=> $1::vector) as similarity
             FROM semantic_cache
             ORDER BY embedding <=> $1::vector
             LIMIT 1`,
            [vectorStr]
          );

          if (semanticResult.rows.length > 0) {
            const match = semanticResult.rows[0];
            const similarity = Number.parseFloat(match.similarity);

            if (similarity >= this.similarityThreshold) {
              logger.info('SemanticCache', `Semantic similarity cache hit! Similarity score: ${similarity.toFixed(4)} (Threshold: ${this.similarityThreshold})`);
              
              // Increment usage and sync exact hash for faster future lookups
              await pool.query(
                'UPDATE semantic_cache SET last_used_at = NOW() WHERE prompt = $1',
                [match.prompt]
              );

              return match.response;
            } else {
              logger.debug('SemanticCache', `Closest semantic candidate similarity below threshold: ${similarity.toFixed(4)}`);
            }
          }
        }
      } catch (embErr) {
        logger.warn('SemanticCache', `Embedding lookup failed: ${embErr.message}. Falling back to exact match checks.`);
        // Mark fallback flag to avoid repeated timeouts on API outage
        this.fallbackToExactOnly = true;
      }

    } catch (err) {
      logger.error('SemanticCache', `Cache retrieval error: ${err.message}`);
    }

    return null;
  }

  async set(prompt, response) {
    if (!this.enabled) return;

    try {
      const hash = this.hashPrompt(prompt);
      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);

      // Check if we already have it under exact hash to avoid duplicate inserts
      const checkExact = await pool.query(
        'SELECT id FROM semantic_cache WHERE prompt_hash = $1',
        [hash]
      );
      if (checkExact.rows.length > 0) return;

      let embeddingVector = null;
      if (!this.fallbackToExactOnly) {
        try {
          embeddingVector = await embeddingsService.getEmbedding(prompt, {
            cacheKeyNamespace: 'semantic-cache',
          });
        } catch (embErr) {
          logger.warn('SemanticCache', `Failed to generate embedding for cache entry: ${embErr.message}`);
          // Proceed with storing null vector for exact match only
        }
      }

      const vectorStr = embeddingVector ? `[${embeddingVector.join(',')}]` : null;

      await pool.query(
        `INSERT INTO semantic_cache (prompt_hash, prompt, response, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (prompt_hash) DO UPDATE 
         SET response = EXCLUDED.response, last_used_at = NOW()`,
        [hash, prompt, responseStr, vectorStr]
      );

      logger.info('SemanticCache', `Successfully cached response for prompt (exact hash: ${hash}, embedded: ${!!embeddingVector})`);
    } catch (err) {
      logger.error('SemanticCache', `Failed to write cache entry: ${err.message}`);
    }
  }

  clearFallback() {
    this.fallbackToExactOnly = false;
  }
}

export const semanticCache = new SemanticCacheManager();
