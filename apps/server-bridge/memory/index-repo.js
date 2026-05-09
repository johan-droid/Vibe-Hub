import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { embeddingsService } from './embeddings.js';
import { ASTParser } from './ast-graph.js';
import pool from '../db.js';

const targetDir = path.resolve(process.cwd(), '..', '..', 'apps');

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
  console.log('[Indexer] Starting full-repo traversal...');
  const files = await walk(targetDir);
  console.log(`[Indexer] Found ${files.length} .js/.jsx files.`);

  const parser = new ASTParser();

  for (const file of files) {
    console.log(`[Indexer] Processing ${file}`);
    const content = await fs.readFile(file, 'utf8');
    const contextType = determineContextType(file);

    let graph;
    try {
        graph = parser.parseFile(file, content);
    } catch(err) {
        console.error(`[Indexer] Error parsing ${file}:`, err.message);
        continue;
    }

    for (const [id, node] of graph.nodes) {
      const nodeContent = `Name: ${node.name}\nType: ${node.type}\nFile: ${file}\nLine: ${node.startPosition.row}`;

      try {
        console.log(`[Indexer] Generating embedding for ${node.name} (${node.type})`);
        const vector = await embeddingsService.getEmbedding(nodeContent);

        await pool.query(
          `INSERT INTO semantic_embeddings (id, project_name, file_path, node_id, node_name, node_type, context_type, content, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uuid(), 'default', file, node.id, node.name, node.type, contextType, nodeContent, `[${vector.join(',')}]`]
        );
      } catch (err) {
        console.error(`[Indexer] Failed to process node ${node.name} in ${file}:`, err.message);
      }
    }
  }
  console.log('[Indexer] Full-repo traversal complete.');
  process.exit(0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  indexRepo().catch(console.error);
}

export { indexRepo };
