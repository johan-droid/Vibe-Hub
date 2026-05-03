import { WebContainer } from '@webcontainer/api';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

/**
 * VFS Container — Browser-Side WebContainer Executor (v3.0)
 * 
 * New tools:
 * - edit_file: Surgical search/replace editing
 * - grep_search: Text search across all files
 * - create_file: Renamed from write_file (for new files only)
 */

// A simple Promise queue to limit concurrency and avoid EMFILE errors
const pLimit = (concurrency) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve).catch(reject).finally(() => {
        active--;
        next();
      });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
};

export class VFSContainer {
  constructor() {
    this.instance = null;
  }

  async boot() {
    if (this.instance) return;
    this.instance = await WebContainer.boot();
    console.log('[VFS] WebContainer booted.');
  }

  async executeTool(name, args) {
    switch (name) {
      case 'list_files':
        return await this.listFiles(args.path);

      case 'read_file':
        return await this.readFileWithLines(args.path, args.start_line, args.end_line);

      case 'create_file':
        await this.checkpoint(`AI Checkpoint: Creating ${args.path}`);
        return await this.createFile(args.path, args.content);

      // Legacy support — redirect write_file to create_file
      case 'write_file':
        await this.checkpoint(`AI Checkpoint: Writing ${args.path}`);
        return await this.createFile(args.path, args.content);

      case 'edit_file':
        await this.checkpoint(`AI Checkpoint: Before editing ${args.path}`);
        return await this.editFile(args.path, args.edits);

      case 'grep_search':
        return await this.grepSearch(args.pattern, args.file_pattern);

      case 'search_symbols':
        return await this.searchSymbols(args.query, args.kind);

      case 'run_command': {
        let output = '';
        const process = await this.instance.spawn(args.command, args.args || []);
        process.output.pipeTo(new WritableStream({
          write(data) { output += data; }
        }));
        const exitCode = await process.exit;
        return { exitCode, output };
      }

      case 'git_clone':
        await git.clone({
          fs: this.instance.fs,
          http,
          dir: '/',
          url: args.url,
          singleBranch: true,
          depth: 1,
        });
        return `Cloned ${args.url}`;

      default:
        return `Unknown tool: ${name}`;
    }
  }

  /**
   * Create a Git checkpoint (commit) before risky operations.
   */
  async checkpoint(message) {
    try {
      const dir = '/';
      // Stage all changes first
      await git.add({ fs: this.instance.fs, dir, filepath: '.' });
      
      // Commit
      const sha = await git.commit({
        fs: this.instance.fs,
        dir,
        author: { name: 'Selina AI', email: 'ai@selina.internal' },
        message: message || 'AI Safety Checkpoint',
      });
      console.log(`[VFS] Checkpoint created: ${sha.slice(0, 7)}`);
      return sha;
    } catch (err) {
      console.warn('[VFS] Checkpoint failed (repo might not be initialized):', err.message);
      return null;
    }
  }

  /**
   * List files recursively (1 level deep), respecting .gitignore.
   */
  async listFiles(path) {
    try {
      const entries = await this.instance.fs.readdir(path, { withFileTypes: true });

      const ignoredResults = await Promise.all(
        entries.map((e) => {
          const fullPath = path === '.' ? e.name : `${path}/${e.name}`;
          return this.isPathIgnored(fullPath);
        })
      );

      return entries
        .filter((_, index) => !ignoredResults[index])
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
    } catch {
      return [];
    }
  }

  /**
   * Check if a path is ignored by Git.
   */
  async isPathIgnored(filepath) {
    try {
      // Hardcoded defaults for WebContainer speed
      // Using pre-compiled stateless regex for O(1) matching, avoiding slower .some() and .includes()
      // This also correctly matches whole directories, avoiding false positives like 'my_build.js'
      if (/(?:^|\/)(node_modules|\.git|dist|\.next|out|build)(?:\/|$)/.test(filepath)) {
        return true;
      }
      
      // Check .gitignore if repository exists
      return await git.isIgnored({
        fs: this.instance.fs,
        dir: '/',
        filepath,
      });
    } catch {
      return false;
    }
  }

  /**
   * Read file with optional line range.
   */
  async readFileWithLines(path, startLine, endLine) {
    const content = await this.instance.fs.readFile(path, 'utf-8');
    if (startLine || endLine) {
      const lines = content.split('\n');
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      return lines.slice(start, end).join('\n');
    }
    return content;
  }

