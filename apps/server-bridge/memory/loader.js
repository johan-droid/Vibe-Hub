import pool from '../db.js';

/**
 * Load memory for a project: user-written memory.md + auto-learned brain journal.
 */
export async function loadMemory(userId, projectName) {
  try {
    const result = await pool.query(
      'SELECT user_memory, brain_journal FROM project_memory WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    if (result.rows.length === 0) {
      return { userMemory: null, brainJournal: [] };
    }

    const row = result.rows[0];
    return {
      userMemory: row.user_memory || null,
      brainJournal: row.brain_journal || [],
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
 * Auto-compacts when journal exceeds 50 entries.
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

    // Append entry with timestamp
    const journalEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    await pool.query(
      `UPDATE project_memory 
       SET brain_journal = brain_journal || $3::jsonb,
           updated_at = NOW()
       WHERE user_id = $1 AND project_name = $2`,
      [userId, projectName, JSON.stringify([journalEntry])]
    );

    // Auto-compact if over 50 entries
    const result = await pool.query(
      'SELECT jsonb_array_length(brain_journal) as count FROM project_memory WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    if (result.rows[0]?.count > 50) {
      // Keep only the 30 most recent entries
      await pool.query(
        `UPDATE project_memory 
         SET brain_journal = (
           SELECT jsonb_agg(elem) FROM (
             SELECT elem FROM jsonb_array_elements(brain_journal) AS elem
             ORDER BY elem->>'timestamp' DESC
             LIMIT 30
           ) sub
         )
         WHERE user_id = $1 AND project_name = $2`,
        [userId, projectName]
      );
      console.log('[Memory] Brain journal compacted to 30 entries.');
    }
  } catch (err) {
    console.warn('[Memory] Failed to append journal:', err.message);
  }
}
