import fs from 'fs/promises';
import path from 'path';
import pool, { insertAgentMemoryItem } from '../db.js';
import { hashValue, withJsonCache } from '../utils/cache.js';
import { buildRecallPatterns } from './query-sanitizer.js';
import {
  buildEvidencePacket,
  classifyRetrievalPlan,
  inferMemoryClass,
  normalizeMemoryItem,
  rankMemoryItems,
} from './rag-layers.js';

let treeSitterRuntime = null;
let treeSitterRuntimePromise = null;

async function ensureTreeSitterRuntime() {
  if (treeSitterRuntime) return treeSitterRuntime;
  if (treeSitterRuntimePromise) return treeSitterRuntimePromise;

  treeSitterRuntimePromise = (async () => {
    try {
      const [parserModule, jsModule, tsModule] = await Promise.all([
        import('tree-sitter'),
        import('tree-sitter-javascript'),
        import('tree-sitter-typescript'),
      ]);

      treeSitterRuntime = {
        Parser: parserModule.default || parserModule,
        JavaScript: jsModule.default || jsModule,
        TypeScript: tsModule.default || tsModule,
      };
      return treeSitterRuntime;
    } catch (error) {
      throw new Error(
        `Tree-sitter runtime failed to load: ${error.message}. ` +
        'Verify the deploy Node version matches project engines and run a clean dependency install.'
      );
    }
  })();

  return treeSitterRuntimePromise;
}

class SemanticGraphBuilder {
  constructor() {
    this.languages = new Map();
  }

  async ensureCoreLanguages() {
    if (this.languages.has('javascript') && this.languages.has('typescript') && this.languages.has('tsx')) {
      return;
    }

    const { JavaScript, TypeScript } = await ensureTreeSitterRuntime();
    this.languages.set('javascript', JavaScript);
    this.languages.set('typescript', TypeScript.typescript);
    this.languages.set('tsx', TypeScript.tsx);
  }

  getLanguageKey(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
    if (ext === '.tsx') return 'tsx';
    if (ext === '.ts') return 'typescript';
    if (ext === '.py') return 'python';
    if (ext === '.go') return 'go';
    return 'javascript';
  }

