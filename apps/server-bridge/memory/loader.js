import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import fs from 'fs/promises';
import path from 'path';
import pool from '../db.js';

class SemanticGraphBuilder {
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
  }

  /**
   * Parses a file and extracts a deterministic map of its dependencies and exports.
   * @param {string} filePath - Absolute path to the target file.
   */
  async buildSemanticGraph(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      const tree = this.parser.parse(code);
      
      const exportsList = [];
      const importsList = [];
      const functionsList = [];

      // Traverse the Abstract Syntax Tree (AST)
      // This maps the actual logic of the code, completely bypassing fuzzy vector search
      const traverse = (node) => {
        if (node.type === 'import_statement') {
          importsList.push(code.substring(node.startIndex, node.endIndex));
        } else if (node.type === 'export_statement' || node.type === 'lexical_declaration' && node.parent.type === 'export_statement') {
          exportsList.push(code.substring(node.startIndex, node.endIndex));
        } else if (node.type === 'function_declaration' || node.type === 'arrow_function') {
          // Extract function signatures for context mapping
          let nameNode = node.children.find(c => c.type === 'identifier');
          if (nameNode) functionsList.push(code.substring(nameNode.startIndex, nameNode.endIndex));
        }

        for (let i = 0; i < node.childCount; i++) {
          traverse(node.child(i));
        }
      };

      traverse(tree.rootNode);

      return {
        file: path.basename(filePath),
        strict_imports: importsList,
        strict_exports: exportsList,
        internal_functions: functionsList,
        ast_node_count: tree.rootNode.childCount
      };
    } catch (error) {
      throw new Error(`CRITICAL: AST Parsing failed for ${filePath}. Graph broken. ${error.message}`);
    }
  }
}

export default new SemanticGraphBuilder();

// Legacy memory functions (preserved for orchestrator compatibility)

export async function loadMemory(userId, projectName, query = null) {
  try {
    const result = await pool.query(
      'SELECT user_memory, brain_journal FROM project_memory WHERE user_id = $1 AND project_name = $2',
      [userId, projectName]
    );

    let userMemory = null;
    let recentJournal = [];

    if (result.rows.length > 0) {
      const row = result.rows[0];
      userMemory = row.user_memory || null;
      recentJournal = (row.brain_journal || []).slice(-10);
    }

    return { userMemory, brainJournal: recentJournal };
  } catch (err) {
    return { userMemory: null, brainJournal: [] };
  }
}

export async function appendBrainJournal(userId, projectName, entry) {
  try {
    await pool.query(
      `INSERT INTO project_memory (id, user_id, project_name, user_memory, brain_journal)
       VALUES (gen_random_uuid(), $1, $2, '', '[]'::jsonb)
       ON CONFLICT (user_id, project_name) DO NOTHING`,
      [userId, projectName]
    );

    const journalEntry = { ...entry, timestamp: new Date().toISOString() };

    await pool.query(
      `UPDATE project_memory 
       SET brain_journal = brain_journal || $3::jsonb,
           updated_at = NOW()
       WHERE user_id = $1 AND project_name = $2`,
      [userId, projectName, JSON.stringify([journalEntry])]
    );
  } catch (err) {
    console.error('Failed to append brain journal:', err);
  }
}
