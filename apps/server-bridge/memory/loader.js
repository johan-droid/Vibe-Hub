import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import fs from 'fs/promises';
import path from 'path';
import pool, { insertAgentMemoryItem } from '../db.js';
import { hashValue, withJsonCache } from '../utils/cache.js';

class SemanticGraphBuilder {
  constructor() {
    this.languages = new Map([
      ['javascript', JavaScript],
      ['typescript', JavaScript],
    ]);
  }

  getLanguageKey(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (ext === '.py') return 'python';
    if (ext === '.go') return 'go';
    return 'javascript';
  }

  async loadLanguage(filePath) {
    const key = this.getLanguageKey(filePath);
    if (this.languages.has(key)) return { key, language: this.languages.get(key) };

    try {
      const moduleName = key === 'python' ? 'tree-sitter-python' : 'tree-sitter-go';
      const grammar = await import(moduleName);
      const language = grammar.default || grammar;
      this.languages.set(key, language);
      return { key, language };
    } catch (err) {
      throw new Error(`Tree-sitter grammar for ${key} is not installed. Add ${key === 'python' ? 'tree-sitter-python' : 'tree-sitter-go'} to enable ${key} AST memory.`);
    }
  }

  collectSymbols({ languageKey, code, tree }) {
    const exportsList = [];
    const importsList = [];
    const functionsList = [];

    const importTypes = new Set({
      javascript: ['import_statement'],
      typescript: ['import_statement'],
      python: ['import_statement', 'import_from_statement'],
      go: ['import_declaration'],
    }[languageKey] || ['import_statement']);

    const exportTypes = new Set({
      javascript: ['export_statement'],
      typescript: ['export_statement'],
      python: [],
      go: [],
    }[languageKey] || []);

    const functionTypes = new Set({
      javascript: ['function_declaration', 'arrow_function', 'method_definition'],
      typescript: ['function_declaration', 'arrow_function', 'method_definition'],
      python: ['function_definition', 'class_definition'],
      go: ['function_declaration', 'method_declaration'],
    }[languageKey] || ['function_declaration']);

    const traverse = (node) => {
      if (importTypes.has(node.type)) {
        importsList.push(code.substring(node.startIndex, node.endIndex));
      } else if (exportTypes.has(node.type) || (node.type === 'lexical_declaration' && node.parent?.type === 'export_statement')) {
        exportsList.push(code.substring(node.startIndex, node.endIndex));
      } else if (functionTypes.has(node.type)) {
        const nameNode = node.children.find(c => c.type === 'identifier' || c.type === 'field_identifier');
        if (nameNode) functionsList.push(code.substring(nameNode.startIndex, nameNode.endIndex));
      }

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i));
      }
    };

    traverse(tree.rootNode);
    return { exportsList, importsList, functionsList };
  }

  /**
   * Parses raw code and extracts semantic graph.
   * @param {string} code - The raw code content.
   * @param {string} filename - Filename (used for language detection and caching).
   */
  async analyzeCode(code, filename) {
    try {
      const { key: languageKey, language } = await this.loadLanguage(filename);
      const cacheKey = `cache:ast:${languageKey}:${hashValue(code)}`;

      const { value } = await withJsonCache(cacheKey, Number.parseInt(process.env.AST_CACHE_TTL_SECONDS || '3600', 10), async () => {
        const parser = new Parser();
        parser.setLanguage(language);
        const tree = parser.parse(code);
        const { exportsList, importsList, functionsList } = this.collectSymbols({ languageKey, code, tree });

        return {
          file: path.basename(filename),
          language: languageKey,
          strict_imports: importsList,
          strict_exports: exportsList,
          internal_functions: functionsList,
          ast_node_count: tree.rootNode.childCount,
          file_hash: hashValue(code)
        };
      });

      return value;
    } catch (error) {
      throw new Error(`AST Parsing failed for ${filename}: ${error.message}`);
    }
  }

  /**
   * Parses a file and extracts a deterministic map of its dependencies and exports.
   * @param {string} filePath - Absolute path to the target file.
   */
  async buildSemanticGraph(filePath) {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      return await this.analyzeCode(code, filePath);
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

    if (query) {
      const recall = await pool.query(
        `SELECT kind, content, metadata, created_at
         FROM agent_memory_items
         WHERE user_id = $1
           AND project_name = $2
           AND content ILIKE $3
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId, projectName, `%${String(query).slice(0, 200)}%`]
      );

      if (recall.rows.length > 0) {
        recentJournal = recentJournal.concat(recall.rows.map(row => ({
          type: row.kind,
          content: row.content,
          metadata: row.metadata,
          timestamp: row.created_at,
          source: 'agent_memory_items',
        }))).slice(-10);
      }
    }

    return { userMemory, brainJournal: recentJournal };
  } catch (err) {
    return { userMemory: null, brainJournal: [] };
  }
}

export async function appendBrainJournal(userId, projectName, entry) {
  if (process.env.NODE_ENV === 'test') return;
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

    const content = journalEntry.content || journalEntry.summary || journalEntry.note || JSON.stringify(journalEntry);
    await insertAgentMemoryItem({
      userId,
      projectName,
      kind: journalEntry.type || journalEntry.kind || 'brain_journal',
      content: String(content).slice(0, 12000),
      metadata: {
        source: 'brain_journal',
        tags: journalEntry.tags || [],
        timestamp: journalEntry.timestamp,
      },
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to append brain journal:', err);
  }
}
