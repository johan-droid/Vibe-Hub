import { describe, expect, it } from 'vitest';
import { ASTGraph, ASTParser, HybridContextRetriever } from '../memory/ast-graph.js';

function mergeGraphs(graphs) {
  const merged = new ASTGraph('test');
  for (const graph of graphs) {
    for (const node of graph.nodes.values()) merged.addNode(node);
    for (const [callerId, calleeIds] of graph.edges) {
      for (const calleeId of calleeIds) merged.addEdge(callerId, calleeId);
    }
    for (const [filePath, imports] of graph.imports) {
      for (const importEdge of imports) merged.addImport(filePath, importEdge);
    }
  }
  merged.resolveImportExportEdges();
  return merged;
}

describe('AST graph state context', () => {
  it('captures React hooks, context values, imports, and exported providers as first-hop context', () => {
    const parser = new ASTParser();
    const graph = parser.parseFile('src/ApplicationHeader.jsx', `
      import { useHeaderStore } from './stores/headerStore';
      import { HeaderContext } from './HeaderProvider';
      export const HeaderThemeContext = createContext(null);
      export function ApplicationHeader() {
        const [open, setOpen] = useState(false);
        const user = useHeaderStore(state => state.user);
        const headerTheme = useContext(HeaderContext);
        return <header>{user.name}{open ? headerTheme.title : null}</header>;
      }
    `);

    const header = graph.findFunction('ApplicationHeader');
    const stateContext = graph.getStateContext(header.id, 1);

    expect(stateContext.map(node => node.name)).toEqual(expect.arrayContaining([
      'open, setOpen',
      'user',
      'headerTheme',
      'useHeaderStore',
      'HeaderContext',
    ]));
    expect(stateContext.map(node => node.type)).toEqual(expect.arrayContaining([
      'hook_state',
      'store_selector',
      'context_value',
      'import',
    ]));
    expect(graph.getFileExports('src/ApplicationHeader.jsx').map(node => node.name)).toEqual(expect.arrayContaining([
      'ApplicationHeader',
      'HeaderThemeContext',
    ]));
  });

  it('resolves imported store symbols to exported source nodes at dependency depth one', () => {
    const parser = new ASTParser();
    const headerGraph = parser.parseFile('src/ApplicationHeader.jsx', `
      import { useHeaderStore } from './stores/headerStore';
      export function ApplicationHeader() {
        const user = useHeaderStore(state => state.user);
        return <header>{user.name}</header>;
      }
    `);
    const storeGraph = parser.parseFile('src/stores/headerStore.js', `
      export const useHeaderStore = create((set) => ({
        user: null,
        setUser: (user) => set({ user }),
      }));
    `);
    const merged = mergeGraphs([headerGraph, storeGraph]);
    const header = merged.findFunction('ApplicationHeader');

    const dependencyNames = merged.getDependencyNeighborhood(header.id, 1).dependencies
      .map(node => `${node.name}:${node.type}:${node.filePath}`);

    expect(dependencyNames).toContain('useHeaderStore:store_export:src/stores/headerStore.js');
  });

  it('returns state context through the hybrid retriever without embedding fallback', async () => {
    const parser = new ASTParser();
    const graph = parser.parseFile('src/ApplicationHeader.jsx', `
      import { HeaderContext } from './HeaderProvider';
      export function ApplicationHeader() {
        const headerTheme = useContext(HeaderContext);
        return <header>{headerTheme.title}</header>;
      }
    `);
    const embeddings = { getEmbedding: async () => { throw new Error('Embedding fallback should not run.'); } };
    const retriever = new HybridContextRetriever(graph, embeddings);

    const context = await retriever.getContext('src/ApplicationHeader.jsx', 'ApplicationHeader', 'Fix ApplicationHeader provider bug');

    expect(context.astStateContext.map(node => node.name)).toEqual(expect.arrayContaining([
      'headerTheme',
      'HeaderContext',
    ]));
    expect(HybridContextRetriever.formatContext(context)).toContain('STATE CONTEXT');
  });
});