  /**
   * Create a new file (with parent directory creation).
   */
  async createFile(path, content) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      try { await this.instance.fs.mkdir(dir, { recursive: true }); } catch {}
    }
    await this.instance.fs.writeFile(path, content);
    return `Created ${path} (${content.length} chars)`;
  }

  /**
   * Surgical edit: search/replace blocks on an existing file.
   * Each search string must be unique in the file.
   */
  async editFile(path, edits) {
    let content = await this.instance.fs.readFile(path, 'utf-8');
    const results = [];

    for (const edit of edits) {
      const occurrences = content.split(edit.search).length - 1;

      if (occurrences === 0) {
        results.push({
          status: 'error',
          search: edit.search.slice(0, 50) + '...',
          message: 'Search string not found in file.',
        });
        continue;
      }

      if (occurrences > 1) {
        results.push({
          status: 'error',
          search: edit.search.slice(0, 50) + '...',
          message: `Search string found ${occurrences} times — ambiguous. Add more context to make it unique.`,
        });
        continue;
      }

      content = content.replace(edit.search, edit.replace);
      results.push({
        status: 'ok',
        search: edit.search.slice(0, 50) + '...',
        message: 'Replaced successfully.',
      });
    }

    await this.instance.fs.writeFile(path, content);
    return { path, results };
  }

  /**
   * Grep: Search for a pattern across all files recursively, respecting .gitignore.
   */
  async grepSearch(pattern, filePattern) {
    const matches = [];
    // Remove 'g' flag to keep RegExp stateless for test(), avoiding expensive manual lastIndex resets
    const regex = new RegExp(pattern, 'i');

    const limit = pLimit(10);
    const walk = async (dir) => {
      try {
        const entries = await this.instance.fs.readdir(dir, { withFileTypes: true });

        // Process all checks and reads concurrently for speed
        await Promise.all(entries.map((entry) => limit(async () => {
          const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;

          if (await this.isPathIgnored(fullPath)) return;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            if (filePattern && !fullPath.match(new RegExp(filePattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m)).join('.*')))) return;

            try {
              const content = await this.instance.fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  if (matches.length >= 50) return; // Cap results
                  matches.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim().slice(0, 120),
                  });
                }
              }
            } catch {}
          }
        })));
      } catch {}
    };

    await walk('.');
    return matches.length > 0
      ? matches
      : `No matches found for "${pattern}"`;
  }

  /**
   * Semantic search: find function/class definitions.
   * Simple regex-based approach for common languages (JS, TS, Python).
   */
  async searchSymbols(query, kind) {
    const symbols = [];
    const patterns = {
      function: [
        /function\s+([a-zA-Z0-9_$]+)/g,
        /const\s+([a-zA-Z0-9_$]+)\s*=\s*(async\s+)?\(/g,
        /def\s+([a-zA-Z0-9_$]+)/g, // Python
      ],
      class: [
        /class\s+([a-zA-Z0-9_$]+)/g,
      ],
      variable: [
        /(const|let|var)\s+([a-zA-Z0-9_$]+)/g,
      ]
    };

    const targetPatterns = kind ? patterns[kind] : [...patterns.function, ...patterns.class];
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
    const queryRegex = new RegExp(escapedQuery, 'i');

    const walk = async (dir) => {
      try {
        const entries = await this.instance.fs.readdir(dir, { withFileTypes: true });

        await Promise.all(entries.map((entry) => limit(async () => {
          const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
          if (await this.isPathIgnored(fullPath)) return;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (fullPath.match(/\.(js|jsx|ts|tsx|py|go|rs|c|cpp|h)$/)) {
            const content = await this.instance.fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              for (const p of targetPatterns) {
                let match;
                while ((match = p.exec(lines[i])) !== null) {
                  const name = match[1];
                  if (queryRegex.test(name)) {
                    symbols.push({
                      name,
                      file: fullPath,
                      line: i + 1,
                      kind: kind || (p === patterns.class[0] ? 'class' : 'function'),
                    });
                  }
                }
                p.lastIndex = 0;
              }
            }
          }
        })));
      } catch {}
    };

    await walk('.');
    return symbols.length > 0 ? symbols : `No symbols found matching "${query}"`;
  }

  async getTree(path = '.') {
    return await this.listFiles(path);
  }

  async readFile(path) {
    return await this.instance.fs.readFile(path, 'utf-8');
  }
}
