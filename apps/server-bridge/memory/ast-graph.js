/**
 * AST Graph Builder — Structural Memory v6
 * =======================================
 *
 * Uses tree-sitter to build a call graph of the codebase.
 * Maps functions, imports, and dependencies for deterministic context retrieval.
 *
 * Strategy: 100% AST-first, embeddings fallback only if AST returns nothing.
 */

import TreeSitter from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { v4 as uuid } from 'uuid';

const parser = new TreeSitter();

// ─── AST Node Types ───────────────────────────────────────────────────────────

export class FunctionNode {
  constructor({ id, name, type, filePath, startPosition, endPosition, params = [], returns = null }) {
    this.id = id || uuid();
    this.name = name;
    this.type = type; // 'function', 'method', 'arrow', 'class'
    this.filePath = filePath;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.params = params;
    this.returns = returns;
    this.dependencies = new Set(); // IDs of functions this calls
    this.dependents = new Set(); // IDs of functions that call this
    this.imports = new Set(); // Module imports
  }
}

export class ImportEdge {
  constructor({ source, target, type }) {
    this.source = source; // Importing file
    this.target = target; // Imported module/symbol
    this.type = type; // 'default', 'named', 'namespace', 'require'
  }
}

// ─── AST Graph ───────────────────────────────────────────────────────────────

export class ASTGraph {
  constructor(projectName) {
    this.projectName = projectName;
    this.nodes = new Map(); // id -> FunctionNode
    this.edges = new Map(); // callerId -> Set<calleeId>
    this.imports = new Map(); // filePath -> ImportEdge[]
    this.fileIndex = new Map(); // filePath -> nodeIds[]
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    
    if (!this.fileIndex.has(node.filePath)) {
      this.fileIndex.set(node.filePath, []);
    }
    this.fileIndex.get(node.filePath).push(node.id);
    
    return node;
  }

  addEdge(callerId, calleeId) {
    if (!this.edges.has(callerId)) {
      this.edges.set(callerId, new Set());
    }
    this.edges.get(callerId).add(calleeId);
    
    // Update node relationships
    const caller = this.nodes.get(callerId);
    const callee = this.nodes.get(calleeId);
    if (caller) caller.dependencies.add(calleeId);
    if (callee) callee.dependents.add(callerId);
  }

  addImport(filePath, importEdge) {
    if (!this.imports.has(filePath)) {
      this.imports.set(filePath, []);
    }
    this.imports.get(filePath).push(importEdge);
  }

  /**
   * Get all dependencies of a function (recursive)
   */
  getDependencies(nodeId, depth = 3, visited = new Set()) {
    if (depth <= 0 || visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    const deps = [];
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        deps.push(depNode);
        deps.push(...this.getDependencies(depId, depth - 1, visited));
      }
    }
    
    return [...new Set(deps)]; // Deduplicate
  }

  /**
   * Get all dependents (functions that call this function)
   */
  getDependents(nodeId, depth = 2, visited = new Set()) {
    if (depth <= 0 || visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    const deps = [];
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        deps.push(depNode);
        deps.push(...this.getDependents(depId, depth - 1, visited));
      }
    }
    
    return [...new Set(deps)];
  }

  /**
   * Find function by name (across all files)
   */
  findFunction(name) {
    for (const node of this.nodes.values()) {
      if (node.name === name) return node;
    }
    return null;
  }

  /**
   * Get all functions in a file
   */
  getFileFunctions(filePath) {
    const nodeIds = this.fileIndex.get(filePath) || [];
    return nodeIds.map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Serialize for storage
   */
  toJSON() {
    return {
      projectName: this.projectName,
      nodes: Array.from(this.nodes.values()).map(n => ({
        ...n,
        dependencies: Array.from(n.dependencies),
        dependents: Array.from(n.dependents),
        imports: Array.from(n.imports)
      })),
      edges: Array.from(this.edges.entries()).map(([k, v]) => [k, Array.from(v)]),
      imports: Array.from(this.imports.entries()),
      fileIndex: Array.from(this.fileIndex.entries())
    };
  }

  static fromJSON(data) {
    const graph = new ASTGraph(data.projectName);
    
    for (const nodeData of data.nodes) {
      const node = new FunctionNode(nodeData);
      node.dependencies = new Set(nodeData.dependencies);
      node.dependents = new Set(nodeData.dependents);
      node.imports = new Set(nodeData.imports);
      graph.addNode(node);
    }
    
    for (const [callerId, calleeIds] of data.edges) {
      for (const calleeId of calleeIds) {
        graph.addEdge(callerId, calleeId);
      }
    }
    
    for (const [filePath, imports] of data.imports) {
      graph.imports.set(filePath, imports);
    }
    
    for (const [filePath, nodeIds] of data.fileIndex) {
      graph.fileIndex.set(filePath, nodeIds);
    }
    
    return graph;
  }
}

