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
import path from 'path';
import { v4 as uuid } from 'uuid';

const parser = new TreeSitter();

const CALLABLE_NODE_TYPES = new Set(['function', 'method', 'arrow', 'class']);
const STATE_CONTEXT_TYPES = new Set([
  'variable',
  'hook_state',
  'hook_value',
  'context_value',
  'context_export',
  'store_selector',
  'store_export',
  'class_field',
  'import',
  'export',
]);

// ─── AST Node Types ───────────────────────────────────────────────────────────

export class FunctionNode {
  constructor({
    id,
    name,
    type,
    kind = null,
    filePath,
    startIndex = null,
    endIndex = null,
    startPosition,
    endPosition,
    params = [],
    returns = null,
    exported = false,
    exportType = null,
    declarationKind = null,
    valueKind = null,
    sourceModule = null,
    importedName = null,
    aliases = [],
    sourceText = null,
  }) {
    this.id = id || uuid();
    this.name = name;
    this.type = type; // 'function', 'method', 'arrow', 'class'
    this.kind = kind || type;
    this.filePath = filePath;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.params = params;
    this.returns = returns;
    this.exported = Boolean(exported);
    this.exportType = exportType;
    this.declarationKind = declarationKind;
    this.valueKind = valueKind;
    this.sourceModule = sourceModule;
    this.importedName = importedName;
    this.aliases = aliases;
    this.sourceText = sourceText;
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
    this.exports = new Map(); // filePath -> nodeIds[]
    this.symbolIndex = new Map(); // symbol/alias -> nodeIds[]
    this.fileIndex = new Map(); // filePath -> nodeIds[]
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    
    if (!this.fileIndex.has(node.filePath)) {
      this.fileIndex.set(node.filePath, []);
    }
    this.fileIndex.get(node.filePath).push(node.id);

    for (const symbol of [node.name, ...(node.aliases || [])].filter(Boolean)) {
      if (!this.symbolIndex.has(symbol)) {
        this.symbolIndex.set(symbol, []);
      }
      this.symbolIndex.get(symbol).push(node.id);
    }

    if (node.exported) {
      this.addExport(node.filePath, node.id);
    }
    
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

  addExport(filePath, nodeId) {
    if (!this.exports.has(filePath)) {
      this.exports.set(filePath, []);
    }
    if (!this.exports.get(filePath).includes(nodeId)) {
      this.exports.get(filePath).push(nodeId);
    }
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
    
    return dedupeNodes(deps);
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
    
    return dedupeNodes(deps);
  }

  /**
   * Find function by name (across all files)
   */
  findFunction(name) {
    for (const node of this.nodes.values()) {
      if (node.name === name && CALLABLE_NODE_TYPES.has(node.type)) return node;
    }
    return null;
  }

  findSymbols(name, { filePath = null, types = null } = {}) {
    const ids = this.symbolIndex.get(name) || [];
    const typeSet = types ? new Set(types) : null;
    const symbols = ids
      .map(id => this.nodes.get(id))
      .filter(Boolean)
      .filter(node => !filePath || node.filePath === filePath)
      .filter(node => !typeSet || typeSet.has(node.type));

    if (symbols.length > 0 || !filePath) return symbols;

    return ids
      .map(id => this.nodes.get(id))
      .filter(Boolean)
      .filter(node => !typeSet || typeSet.has(node.type));
  }

  findSymbol(name, options = {}) {
    return this.findSymbols(name, options)[0] || null;
  }

  /**
   * Get all functions in a file
   */
  getFileFunctions(filePath) {
    const nodeIds = this.fileIndex.get(filePath) || [];
    return nodeIds.map(id => this.nodes.get(id)).filter(Boolean).filter(node => CALLABLE_NODE_TYPES.has(node.type));
  }

  getFileSymbols(filePath) {
    const nodeIds = this.fileIndex.get(filePath) || [];
    return nodeIds.map(id => this.nodes.get(id)).filter(Boolean);
  }

  getFileExports(filePath) {
    const nodeIds = this.exports.get(filePath) || [];
    return nodeIds.map(id => this.nodes.get(id)).filter(Boolean);
  }

  getStateContext(nodeId, depth = 1) {
    return this.getDependencies(nodeId, depth)
      .filter(node => STATE_CONTEXT_TYPES.has(node.type) || node.exported);
  }

  getDependencyNeighborhood(nodeId, depth = 1) {
    this.resolveImportExportEdges();
    const dependencies = this.getDependencies(nodeId, depth);
    return {
      target: this.nodes.get(nodeId) || null,
      dependencies,
      stateContext: dependencies.filter(node => STATE_CONTEXT_TYPES.has(node.type) || node.exported),
      callableDependencies: dependencies.filter(node => CALLABLE_NODE_TYPES.has(node.type)),
    };
  }

  resolveImportExportEdges() {
    const importNodes = Array.from(this.nodes.values()).filter(node => node.type === 'import');
    const exportNodes = Array.from(this.nodes.values()).filter(node => node.exported);

    for (const importNode of importNodes) {
      for (const exportNode of exportNodes) {
        if (!this._importMatchesExport(importNode, exportNode)) continue;
        this.addEdge(importNode.id, exportNode.id);
        for (const dependentId of importNode.dependents) {
          this.addEdge(dependentId, exportNode.id);
        }
      }
    }
  }

  _importMatchesExport(importNode, exportNode) {
    if (!importNode || !exportNode || importNode.filePath === exportNode.filePath) return false;

    const importedName = importNode.importedName === 'default' ? importNode.name : importNode.importedName;
    if (importNode.importedName !== '*' && importedName !== exportNode.name && importNode.name !== exportNode.name) {
      return false;
    }

    if (!importNode.sourceModule) return true;
    if (!importNode.sourceModule.startsWith('.')) return false;

    const normalizedModule = stripKnownExtension(importNode.sourceModule.replace(/\\/g, '/').replace(/^\.\//u, ''));
    const normalizedFile = stripKnownExtension(exportNode.filePath.replace(/\\/g, '/'));
    return normalizedFile.endsWith(normalizedModule) || normalizedFile.endsWith(`${normalizedModule}/index`);
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
      exports: Array.from(this.exports.entries()),
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
    
    for (const [filePath, imports] of data.imports || []) {
      graph.imports.set(filePath, imports);
    }
    
    for (const [filePath, nodeIds] of data.fileIndex || []) {
      graph.fileIndex.set(filePath, nodeIds);
    }

    for (const [filePath, nodeIds] of data.exports || []) {
      graph.exports.set(filePath, nodeIds);
    }
    
    return graph;
  }
}

function dedupeNodes(nodes) {
  const seen = new Set();
  const deduped = [];
  for (const node of nodes) {
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    deduped.push(node);
  }
  return deduped;
}

function stripKnownExtension(filePath) {
  return filePath.replace(/\.(jsx|tsx|js|ts|mjs|cjs)$/iu, '');
}

// ─── Tree-sitter Parser Integration ───────────────────────────────────────────

export class ASTParser {
  constructor() {
    this.parser = new TreeSitter();
  }

  setLanguage(filePath) {
    if (filePath.endsWith('.tsx')) {
      this.parser.setLanguage(TypeScript.tsx);
    } else if (filePath.endsWith('.ts')) {
      this.parser.setLanguage(TypeScript.typescript);
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
    const graph = new ASTGraph(path.basename(filePath));
    
    const rootNode = tree.rootNode;
    const importNodes = this._extractImports(rootNode, graph, filePath, content);
    const functionNodes = this._extractFunctions(rootNode, filePath, content);
    const stateNodes = this._extractStateContext(rootNode, filePath, content);
    const exportNodes = this._extractExportSpecifiers(rootNode, filePath, content);
    
    for (const node of [...importNodes, ...functionNodes, ...stateNodes, ...exportNodes]) {
      graph.addNode(node);
    }
    
    this._extractSymbolEdges(rootNode, graph);
    
    return graph;
  }

  _extractFunctions(node, filePath, content) {
    const functions = [];

    this._walk(node, current => {
      if (current.type === 'function_declaration') {
        const nameNode = current.childForFieldName('name') || this._firstNamedChild(current, ['identifier']);
        if (nameNode) functions.push(this._symbolFromNode({
          name: nameNode.text,
          type: 'function',
          filePath,
          node: this._declarationNode(current),
          content,
          exported: this._isExported(current),
        }));
      } else if (current.type === 'method_definition') {
        const nameNode = current.childForFieldName('name') || this._firstNamedChild(current, ['property_identifier', 'identifier']);
        if (nameNode) functions.push(this._symbolFromNode({
          name: nameNode.text,
          type: 'method',
          filePath,
          node: current,
          content,
          exported: this._isExported(current),
        }));
      } else if (current.type === 'class_declaration') {
        const nameNode = current.childForFieldName('name') || this._firstNamedChild(current, ['identifier', 'type_identifier']);
        if (nameNode) functions.push(this._symbolFromNode({
          name: nameNode.text,
          type: 'class',
          filePath,
          node: this._declarationNode(current),
          content,
          exported: this._isExported(current),
        }));
      } else if (current.type === 'variable_declarator') {
        const valueNode = current.childForFieldName('value');
        if (!valueNode || !['arrow_function', 'function'].includes(valueNode.type)) return;

        const nameNode = current.childForFieldName('name');
        if (!nameNode || nameNode.type !== 'identifier') return;

        functions.push(this._symbolFromNode({
          name: nameNode.text,
          type: 'arrow',
          filePath,
          node: this._declarationNode(current),
          content,
          exported: this._isExported(current),
          valueKind: valueNode.type,
        }));
      }
    });
    
    return functions;
  }

  _extractStateContext(node, filePath, content) {
    const stateNodes = [];

    this._walk(node, current => {
      if (current.type === 'variable_declarator') {
        const valueNode = current.childForFieldName('value');
        if (valueNode && ['arrow_function', 'function'].includes(valueNode.type)) return;

        const nameNode = current.childForFieldName('name');
        if (!nameNode) return;

        const aliases = this._bindingNames(nameNode);
        const name = nameNode.type === 'identifier' ? nameNode.text : aliases.join(', ');
        if (!name) return;

        stateNodes.push(this._symbolFromNode({
          name,
          type: this._classifyVariableNode({ name, aliases, valueNode, exported: this._isExported(current) }),
          kind: 'state_context',
          filePath,
          node: this._declarationNode(current),
          content,
          exported: this._isExported(current),
          declarationKind: this._declarationKind(current),
          valueKind: this._calleeName(valueNode) || valueNode?.type || null,
          aliases,
        }));
      } else if (current.type === 'field_definition' || current.type === 'public_field_definition') {
        const nameNode = current.childForFieldName('property') || this._firstNamedChild(current, ['property_identifier', 'identifier']);
        if (!nameNode) return;

        stateNodes.push(this._symbolFromNode({
          name: nameNode.text,
          type: 'class_field',
          kind: 'state_context',
          filePath,
          node: current,
          content,
          exported: this._isExported(current),
        }));
      }
    });

    return stateNodes;
  }

  _extractImports(node, graph, filePath, content) {
    const importNodes = [];

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

        const importStatement = match.captures[0]?.node?.parent;
        for (const binding of this._importBindings(importStatement)) {
          importNodes.push(this._symbolFromNode({
            name: binding.localName,
            type: 'import',
            kind: 'state_context',
            filePath,
            node: importStatement,
            content,
            sourceModule: source,
            importedName: binding.importedName,
            aliases: binding.importedName === binding.localName ? [] : [binding.importedName],
          }));
        }
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

    return importNodes;
  }

  _extractExportSpecifiers(node, filePath, content) {
    const exportNodes = [];

    this._walk(node, current => {
      if (current.type !== 'export_statement') return;
      const hasDeclaration = Array.from({ length: current.namedChildCount }, (_, index) => current.namedChild(index))
        .some(child => ['function_declaration', 'class_declaration', 'lexical_declaration', 'variable_declaration'].includes(child.type));
      if (hasDeclaration) return;

      const exportedNames = new Set();
      this._walk(current, child => {
        if (child.type === 'identifier') exportedNames.add(child.text);
      });

      for (const name of exportedNames) {
        exportNodes.push(this._symbolFromNode({
          name,
          type: 'export',
          kind: 'state_context',
          filePath,
          node: current,
          content,
          exported: true,
          exportType: 'specifier',
        }));
      }
    });

    return exportNodes;
  }

  _extractSymbolEdges(rootNode, graph) {
    this._walk(rootNode, current => {
      const identifierName = this._edgeIdentifierName(current);
      if (!identifierName) return;

      const containingNode = this._findContainingCallable(graph, current);
      if (!containingNode) return;

      const candidates = graph.findSymbols(identifierName, { filePath: containingNode.filePath });
      for (const candidate of candidates) {
        if (!candidate || candidate.id === containingNode.id) continue;
        if (this._isSameDeclarationIdentifier(current, candidate)) continue;
        graph.addEdge(containingNode.id, candidate.id);
      }
    });
  }

  _edgeIdentifierName(node) {
    if (node.type === 'identifier') return node.text;
    if (node.type === 'property_identifier' && node.parent?.type === 'member_expression') {
      const objectNode = node.parent.childForFieldName('object') || node.parent.namedChild(0);
      if (objectNode?.type === 'this') return node.text;
    }
    return null;
  }

  _findContainingCallable(graph, syntaxNode) {
    const candidates = [];
    for (const node of graph.nodes.values()) {
      if (!CALLABLE_NODE_TYPES.has(node.type)) continue;
      if (node.startIndex === null || node.endIndex === null) continue;
      if (syntaxNode.startIndex >= node.startIndex && syntaxNode.endIndex <= node.endIndex) {
        candidates.push(node);
      }
    }

    candidates.sort((left, right) => (left.endIndex - left.startIndex) - (right.endIndex - right.startIndex));
    return candidates[0] || null;
  }

  _isSameDeclarationIdentifier(syntaxNode, graphNode) {
    return syntaxNode.startPosition.row === graphNode.startPosition?.row
      && syntaxNode.startPosition.column === graphNode.startPosition?.column
      && syntaxNode.text === graphNode.name;
  }

  _symbolFromNode({
    name,
    type,
    kind = null,
    filePath,
    node,
    content,
    exported = false,
    exportType = null,
    declarationKind = null,
    valueKind = null,
    sourceModule = null,
    importedName = null,
    aliases = [],
  }) {
    return new FunctionNode({
      name,
      type,
      kind,
      filePath,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      exported,
      exportType: exportType || (exported ? 'declaration' : null),
      declarationKind,
      valueKind,
      sourceModule,
      importedName,
      aliases,
      sourceText: content.slice(node.startIndex, node.endIndex),
    });
  }

  _walk(node, visitor) {
    visitor(node);
    for (let i = 0; i < node.namedChildCount; i += 1) {
      this._walk(node.namedChild(i), visitor);
    }
  }

  _firstNamedChild(node, types) {
    for (let i = 0; i < node.namedChildCount; i += 1) {
      const child = node.namedChild(i);
      if (types.includes(child.type)) return child;
    }
    return null;
  }

  _declarationNode(node) {
    let current = node;
    while (current.parent && ['variable_declarator', 'lexical_declaration', 'variable_declaration'].includes(current.parent.type)) {
      current = current.parent;
    }
    return current.parent?.type === 'export_statement' ? current.parent : current;
  }

  _isExported(node) {
    const declaration = this._declarationNode(node);
    return declaration.type === 'export_statement' || declaration.parent?.type === 'export_statement';
  }

  _declarationKind(node) {
    let current = node.parent;
    while (current) {
      if (['lexical_declaration', 'variable_declaration'].includes(current.type)) {
        return current.firstChild?.text || null;
      }
      current = current.parent;
    }
    return null;
  }

  _bindingNames(node) {
    if (node.type === 'identifier' || node.type === 'property_identifier') return [node.text];
    const names = [];
    this._walk(node, child => {
      if (child.type === 'identifier' || child.type === 'property_identifier') names.push(child.text);
    });
    return [...new Set(names)];
  }

  _calleeName(node) {
    if (!node || node.type !== 'call_expression') return null;
    const calleeNode = node.childForFieldName('function') || node.namedChild(0);
    if (!calleeNode) return null;
    if (calleeNode.type === 'identifier') return calleeNode.text;
    if (calleeNode.type === 'member_expression') {
      const property = calleeNode.childForFieldName('property') || calleeNode.namedChild(calleeNode.namedChildCount - 1);
      return property?.text || calleeNode.text;
    }
    return calleeNode.text;
  }

  _classifyVariableNode({ name, aliases = [], valueNode, exported }) {
    const calleeName = this._calleeName(valueNode) || '';
    const combinedName = [name, ...aliases].join(' ');

    if (/^use(State|Reducer)$/u.test(calleeName)) return 'hook_state';
    if (calleeName === 'useContext') return 'context_value';
    if (/^use[A-Z].*Store/u.test(calleeName) || /Store/u.test(combinedName) && /^use[A-Z]/u.test(calleeName)) return 'store_selector';
    if (/^use[A-Z]/u.test(calleeName)) return 'hook_value';
    if (exported && /createContext/u.test(calleeName)) return 'context_export';
    if (exported && (/create/u.test(calleeName) || /Store/u.test(combinedName))) return 'store_export';
    return 'variable';
  }

  _importBindings(importStatement) {
    if (!importStatement) return [];
    const bindings = [];

    this._walk(importStatement, node => {
      if (node.type === 'import_specifier') {
        const identifiers = [];
        this._walk(node, child => {
          if (child.type === 'identifier') identifiers.push(child.text);
        });
        if (identifiers.length > 0) {
          bindings.push({
            importedName: identifiers[0],
            localName: identifiers[identifiers.length - 1],
          });
        }
      } else if (node.type === 'namespace_import') {
        const nameNode = this._firstNamedChild(node, ['identifier']);
        if (nameNode) bindings.push({ importedName: '*', localName: nameNode.text });
      }
    });

    const clause = Array.from({ length: importStatement.namedChildCount }, (_, index) => importStatement.namedChild(index))
      .find(child => child.type === 'import_clause');
    const defaultIdentifier = clause?.namedChild(0);
    if (defaultIdentifier?.type === 'identifier') {
      bindings.unshift({ importedName: 'default', localName: defaultIdentifier.text });
    }

    return bindings.filter((binding, index, list) =>
      list.findIndex(candidate => candidate.localName === binding.localName) === index
    );
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
    
    merged.resolveImportExportEdges();
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
      astStateContext: [],
      astExports: [],
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
      // Get the first-hop graph neighborhood for editing context. Depth 1 keeps
      // prompts focused while still capturing hooks, stores, providers, and exports.
      const neighborhood = this.astGraph.getDependencyNeighborhood(targetNode.id, 1);
      results.astDependencies = neighborhood.callableDependencies;
      results.astStateContext = neighborhood.stateContext;
      // Get dependents (what calls this function)
      results.astDependents = this.astGraph.getDependents(targetNode.id, 1);
    }

    results.astExports = this.astGraph.getFileExports(targetFilePath);

    // Get related files from imports
    const imports = this.astGraph.imports.get(targetFilePath) || [];
    results.relatedFiles = imports.map(imp => imp.target);

    // 2. Embeddings fallback: Only if AST results are sparse
    const astResultCount = results.astDependencies.length + results.astDependents.length + results.astStateContext.length;
    
    if (astResultCount === 0 && query) {
      // Fall back to embeddings for semantic search
      const embedding = await this.embeddings.getEmbedding(query);

      // Enforce V6 Isolation: Never fetch user_env constraints
      const res = await pool.query(
        `SELECT id, file_path, node_name, content,
                1 - (embedding <=> $1::vector) as similarity
         FROM semantic_embeddings
         WHERE context_type != 'user_env'
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [`[${embedding.join(',')}]`]
      );

      results.embeddingResults = res.rows;
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

    if (results.astStateContext?.length > 0) {
      sections.push(`=== STATE CONTEXT (Hooks, Stores, Providers, Imports) ===
${results.astStateContext.map(d => `- ${d.name} (${d.type}${d.valueKind ? ` via ${d.valueKind}` : ''}) in ${d.filePath}:${d.startPosition.row}`).join('\n')}`);
    }

    if (results.astExports?.length > 0) {
      sections.push(`=== GLOBAL EXPORTS ===
${results.astExports.map(d => `- ${d.name} (${d.type}) in ${d.filePath}`).join('\n')}`);
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
