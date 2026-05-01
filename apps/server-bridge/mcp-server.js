import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Vibe Hub MCP Server — Phase 3
 * 
 * Exposes Vibe Hub's advanced agentic capabilities to the wider AI ecosystem.
 */

const server = new Server(
  {
    name: 'vibe-hub-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools from Vibe Hub.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'vibe_search_symbols',
        description: 'Find function or class definitions across the Vibe Hub project.',
        inputSchema: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'The symbol name to search for.' },
          },
          required: ['query'],
        },
      },
      {
        name: 'vibe_cloud_sandbox',
        description: 'Spawn a GitHub Codespace for safe code validation.',
        inputSchema: {
          type: 'OBJECT',
          properties: {
            repo: { type: 'STRING', description: 'The repository name.' },
            branch: { type: 'STRING', description: 'The branch to use.' },
          },
          required: ['repo', 'branch'],
        },
      },
    ],
  };
});

/**
 * Handle tool calls.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.log(`[MCP] Tool called: ${name}`);

  try {
    switch (name) {
      case 'vibe_search_symbols':
        // Integration with our search logic
        return {
          content: [{ type: 'text', text: `Searching for symbol "${args.query}" in Vibe Hub...` }],
        };
      case 'vibe_cloud_sandbox':
        return {
          content: [{ type: 'text', text: `Spawning cloud sandbox for ${args.repo}/${args.branch}...` }],
        };
      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * Start the server using Stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('[MCP] Vibe Hub MCP Server running on stdio');
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
