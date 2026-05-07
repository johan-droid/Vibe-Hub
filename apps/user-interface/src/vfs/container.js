import { WebContainer } from '@webcontainer/api';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { getTerminal } from '../services/InternalTerminal.js';
import { getAgentLoop } from '../services/AgentLoop.js';

const IGNORED_PATHS_REGEX = /(?:^|\/)(node_modules|\.git|dist|\.next|out|build)(?:\/|$)/;
const MAX_SURGICAL_DELTA_CHARS = Number.parseInt(import.meta.env.VITE_SELINA_MAX_SURGICAL_DELTA_CHARS || '20000', 10);

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text || '');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function surgicalDeltaSize(searchContent = '', replacementContent = '') {
  return Math.abs(String(replacementContent).length - String(searchContent).length);
}

function deltaTooLarge(deltaSize) {
  return deltaSize > MAX_SURGICAL_DELTA_CHARS;
}

/**
 * VFS Container — Browser-Side WebContainer Executor (v3.0)
 * 
 * New tools:
 * - edit_file: Surgical search/replace editing
 * - grep_search: Text search across all files
 * - create_file: Renamed from write_file (for new files only)
 */

// Global singleton state for WebContainer (can only boot once per page)
let globalWebContainerInstance = null;
let globalBootPromise = null;
const globalBackgroundProcesses = new Map();

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
    // Use the global singleton instance if available
    this.instance = globalWebContainerInstance;
    this.terminal = null;
    this.agentLoop = null;
    this.readSnapshots = new Map();
  }

  async boot() {
    // Return existing promise if already booting (handles React StrictMode double-mount)
    if (globalBootPromise) {
      await globalBootPromise;
      this.instance = globalWebContainerInstance;
      this.terminal = getTerminal(this);
      this.agentLoop = getAgentLoop(this);
      return;
    }

    // Return early if already booted
    if (globalWebContainerInstance) {
      this.instance = globalWebContainerInstance;
      this.terminal = getTerminal(this);
      this.agentLoop = getAgentLoop(this);
      return;
    }

    // Create boot promise to prevent double-booting
    globalBootPromise = WebContainer.boot();
    
    try {
      globalWebContainerInstance = await globalBootPromise;
      this.instance = globalWebContainerInstance;
      this.terminal = getTerminal(this);
      this.agentLoop = getAgentLoop(this);

      // Track the active dev server URL for DOM snapshots
      this.instance.on('server-ready', (port, url) => {
        console.log(`[VFS] Server ready on port ${port}: ${url}`);
        window.__vibePreviewUrl = url;
      });
    } catch (err) {
      // Clear promise on error so we can retry
      globalBootPromise = null;
      throw err;
    }
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

      case 'replace_file_content':
        await this.checkpoint(`AI Checkpoint: Line replacement in ${args.TargetFile}`);
        return await this.replaceFileContent(args.TargetFile, args.StartLine, args.EndLine, args.TargetContent, args.ReplacementContent);

      case 'multi_replace_file_content':
        await this.checkpoint(`AI Checkpoint: Multi-line replacement in ${args.TargetFile}`);
        return await this.multiReplaceFileContent(args.TargetFile, args.ReplacementChunks);

      case 'grep_search':
        return await this.grepSearch(args.pattern, args.file_pattern);

      case 'search_symbols':
        return await this.searchSymbols(args.query, args.kind);

      case 'get_preview_dom':
        return await this.getPreviewDom();

      // Terminal tools
      case 'terminal_execute':
        return await this.terminal.tool_executeShell(args);

      case 'terminal_list_sessions':
        return await this.terminal.tool_listSessions();

      case 'terminal_create_session':
        return await this.terminal.tool_createSession(args);

      case 'terminal_kill_session':
        return await this.terminal.tool_killSession(args);

      case 'terminal_get_output':
        return await this.terminal.tool_getOutput(args);

      // Agent Loop tools
      case 'agent_loop_start':
        return await this.agentLoop.start(args);

      case 'agent_loop_stop':
        this.agentLoop.stop();
        return { success: true, message: 'Agent loop stopped' };

      case 'agent_loop_status':
        return {
          active: this.agentLoop.isActive(),
          history: this.agentLoop.getHistory()
        };

      case 'run_command': {
        let output = '';
        const process = await this.instance.spawn(args.command, args.args || []);
        const cmdId = Math.random().toString(36).substring(2, 10);
        
        let isDone = false;
        let exitCode = null;
        
        const processState = {
          process,
          writer: process.input.getWriter(),
          outputBuffer: '',
          status: 'running',
          exitCode: null
        };
        globalBackgroundProcesses.set(cmdId, processState);

        process.output.pipeTo(new WritableStream({
          write(data) { 
            output += data; 
            processState.outputBuffer += data;
            if (processState.outputBuffer.length > 50000) {
              processState.outputBuffer = processState.outputBuffer.slice(-50000);
            }
          }
        }));

        process.exit.then(code => {
          isDone = true;
          exitCode = code;
          processState.status = 'done';
          processState.exitCode = code;
        });

        if (args.WaitMsBeforeAsync) {
          await new Promise(resolve => setTimeout(resolve, args.WaitMsBeforeAsync));
          if (!isDone) {
             return { CommandId: cmdId, output, status: 'running' };
          }
        } else {
          exitCode = await process.exit;
        }
        
        globalBackgroundProcesses.delete(cmdId);
        return { exitCode, output };
      }

      case 'send_command_input': {
        const { CommandId, Input, Terminate, WaitMs } = args;
        const pState = globalBackgroundProcesses.get(CommandId);
        if (!pState) return { error: `Process ${CommandId} not found or already exited.` };
        
        if (Terminate) {
           pState.process.kill();
           return { success: true, message: 'Process terminated.' };
        }
        
        if (Input) {
           const beforeLen = pState.outputBuffer.length;
           await pState.writer.write(Input);
           if (WaitMs) await new Promise(r => setTimeout(r, WaitMs));
           const newOutput = pState.outputBuffer.slice(beforeLen);
           return { output: newOutput, status: pState.status };
        }
        return { error: 'No action specified.' };
      }

      case 'command_status': {
        const pState = globalBackgroundProcesses.get(args.CommandId);
        if (!pState) return { error: `Process ${args.CommandId} not found or already exited.` };
        return { 
          status: pState.status, 
          exitCode: pState.exitCode, 
          recentOutput: pState.outputBuffer.slice(-2000) 
        };
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

      case 'check_diagnostics': {
        try {
          // Fallback to checking via node if tsc is not globally available
          const process = await this.instance.spawn('npx', ['tsc', '--noEmit']);
          let output = '';
          process.output.pipeTo(new WritableStream({ write(data) { output += data; } }));
          const exitCode = await process.exit;
          return { exitCode, output };
        } catch (err) {
          return { error: `Failed to run diagnostics: ${err.message}` };
        }
      }

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
      return sha;
    } catch (err) {
      return null;
    }
  }

  async getPreviewDom() {
    if (!window.__vibePreviewUrl) {
      return { error: 'No active preview server running. Did you start the dev server?' };
    }
    
    try {
      // Fetch the rendered HTML from the dev server
      const response = await fetch(window.__vibePreviewUrl);
      if (!response.ok) {
        return { error: `Failed to fetch preview: ${response.statusText}` };
      }
      
      const html = await response.text();
      
      // Basic sanitization to remove massive inline scripts or SVGs to keep token usage low
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- script removed -->')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '<!-- svg removed -->')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '<!-- style removed -->');
        
      return { 
        url: window.__vibePreviewUrl,
        dom: cleanHtml 
      };
    } catch (err) {
      return { error: `Error fetching preview DOM: ${err.message}` };
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
      if (IGNORED_PATHS_REGEX.test(filepath)) {
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
    this.readSnapshots.set(path, {
      hash: await sha256Hex(content),
      readAt: Date.now(),
      length: content.length,
    });
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
    try {
      await this.instance.fs.readFile(path, 'utf-8');
      throw new Error(`Refusing to overwrite existing file ${path}. Read it first and use a surgical edit.`);
    } catch (error) {
      if (!/ENOENT|not found|no such file/i.test(error.message)) throw error;
    }

    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      try { await this.instance.fs.mkdir(dir, { recursive: true }); } catch {}
    }
    await this.instance.fs.writeFile(path, content);
    return `Created ${path} (${content.length} chars)`;
  }

  async assertFreshRead(path) {
    const snapshot = this.readSnapshots.get(path);
    if (!snapshot) {
      throw new Error(`Surgical edit rejected for ${path}: read_file must be called before editing.`);
    }

    const current = await this.instance.fs.readFile(path, 'utf-8');
    const currentHash = await sha256Hex(current);
    if (currentHash !== snapshot.hash) {
      throw new Error(`Surgical edit rejected for ${path}: file changed after read_file. Read it again before editing.`);
    }
    return current;
  }

  /**
   * Surgical edit: search/replace blocks on an existing file.
   * Each search string must be unique in the file.
   */
  async editFile(path, edits) {
    let content = await this.assertFreshRead(path);
    const results = [];
    let hasError = false;
    let totalDeltaSize = 0;

    for (const edit of edits) {
      const occurrences = content.split(edit.search).length - 1;
      totalDeltaSize += surgicalDeltaSize(edit.search, edit.replace);

      if (occurrences === 0) {
        results.push({
          status: 'error',
          search: edit.search.slice(0, 50) + '...',
          message: 'Search string not found in file.',
        });
        hasError = true;
        continue;
      }

      if (occurrences > 1) {
        results.push({
          status: 'error',
          search: edit.search.slice(0, 50) + '...',
          message: `Search string found ${occurrences} times — ambiguous. Add more context to make it unique.`,
        });
        hasError = true;
        continue;
      }

      content = content.replace(edit.search, edit.replace);
      results.push({
        status: 'ok',
        search: edit.search.slice(0, 50) + '...',
        message: 'Replaced successfully.',
      });
    }

    if (hasError) {
      return { path, results, rejected: true };
    }

    if (deltaTooLarge(totalDeltaSize)) {
      return {
        path,
        rejected: true,
        code: 'DELTA_TOO_LARGE',
        results: [{
          status: 'error',
          message: `Surgical edit delta ${totalDeltaSize} exceeds cap ${MAX_SURGICAL_DELTA_CHARS}. Split the change into smaller validated patches.`,
        }],
      };
    }

    await this.instance.fs.writeFile(path, content);
    this.readSnapshots.set(path, {
      hash: await sha256Hex(content),
      readAt: Date.now(),
      length: content.length,
    });
    return { path, results };
  }

  /**
   * Line-range based editing (replace_file_content)
   */
  async replaceFileContent(path, startLine, endLine, targetContent, replacementContent) {
    return await this.multiReplaceFileContent(path, [{
      StartLine: startLine,
      EndLine: endLine,
      TargetContent: targetContent,
      ReplacementContent: replacementContent
    }]);
  }

  /**
   * Multi-line replacements
   */
  async multiReplaceFileContent(path, chunks) {
    try {
      const content = await this.assertFreshRead(path);
      const lines = content.split('\n');
      let resultLines = [...lines];
      const results = [];
      let hasError = false;
      let totalDeltaSize = 0;
      
      // Sort chunks from bottom to top so line number shifts don't affect previous chunks
      const sortedChunks = [...chunks].sort((a, b) => b.StartLine - a.StartLine);

      for (const chunk of sortedChunks) {
        const startIdx = chunk.StartLine - 1;
        const endIdx = chunk.EndLine - 1;
        
        if (startIdx < 0 || endIdx >= lines.length || startIdx > endIdx) {
          results.push({ status: 'error', message: `Invalid line range ${chunk.StartLine}-${chunk.EndLine} (file has ${lines.length} lines)` });
          hasError = true;
          continue;
        }

        const chunkText = lines.slice(startIdx, endIdx + 1).join('\n');

        if (chunkText !== chunk.TargetContent) {
          results.push({ status: 'error', message: `Exact precondition failed for lines ${chunk.StartLine}-${chunk.EndLine}` });
          hasError = true;
          continue;
        }

        totalDeltaSize += surgicalDeltaSize(chunk.TargetContent, chunk.ReplacementContent);
        const replacedChunkLines = chunk.ReplacementContent.split('\n');
        // Splice the new lines into our result array
        resultLines.splice(startIdx, endIdx - startIdx + 1, ...replacedChunkLines);
        
        results.push({ status: 'ok', message: `Replaced content at lines ${chunk.StartLine}-${chunk.EndLine}` });
      }

      if (hasError) {
        return { path, results, rejected: true };
      }

      if (deltaTooLarge(totalDeltaSize)) {
        return {
          path,
          rejected: true,
          code: 'DELTA_TOO_LARGE',
          results: [{
            status: 'error',
            message: `Surgical edit delta ${totalDeltaSize} exceeds cap ${MAX_SURGICAL_DELTA_CHARS}. Split the change into smaller validated patches.`,
          }],
        };
      }

      await this.instance.fs.writeFile(path, resultLines.join('\n'));
      this.readSnapshots.set(path, {
        hash: await sha256Hex(resultLines.join('\n')),
        readAt: Date.now(),
        length: resultLines.join('\n').length,
      });
      return { path, results };
    } catch (err) {
      return { path, results: [{ status: 'error', message: err.message }] };
    }
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
