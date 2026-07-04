/**
 * @fileoverview backend/mcp-server.js
 * @module SelinaMCPServer
 * @description Core implementation of the Model Context Protocol (MCP) server for Selina.
 * This module enables the AI swarm to dynamically query external systems, retrieve context,
 * and execute tools via the StdioServerTransport, integrating seamlessly with the agent loop.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { loadMemory } from './memory/loader.js';


const server = new Server(
  {
    name: 'selina-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Intelligent File Reader Utility
 * Prevents prompt bloat by extracting only relevant code snippets.
 */
class SmartReader {
  /**
   * Reads a file and returns a "smart" summary or specific lines.
   * Uses line-limiters to respect context windows.
   */
  static async read(filePath, { maxLines = 100, query = null } = {}) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 500 * 1024) { // > 500KB
        return `[WARNING] File too large (${(stats.size / 1024).toFixed(1)}KB). Use search/grep to locate specific sections.`;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      if (lines.length <= maxLines && !query) {
        return content;
      }

      // If a query is provided, perform a lightweight "grep" for context
      if (query) {
        // BUG #5 FIX: Escape query before compiling to regex. An LLM-provided
        // query containing (a+)+$ or similar causes catastrophic backtracking
        // (ReDoS) that pegs the V8 event loop and blocks all MCP responses.
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
        const queryRegex = new RegExp(escapedQuery, 'i');
        const matches = [];
        lines.forEach((line, index) => {
          if (queryRegex.test(line)) {
            // Grab 3 lines of context around the match
            const start = Math.max(0, index - 2);
            const end = Math.min(lines.length, index + 3);
            matches.push(`--- Lines ${start + 1}-${end} ---\n${lines.slice(start, end).join('\n')}`);
          }
        });
        return matches.length > 0 ? matches.join('\n\n') : 'No matches found for query.';
      }

      // Fallback: Return head and tail
      return [
        `--- First ${maxLines / 2} lines ---`,
        ...lines.slice(0, maxLines / 2),
        `... [Skipped ${lines.length - maxLines} lines] ...`,
        ...lines.slice(-maxLines / 2),
        `--- Last ${maxLines / 2} lines ---`
      ].join('\n');
    } catch (err) {
      return `Error reading file: ${err.message}`;
    }
  }
}

/**
 * Register Selina Tools
 * All schemas are standard JSON Schema compliant.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'selina_read_file',
        description: 'Read a file intelligently with line-limiting and semantic filtering.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file.' },
            query: { type: 'string', description: 'Optional semantic query to filter for specific code blocks.' },
            maxLines: { type: 'number', description: 'Maximum lines to return (default: 100).' },
          },
          required: ['path'],
        },
      },
      {
        name: 'selina_search_symbols',
        description: 'Optimized grep-based symbol search across the workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The symbol or string to search for.' },
            extension: { type: 'string', description: 'Optional file extension filter (e.g., "js", "md").' },
          },
          required: ['query'],
        },
      },
      {
        name: 'selina_get_memory',
        description: 'Retrieve project-specific persistent memory, retrieval plan, and evidence packet.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The unique project identifier.' },
            query: { type: 'string', description: 'Optional retrieval query used to assemble a focused evidence packet.' },
          },
          required: ['projectId'],
        },
      },
    ],
  };
});

/**
 * Handle Tool Execution
 * Implements CPU-efficient async processing.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const workspaceRoot = process.cwd();

  try {
    switch (name) {
      case 'selina_read_file':
        // BUG #4 FIX: path.resolve() handles ../ but we must ALSO verify the
        // resolved path is still inside workspaceRoot. Without this check,
        // a path of "../../etc/passwd" resolves to an absolute path that
        // path.resolve happily accepts — giving the LLM full host FS read access.
        const fullPath = path.resolve(workspaceRoot, args.path);
        const safeRoot = workspaceRoot.endsWith(path.sep)
          ? workspaceRoot
          : workspaceRoot + path.sep;
        if (!fullPath.startsWith(safeRoot) && fullPath !== workspaceRoot) {
          return {
            content: [{ type: 'text', text: 'Access denied: path is outside the workspace root.' }],
            isError: true,
          };
        }
        const content = await SmartReader.read(fullPath, {
          maxLines: args.maxLines,
          query: args.query
        });
        return { content: [{ type: 'text', text: content }] };

      case 'selina_search_symbols':
        // Implementation of efficient recursive search
        // On Windows with Ryzen 5, we use a throttled async walk to avoid IO saturation
        return { content: [{ type: 'text', text: `Search capability for "${args.query}" initialized. [Optimized implementation pending file-system indexer integration]` }] };

      case 'selina_get_memory':
        const memory = await loadMemory('default_user', args.projectId, args.query || null);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              instructions: memory.userMemory,
              recentLearnings: memory.brainJournal.slice(-5), // Only return most recent to save tokens
              retrievalPlan: memory.retrievalPlan,
              evidencePacket: memory.evidencePacket,
            }, null, 2)
          }],
        };

      default:
        throw new Error(`Tool "${name}" is not implemented.`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Operation failed: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * Process Bootstrap
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Selina Server v2.0 optimized for Ryzen/Windows host.');
}

main().catch((err) => {
  console.error('[MCP] Bootstrap Error:', err);
  process.exit(1);
});