// ─── Tree-sitter Parser Integration ───────────────────────────────────────────

export class ASTParser {
  constructor() {
    this.parser = new TreeSitter();
  }

  setLanguage(filePath) {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      this.parser.setLanguage(TypeScript);
    } else {
      this.parser.setLanguage(JavaScript);
    }
  }

  /**
   * Parse a file and extract function nodes and call edges
   */
  parseFile(filePath, content) {
    this.setLanguage(filePath);
    const tree = this.parser.parse(content);
    const graph = new ASTGraph();
    
    const rootNode = tree.rootNode;
    const functionNodes = this._extractFunctions(rootNode, filePath, content);
    
    for (const node of functionNodes) {
      graph.addNode(node);
    }
    
    // Extract call edges
    this._extractCallEdges(rootNode, graph, content);
    
    // Extract imports
    this._extractImports(rootNode, graph, filePath);
    
    return graph;
  }

  _extractFunctions(node, filePath, content) {
    const functions = [];
    
    const queries = [
      // Function declarations: function foo() {}
      `(function_declaration name: (identifier) @name)`,
      // Arrow functions: const foo = () => {}
      `(variable_declarator name: (identifier) @name value: (arrow_function))`,
      // Method definitions: class Foo { bar() {} }
      `(method_definition name: (property_identifier) @name)`,
      // Class declarations
      `(class_declaration name: (type_identifier) @name)`,
    ];
    
    for (const queryStr of queries) {
      const query = new TreeSitter.Query(this.parser.getLanguage(), queryStr);
      const matches = query.matches(node);
      
      for (const match of matches) {
        for (const capture of match.captures) {
          const name = capture.node.text;
          const startPos = capture.node.startPosition;
          const endPos = capture.node.endPosition;
          
          // Get parent to determine type
          let type = 'function';
          let parent = capture.node.parent;
          while (parent) {
            if (parent.type === 'method_definition') type = 'method';
            if (parent.type === 'class_declaration') type = 'class';
            if (parent.type === 'arrow_function') type = 'arrow';
            parent = parent.parent;
          }
          
          functions.push(new FunctionNode({
            name,
            type,
            filePath,
            startPosition: startPos,
            endPosition: endPos
          }));
        }
      }
    }
    
    return functions;
  }

  _extractCallEdges(node, graph, content) {
    // Query for call expressions
    const queryStr = `(call_expression function: (identifier) @name)`;
    const query = new TreeSitter.Query(this.parser.getLanguage(), queryStr);
    const matches = query.matches(node);
    
    // Map of function names to node IDs in this file
    const localFunctions = new Map();
    for (const [id, funcNode] of graph.nodes) {
      localFunctions.set(funcNode.name, id);
    }
    
    // Find which function contains each call
    for (const match of matches) {
      for (const capture of match.captures) {
        const calleeName = capture.node.text;
        const callPosition = capture.node.startPosition;
        
        // Find containing function
        let containingFunction = null;
        for (const [id, funcNode] of graph.nodes) {
          if (callPosition.row >= funcNode.startPosition.row && 
              callPosition.row <= funcNode.endPosition.row) {
            containingFunction = id;
            break;
          }
        }
        
        // Add edge if callee exists locally
        if (containingFunction && localFunctions.has(calleeName)) {
          graph.addEdge(containingFunction, localFunctions.get(calleeName));
        }
      }
    }
  }

  _extractImports(node, graph, filePath) {
    // ES6 imports: import { foo } from 'bar'
    const importQuery = `(import_statement source: (string) @source)`;
    const query = new TreeSitter.Query(this.parser.getLanguage(), importQuery);
    const matches = query.matches(node);
    
    for (const match of matches) {
      for (const capture of match.captures) {
        const source = capture.node.text.replace(/['"]/g, '');
        graph.addImport(filePath, new ImportEdge({
          source: filePath,
          target: source,
          type: 'es6'
        }));
      }
    }
    
    // CommonJS: require('foo')
    const requireQuery = `(call_expression function: (identifier) @req arguments: (arguments (string) @source))`;
    const reqQuery = new TreeSitter.Query(this.parser.getLanguage(), requireQuery);
    const reqMatches = reqQuery.matches(node);
    
    for (const match of reqMatches) {
      let isRequire = false;
      let source = null;
      
      for (const capture of match.captures) {
        if (capture.name === 'req' && capture.node.text === 'require') {
          isRequire = true;
        }
        if (capture.name === 'source') {
          source = capture.node.text.replace(/['"]/g, '');
        }
      }
      
      if (isRequire && source) {
        graph.addImport(filePath, new ImportEdge({
          source: filePath,
          target: source,
          type: 'require'
        }));
      }
    }
  }
}

// ─── Graph Storage ────────────────────────────────────────────────────────────

import pool from '../db.js';

export class ASTGraphStore {
  /**
   * Save graph to database
   */
  static async save(projectName, filePath, graph) {
    const json = graph.toJSON();
    
    await pool.query(
      `INSERT INTO ast_graphs (project_name, file_path, graph_json, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_name, file_path) DO UPDATE SET
         graph_json = EXCLUDED.graph_json,
         updated_at = NOW()`,
      [projectName, filePath, JSON.stringify(json)]
    );
  }

  /**
   * Load graph from database
   */
  static async load(projectName, filePath) {
    const result = await pool.query(
      `SELECT graph_json FROM ast_graphs 
       WHERE project_name = $1 AND file_path = $2`,
      [projectName, filePath]
    );
    
    if (result.rows.length === 0) return null;
    
    return ASTGraph.fromJSON(JSON.parse(result.rows[0].graph_json));
  }

  /**
   * Load all graphs for a project
   */
  static async loadProject(projectName) {
    const result = await pool.query(
      `SELECT file_path, graph_json FROM ast_graphs 
       WHERE project_name = $1`,
      [projectName]
    );
    
    const merged = new ASTGraph(projectName);
    
    for (const row of result.rows) {
      const graph = ASTGraph.fromJSON(JSON.parse(row.graph_json));
      
      // Merge nodes
      for (const [id, node] of graph.nodes) {
        merged.addNode(node);
      }
      
      // Merge edges
      for (const [callerId, calleeIds] of graph.edges) {
        for (const calleeId of calleeIds) {
          merged.addEdge(callerId, calleeId);
        }
      }
      
      // Merge imports
      for (const [filePath, imports] of graph.imports) {
        for (const imp of imports) {
          merged.addImport(filePath, imp);
        }
      }
    }
    
    return merged;
  }
}

// ─── Hybrid Retrieval (AST-first, embeddings fallback) ───────────────────────

export class HybridContextRetriever {
  constructor(astGraph, embeddingsService) {
    this.astGraph = astGraph;
    this.embeddings = embeddingsService;
  }

  /**
   * Get context for a target function/file
   * Strategy: 100% AST-first, embeddings only if AST empty
   */
  async getContext(targetFilePath, targetFunctionName = null, query = null) {
    const results = {
      astDependencies: [],
      astDependents: [],
      relatedFiles: [],
      embeddingResults: []
    };

    // 1. AST-first: Get exact dependencies
    let targetNode = null;
    
    if (targetFunctionName) {
      targetNode = this.astGraph.findFunction(targetFunctionName);
    }
    
    if (!targetNode) {
      // Get all functions in file
      const fileFuncs = this.astGraph.getFileFunctions(targetFilePath);
      if (fileFuncs.length > 0) {
        targetNode = fileFuncs[0];
      }
    }

    if (targetNode) {
      // Get dependencies (what this function calls)
      results.astDependencies = this.astGraph.getDependencies(targetNode.id, 2);
      // Get dependents (what calls this function)
      results.astDependents = this.astGraph.getDependents(targetNode.id, 1);
    }

    // Get related files from imports
    const imports = this.astGraph.imports.get(targetFilePath) || [];
    results.relatedFiles = imports.map(imp => imp.target);

    // 2. Embeddings fallback: Only if AST results are sparse
    const astResultCount = results.astDependencies.length + results.astDependents.length;
    
    if (astResultCount < 3 && query) {
      // Fall back to embeddings for semantic search
      const embedding = await this.embeddings.getEmbedding(query);
      // Query would go to pgvector here - simplified
      results.embeddingResults = []; // Populated by caller with actual vector search
    }

    return results;
  }

  /**
   * Format context for LLM prompt
   */
  static formatContext(results) {
    const sections = [];

    if (results.astDependencies.length > 0) {
      sections.push(`=== DEPENDENCIES (Exact Call Graph) ===
${results.astDependencies.map(d => `- ${d.name} (${d.type}) in ${d.filePath}:${d.startPosition.row}`).join('\n')}`);
    }

    if (results.astDependents.length > 0) {
      sections.push(`=== DEPENDENTS (Called By) ===
${results.astDependents.map(d => `- ${d.name} in ${d.filePath}`).join('\n')}`);
    }

    if (results.relatedFiles.length > 0) {
      sections.push(`=== IMPORTED MODULES ===
${results.relatedFiles.map(f => `- ${f}`).join('\n')}`);
    }

    if (results.embeddingResults.length > 0) {
      sections.push(`=== SEMANTICALLY RELATED (Fuzzy Match) ===
${results.embeddingResults.map(r => `- ${r.content?.slice(0, 100)}...`).join('\n')}`);
    }

    return sections.join('\n\n');
  }
}

export default { ASTGraph, ASTParser, ASTGraphStore, HybridContextRetriever };
