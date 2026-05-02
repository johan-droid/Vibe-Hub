import pool from '../db.js';
import { embeddingsService } from './embeddings.js';

/**
 * Load memory for a project: user-written memory.md + auto-learned brain journal + semantic memory.
 * v4.0: Implements pgvector Semantic Retrieval.
 */
export async function loadMemory(userId, projectName, query = null) {
  try {
    // 1. Fetch user memory and standard journal
    const result = await pool.query(
      'SELECT user_memory, brain_journal FROM project_memory WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    let userMemory = null;
    let recentJournal = [];

    if (result.rows.length > 0) {
      const row = result.rows[0];
      userMemory = row.user_memory || null;
      // Always include the 10 most recent entries for temporal continuity
      recentJournal = (row.brain_journal || []).slice(-10);
    }

    // 2. Semantic Retrieval: If query exists, search vector memory
    let semanticJournal = [];
    if (query && typeof query === 'string' && query.length > 5) {
      try {
        const embedding = await embeddingsService.getEmbedding(query);
        const vectorStr = `[${embedding.join(',')}]`;

        const semanticResult = await pool.query(
          `SELECT content, metadata, 1 - (embedding <=> $3::vector) as similarity
           FROM semantic_memory
           WHERE user_id = $1 AND project_name = $2
           ORDER BY similarity DESC
           LIMIT 15`,
          [userId, projectName, vectorStr]
        );

        semanticJournal = semanticResult.rows
          .filter(r => r.similarity > 0.7) // Threshold for relevance
          .map(r => ({
            ...JSON.parse(r.content),
            similarity: r.similarity
          }));
      } catch (embErr) {
        console.warn('[Memory] Semantic search failed, falling back to recent journal:', embErr.message);
      }
    }

    // Combine and deduplicate
    const combined = [...semanticJournal, ...recentJournal];
    const unique = Array.from(new Map(combined.map(item => [item.timestamp || JSON.stringify(item), item])).values());
    
    const finalJournal = unique.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    return {
      userMemory,
      brainJournal: finalJournal,
    };
  } catch (err) {
    console.warn('[Memory] Failed to load memory:', err.message);
    return { userMemory: null, brainJournal: [] };
  }
}

/**
 * Save or update user-written memory (memory.md content).
 */
export async function saveUserMemory(userId, projectName, content) {
  await pool.query(
    `INSERT INTO project_memory (id, user_id, project_name, user_memory, brain_journal)
     VALUES (gen_random_uuid(), $1, $2, $3, '[]'::jsonb)
     ON CONFLICT (user_id, project_name) DO UPDATE SET
       user_memory = EXCLUDED.user_memory,
       updated_at = NOW()`,
    [userId, projectName, content]
  );
}

/**
 * Append an auto-learned entry to the brain journal.
 * Auto-compacts when journal exceeds 100 entries.
 */
export async function appendBrainJournal(userId, projectName, entry) {
  try {
    // Ensure row exists
    await pool.query(
      `INSERT INTO project_memory (id, user_id, project_name, user_memory, brain_journal)
       VALUES (gen_random_uuid(), $1, $2, '', '[]'::jsonb)
       ON CONFLICT (user_id, project_name) DO NOTHING`,
      [userId, projectName]
    );

    const journalEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // 1. Store in standard JSONB journal (temporal)
    await pool.query(
      `UPDATE project_memory 
       SET brain_journal = brain_journal || $3::jsonb,
           updated_at = NOW()
       WHERE user_id = $1 AND project_name = $2`,
      [userId, projectName, JSON.stringify([journalEntry])]
    );

    // 2. Store in Semantic Memory (vector)
    try {
      const contentToEmbed = `Type: ${entry.type}. Content: ${entry.content}`;
      const embedding = await embeddingsService.getEmbedding(contentToEmbed);
      const vectorStr = `[${embedding.join(',')}]`;

      await pool.query(
        `INSERT INTO semantic_memory (user_id, project_name, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [userId, projectName, JSON.stringify(journalEntry), vectorStr]
      );
    } catch (embErr) {
      console.warn('[Memory] Failed to generate semantic embedding:', embErr.message);
    }

    // Auto-compact if over 100 entries (v3.5 raised limit for more context)
    const result = await pool.query(
      'SELECT jsonb_array_length(brain_journal) as count FROM project_memory WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    if (result.rows[0]?.count > 100) {
      // Keep only the 50 most recent entries
      await pool.query(
        `UPDATE project_memory 
         SET brain_journal = (
           SELECT jsonb_agg(elem) FROM (
             SELECT elem FROM jsonb_array_elements(brain_journal) AS elem
             ORDER BY elem->>'timestamp' DESC
             LIMIT 50
           ) sub
         )
         WHERE user_id = $1 AND project_name = $2`,
        [userId, projectName]
      );
      console.log('[Memory] Brain journal compacted to 50 entries.');
    }
  } catch (err) {
    console.warn('[Memory] Failed to append journal:', err.message);
  }
}