  async loadLanguage(filePath) {
    await this.ensureCoreLanguages();
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
    const variablesList = [];
    const stateContextList = [];

    const importTypes = new Set({
      javascript: ['import_statement'],
      typescript: ['import_statement'],
      tsx: ['import_statement'],
      python: ['import_statement', 'import_from_statement'],
      go: ['import_declaration'],
    }[languageKey] || ['import_statement']);

    const exportTypes = new Set({
      javascript: ['export_statement'],
      typescript: ['export_statement'],
      tsx: ['export_statement'],
      python: [],
      go: [],
    }[languageKey] || []);

    const functionTypes = new Set({
      javascript: ['function_declaration', 'arrow_function', 'method_definition'],
      typescript: ['function_declaration', 'arrow_function', 'method_definition'],
      tsx: ['function_declaration', 'arrow_function', 'method_definition'],
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
      } else if (node.type === 'variable_declarator') {
        const nameNode = node.childForFieldName?.('name') || node.namedChild?.(0);
        const valueNode = node.childForFieldName?.('value');
        const names = collectBindingNames(nameNode);
        const declaration = nearestDeclaration(node);
        const declarationText = code.substring((declaration || node).startIndex, (declaration || node).endIndex);
        const calleeName = getCalleeName(valueNode);
        const exported = isExported(node);

        if (names.length > 0 && valueNode?.type !== 'arrow_function') {
          variablesList.push(declarationText);
        }

        const stateKind = classifyStateContext(names.join(', '), calleeName, exported);
        if (stateKind) {
          stateContextList.push(`${stateKind}: ${declarationText}`);
        }
      } else if (node.type === 'field_definition' || node.type === 'public_field_definition') {
        const declarationText = code.substring(node.startIndex, node.endIndex);
        variablesList.push(declarationText);
        stateContextList.push(`class_field: ${declarationText}`);
      }

      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i));
      }
    };

    traverse(tree.rootNode);
    return { exportsList, importsList, functionsList, variablesList, stateContextList };
  }

  /**
   * Parses raw code and extracts semantic graph.
   * @param {string} code - The raw code content.
   * @param {string} filename - Filename (used for language detection and caching).
   */
  async analyzeCode(code, filename) {
    try {
      const { key: languageKey, language } = await this.loadLanguage(filename);
      const { Parser } = await ensureTreeSitterRuntime();
      const cacheKey = `cache:ast:${languageKey}:${hashValue(code)}`;

      const { value } = await withJsonCache(cacheKey, Number.parseInt(process.env.AST_CACHE_TTL_SECONDS || '3600', 10), async () => {
        const parser = new Parser();
        parser.setLanguage(language);
        const tree = parser.parse(code);
        const { exportsList, importsList, functionsList, variablesList, stateContextList } = this.collectSymbols({ languageKey, code, tree });

        return {
          file: path.basename(filename),
          language: languageKey,
          strict_imports: importsList,
          strict_exports: exportsList,
          internal_functions: functionsList,
          variables: variablesList,
          state_context: stateContextList,
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

function collectBindingNames(node) {
  if (!node) return [];
  if (node.type === 'identifier' || node.type === 'property_identifier') return [node.text];

  const names = [];
  const walk = current => {
    if (current.type === 'identifier' || current.type === 'property_identifier') {
      names.push(current.text);
    }
    for (let i = 0; i < current.namedChildCount; i += 1) {
      walk(current.namedChild(i));
    }
  };
  walk(node);
  return [...new Set(names)];
}

function nearestDeclaration(node) {
  let current = node;
  while (current.parent && ['variable_declarator', 'lexical_declaration', 'variable_declaration'].includes(current.parent.type)) {
    current = current.parent;
  }
  return current.parent?.type === 'export_statement' ? current.parent : current;
}

function isExported(node) {
  const declaration = nearestDeclaration(node);
  return declaration?.type === 'export_statement' || declaration?.parent?.type === 'export_statement';
}

function getCalleeName(node) {
  if (!node || node.type !== 'call_expression') return null;
  const callee = node.childForFieldName?.('function') || node.namedChild?.(0);
  if (!callee) return null;
  if (callee.type === 'identifier') return callee.text;
  if (callee.type === 'member_expression') {
    const property = callee.childForFieldName?.('property') || callee.namedChild?.(callee.namedChildCount - 1);
    return property?.text || callee.text;
  }
  return callee.text;
}

function classifyStateContext(name, calleeName = '', exported = false) {
  if (/^use(State|Reducer)$/u.test(calleeName)) return 'hook_state';
  if (calleeName === 'useContext') return 'context_value';
  if (/^use[A-Z].*Store/u.test(calleeName) || (/Store/u.test(name) && /^use[A-Z]/u.test(calleeName))) return 'store_selector';
  if (/^use[A-Z]/u.test(calleeName)) return 'hook_value';
  if (exported && /createContext/u.test(calleeName)) return 'context_export';
  if (exported && (/create/u.test(calleeName) || /Store/u.test(name))) return 'store_export';
  return exported ? 'exported_variable' : null;
}

export default new SemanticGraphBuilder();

// Legacy memory functions (preserved for orchestrator compatibility)

async function fetchAgentMemoryCandidates({ userId, projectCandidates, projectName, recallPatterns = [] }) {
  if (recallPatterns.length > 0) {
    const whereClause = recallPatterns
      .map((_, index) => `(content ILIKE $${4 + index} ESCAPE '\\' OR metadata::text ILIKE $${4 + index} ESCAPE '\\')`)
      .join(' OR ');

    const result = await pool.query(
      `SELECT kind, content, metadata, created_at, project_name
       FROM agent_memory_items
       WHERE user_id = $1
         AND project_name = ANY($2::text[])
         AND (${whereClause})
       ORDER BY CASE WHEN project_name = $3 THEN 0 ELSE 1 END, created_at DESC
       LIMIT 18`,
      [userId, projectCandidates, projectName, ...recallPatterns]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT kind, content, metadata, created_at, project_name
     FROM agent_memory_items
     WHERE user_id = $1
       AND project_name = ANY($2::text[])
     ORDER BY CASE WHEN project_name = $3 THEN 0 ELSE 1 END, created_at DESC
     LIMIT 10`,
    [userId, projectCandidates, projectName]
  );
  return result.rows;
}

function toJournalEntry(item) {
  return {
    type: item.kind,
    content: item.excerpt || item.content,
    metadata: {
      ...(item.metadata || {}),
      memoryClass: item.memoryClass || inferMemoryClass(item.kind, item.metadata || {}),
      retrievalScore: item.score || item.retrievalScore || 0,
      sourcePath: item.sourcePath || item.metadata?.sourcePath || null,
      sourceName: item.sourceName || item.metadata?.sourceName || null,
    },
    timestamp: item.createdAt || item.created_at || item.timestamp || null,
    source: 'agent_memory_items',
    projectName: item.projectName || item.project_name || 'default',
  };
}

export async function loadMemory(userId, projectName, query = null) {
  try {
    const projectCandidates = [...new Set([projectName, 'default'].filter(Boolean))];
    const result = await pool.query(
      `SELECT user_memory, brain_journal, project_name
       FROM project_memory
       WHERE user_id = $1
         AND project_name = ANY($2::text[])
       ORDER BY CASE WHEN project_name = $3 THEN 0 ELSE 1 END
       LIMIT 1`,
      [userId, projectCandidates, projectName]
    );

    let userMemory = null;
    let recentJournal = [];
    let retrievalPlan = null;
    let evidencePacket = null;
    let sourceMemory = [];
    let learnedMemory = [];
    let workingMemory = [];
    let retrievalAudit = null;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      userMemory = row.user_memory || null;
      recentJournal = (row.brain_journal || []).slice(-10);
    }

    if (query) {
      retrievalPlan = classifyRetrievalPlan(query);
      const recallPatterns = buildRecallPatterns(query, { maxTerms: retrievalPlan.terms.length || 6 });
      const candidates = await fetchAgentMemoryCandidates({
        userId,
        projectCandidates,
        projectName,
        recallPatterns,
      });
      const normalized = candidates.map(normalizeMemoryItem);
      const ranked = rankMemoryItems(normalized, retrievalPlan);
      evidencePacket = buildEvidencePacket({
        query,
        retrievalPlan,
        items: ranked,
      });

      sourceMemory = ranked.filter(item => item.memoryClass === 'source');
      learnedMemory = ranked.filter(item => item.memoryClass === 'learned');
      workingMemory = ranked.filter(item => item.memoryClass === 'working');
      retrievalAudit = {
        queryType: retrievalPlan.queryType,
        recallStrategy: retrievalPlan.recallStrategy,
        riskLevel: retrievalPlan.riskLevel,
        recallTerms: retrievalPlan.terms,
        candidateCount: candidates.length,
        selectedCount: evidencePacket.selectedCount,
        sourceCount: evidencePacket.sourceCount,
        learnedCount: evidencePacket.learnedCount,
        workingCount: evidencePacket.workingCount,
        tokenBudget: evidencePacket.tokenBudget,
        tokenEstimate: evidencePacket.tokenEstimate,
        riskFlags: evidencePacket.riskFlags,
        citations: evidencePacket.citations,
      };

      if (evidencePacket.evidence.length > 0) {
        recentJournal = recentJournal
          .concat(evidencePacket.evidence.map(toJournalEntry))
          .slice(-10);
      }
    }

    return {
      userMemory,
      brainJournal: recentJournal,
      retrievalPlan,
      evidencePacket,
      sourceMemory,
      learnedMemory,
      workingMemory,
      retrievalAudit,
    };
  } catch (err) {
    return {
      userMemory: null,
      brainJournal: [],
      retrievalPlan: null,
      evidencePacket: null,
      sourceMemory: [],
      learnedMemory: [],
      workingMemory: [],
      retrievalAudit: null,
    };
  }
}

export async function saveUserMemory(userId, projectName, userMemory) {
  if (!userId || !projectName) return null;
  const memoryText = String(userMemory || '').trim();

  await pool.query(
    `INSERT INTO project_memory (id, user_id, project_name, user_memory, brain_journal)
     VALUES (gen_random_uuid(), $1, $2, $3, '[]'::jsonb)
     ON CONFLICT (user_id, project_name) DO UPDATE SET
       user_memory = EXCLUDED.user_memory,
       updated_at = NOW()`,
    [userId, projectName, memoryText]
  );

  return memoryText;
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
        memoryClass: 'learned',
        ragStage: 'learned_memory',
        source: 'brain_journal',
        tags: journalEntry.tags || [],
        timestamp: journalEntry.timestamp,
      },
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to append brain journal:', err);
  }
}
