import logger from '../utils/detailed-logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import semanticGraphBuilder from '../memory/loader.js';

const execPromise = promisify(exec);

/**
 * RepositoryManager — Principal Architect Implementation
 * 
 * Handles deep indexing of external repositories for agent context.
 * Implements a "local-first" mirror strategy to ensure zero-latency AST queries.
 */
class RepositoryManager {
  constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'repos');
    this.indexes = new Map(); // repoName -> astGraph
  }

  async init() {
    await fs.mkdir(this.storagePath, { recursive: true });
  }

  /**
   * Link a repository by URL
   */
  async linkRepository(repoUrl, userId) {
    const repoName = repoUrl.split('/').pop().replace('.git', '');
    const localPath = path.join(this.storagePath, userId, repoName);

    try {
      // Check if already exists
      const exists = await fs.access(localPath).then(() => true).catch(() => false);
      
      if (!exists) {
        logger.info('RepoManager', `Cloning ${repoUrl} to ${localPath}`);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await execPromise(`git clone --depth 1 ${repoUrl} ${localPath}`);
      } else {
        logger.info('RepoManager', `Updating ${repoName}`);
        await execPromise(`git -C ${localPath} pull`);
      }

      // Index the repo
      const graph = await this.indexRepository(localPath);
      this.indexes.set(`${userId}:${repoName}`, graph);

      return {
        id: repoName,
        name: repoName,
        path: localPath,
        indexedSymbols: Object.keys(graph).length
      };
    } catch (error) {
      logger.error('RepoManager', `Link failed:`, error);
      throw error;
    }
  }

  /**
   * Recursive AST indexing using tree-sitter (via existing loader.js)
   */
  async indexRepository(dirPath) {
    const graph = {};
    const files = await this.getFiles(dirPath);
    
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
        try {
          const fileGraph = await semanticGraphBuilder.buildSemanticGraph(file);
          graph[path.relative(dirPath, file)] = fileGraph;
        } catch (e) {
          // Skip files that fail to parse
        }
      }
    }
    return graph;
  }

  async getFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? this.getFiles(res) : res;
    }));
    return Array.prototype.concat(...files).filter(f => !f.includes('node_modules') && !f.includes('.git'));
  }

  getContext(userId, repoName) {
    return this.indexes.get(`${userId}:${repoName}`) || null;
  }

  async listRepositories(userId) {
    const userPath = path.join(this.storagePath, userId);
    try {
      const exists = await fs.access(userPath).then(() => true).catch(() => false);
      if (!exists) return [];
      
      const dirs = await fs.readdir(userPath);
      return dirs.map(name => ({
        id: name,
        name,
        path: path.join(userPath, name),
        type: 'repo'
      }));
    } catch (e) {
      return [];
    }
  }
}

export const repoManager = new RepositoryManager();
await repoManager.init();
