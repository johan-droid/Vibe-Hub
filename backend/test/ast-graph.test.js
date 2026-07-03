import { describe, expect, it } from 'vitest';
import { ASTGraph, ASTParser, HybridContextRetriever } from '../memory/ast-graph.js';
import { InMemoryVectorStore, buildVectorCollectionName } from '../memory/vector-store.js';
import { TokenBudgetBroker } from '../memory/token-budget-broker.js';

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

  it('uses scoped semantic fallback through the vector store and caches repeated queries', async () => {
    const graph = new ASTGraph('test');
    const vectorStore = new InMemoryVectorStore();
    const collection = buildVectorCollectionName({
      projectName: 'test',
      tenantId: 'tenant-a',
      namespace: 'docs',
      indexVersion: 'v2',
    });
    const vector = [0.3, 0.8, 0.1];
    await vectorStore.upsert({
      collection,
      points: [
        {
          id: 'doc-1',
          vector,
          payload: {
            project_name: 'test',
            tenant_id: 'tenant-a',
            namespace: 'docs',
            index_version: 'v2',
            file_path: 'docs/api.md',
            node_name: 'PostRequestsContract',
            content: 'POST /api/v6/integration/code/run accepts prompt, targetFile, and effortLevel.',
          },
        },
      ],
    });

    let embeddingsCalls = 0;
    const retriever = new HybridContextRetriever(graph, {
      getEmbedding: async () => {
        embeddingsCalls += 1;
        return vector;
      },
    }, {
      vectorStore,
      projectName: 'test',
      tenantId: 'tenant-a',
      namespace: 'docs',
      indexVersion: 'v2',
      semanticCacheTtlSeconds: 60,
    });

    const first = await retriever.getContext('src/Empty.jsx', null, 'how do i post code run requests');
    const second = await retriever.getContext('src/Empty.jsx', null, 'how do i post code run requests');

    expect(first.embeddingResults[0]?.file_path).toBe('docs/api.md');
    expect(first.semanticScope?.collection).toBe(collection);
    expect(first.semanticCache?.hit).toBe(false);
    expect(second.semanticCache?.hit).toBe(true);
    expect(embeddingsCalls).toBe(1);
  });

  it('only reranks large semantic candidate sets and trims context to token budget', async () => {
    const graph = new ASTGraph('test');
    const vectorStore = new InMemoryVectorStore();
    const collection = buildVectorCollectionName({
      projectName: 'test',
      tenantId: 'tenant-a',
      namespace: 'docs',
      indexVersion: 'v3',
    });
    const baseVector = [0.5, 0.5, 0.5];
    const points = Array.from({ length: 7 }, (_, index) => ({
      id: `doc-${index}`,
      vector: baseVector,
      payload: {
        project_name: 'test',
        tenant_id: 'tenant-a',
        namespace: 'docs',
        index_version: 'v3',
        file_path: `docs/${index}.md`,
        node_name: `Doc${index}`,
        content: `Candidate ${index} ${'alpha '.repeat(30)}`,
      },
    }));
    await vectorStore.upsert({ collection, points });

    let rerankCalls = 0;
    const retriever = new HybridContextRetriever(graph, {
      getEmbedding: async () => baseVector,
    }, {
      vectorStore,
      projectName: 'test',
      tenantId: 'tenant-a',
      namespace: 'docs',
      indexVersion: 'v3',
      semanticCandidateLimit: 7,
      semanticRerankThreshold: 6,
      reranker: {
        rerank: async ({ candidates }) => {
          rerankCalls += 1;
          return [...candidates].reverse();
        },
      },
    });

    const context = await retriever.getContext('src/Empty.jsx', null, 'show me the docs');
    const formatted = HybridContextRetriever.formatContext(context, {
      tokenBudget: new TokenBudgetBroker(),
      maxTokens: 25,
    });

    expect(rerankCalls).toBe(1);
    expect(context.embeddingResults[0]?.file_path).toBe('docs/6.md');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted.length).toBeLessThan(400);
  });
});
