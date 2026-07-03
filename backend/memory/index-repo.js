import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { embeddingsService } from './embeddings.js';
import { ASTParser } from './ast-graph.js';
import { withTenantContext } from '../db.js';
import { activateSemanticIndexVersion } from './semantic-index-registry.js';

const targetDir = path.resolve(process.cwd(), '..', '..', 'apps');

async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory() && !['node_modules', '.git', 'dist', '.next', 'out', 'build'].includes(file.name)) {
      await walk(path.join(dir, file.name), fileList);
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.jsx'))) {
      fileList.push(path.join(dir, file.name));
    }
  }
  return fileList;
}

function determineContextType(filePath) {
  if (filePath.includes('/org_core/')) {
    return 'org_core';
  }
  if (filePath.includes('/user_env/')) {
    return 'user_env';
  }
  return 'ast_node';
}

async function indexRepo() {
  const projectName = process.env.SEMANTIC_INDEX_PROJECT_NAME || 'default';
  const namespace = process.env.SEMANTIC_INDEX_NAMESPACE || 'default';
  const tenantId = process.env.SEMANTIC_INDEX_TENANT_ID || 'shared';
  const indexVersion = process.env.SEMANTIC_INDEX_VERSION || 'live';
  const activateOnComplete = process.env.SEMANTIC_INDEX_ACTIVATE_ON_COMPLETE !== 'false';

  console.log('[Indexer] Starting full-repo traversal...');
  const files = await walk(targetDir);
  console.log(`[Indexer] Found ${files.length} .js/.jsx files.`);

  const cachePath = path.resolve(process.cwd(), 'data', '.index-cache.db');
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const db = new Database(cachePath);
  db.exec('CREATE TABLE IF NOT EXISTS file_hashes (filepath TEXT PRIMARY KEY, hash TEXT NOT NULL)');
  const getHash = db.prepare('SELECT hash FROM file_hashes WHERE filepath = ?');
  const setHash = db.prepare('INSERT INTO file_hashes (filepath, hash) VALUES (?, ?) ON CONFLICT(filepath) DO UPDATE SET hash = excluded.hash');

  const parser = new ASTParser();

  for (const file of files) {
    console.log(`[Indexer] Processing ${file}`);
    const content = await fs.readFile(file, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    const row = getHash.get(file);
    if (row && row.hash === contentHash) {
      console.log(`[Indexer] Skipping ${file} (unchanged)`);
      continue;
    }

    const contextType = determineContextType(file);

    let graph;
    try {
        graph = parser.parseFile(file, content);
    } catch(err) {
        console.error(`[Indexer] Error parsing ${file}:`, err.message);
        continue;
    }

    const nodes = Array.from(graph.nodes.values());
    await asyncPool(10, nodes, async (node) => {
      const nodeContent = `Name: ${node.name}\nType: ${node.type}\nFile: ${file}\nLine: ${node.startPosition.row}`;

      try {
        console.log(`[Indexer] Generating embedding for ${node.name} (${node.type})`);
        const vector = await embeddingsService.getEmbedding(nodeContent);

        await withTenantContext(tenantId, client => client.query(
          `INSERT INTO semantic_embeddings (
             id, project_name, tenant_id, namespace, index_version,
             file_path, node_id, node_name, node_type, context_type, content, embedding
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            uuid(),
            projectName,
            tenantId,
            namespace,
            indexVersion,
            file,
            node.id,
            node.name,
            node.type,
            contextType,
            nodeContent,
            `[${vector.join(',')}]`,
          ]
        ));
      } catch (err) {
        console.error(`[Indexer] Failed to process node ${node.name} in ${file}:`, err.message);
      }
    });
    
    setHash.run(file, contentHash);
  }
  
  db.close();
  if (activateOnComplete) {
    await activateSemanticIndexVersion({ projectName, tenantId, namespace, indexVersion });
  }
  console.log('[Indexer] Full-repo traversal complete.');
  process.exit(0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  indexRepo().catch(console.error);
}

export { indexRepo };
