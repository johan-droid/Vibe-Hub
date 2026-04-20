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
        return await this.createFile(args.path, args.content);

      // Legacy support — redirect write_file to create_file
      case 'write_file':
        return await this.createFile(args.path, args.content);

      case 'edit_file':
        return await this.editFile(args.path, args.edits);

      case 'grep_search':
        return await this.grepSearch(args.pattern, args.file_pattern);

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
   * List files recursively (1 level deep).
   */
  async listFiles(path) {
    try {
      const entries = await this.instance.fs.readdir(path, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
    } catch {
      return [];
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
   * Grep: Search for a pattern across all files recursively.
   */
  async grepSearch(pattern, filePattern) {
    const matches = [];
    const regex = new RegExp(pattern, 'gi');

    const walk = async (dir) => {
      try {
        const entries = await this.instance.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;

          // Skip node_modules, .git, dist
          if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            // Apply file pattern filter
            if (filePattern && !fullPath.match(new RegExp(filePattern.replace('*', '.*')))) continue;

            try {
              const content = await this.instance.fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');

              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matches.push({
                    file: fullPath,
                    line: i + 1,
                    content: lines[i].trim().slice(0, 120),
                  });
                  if (matches.length >= 50) return; // Cap results
                }
                regex.lastIndex = 0; // Reset global regex
              }
            } catch {
              // Binary file or unreadable — skip
            }
          }
        }
      } catch {}
    };

    await walk('.');
    return matches.length > 0
      ? matches
      : `No matches found for "${pattern}"`;
  }

  async getTree(path = '.') {
    return await this.listFiles(path);
  }

  async readFile(path) {
    return await this.instance.fs.readFile(path, 'utf-8');
  }
}
