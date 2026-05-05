import MCPClient from './MCPClient.js';
import path from 'path';
import { keyManager } from '../security/KeyManager.js';

/**
 * MCPManager — Principal Systems Architect Implementation
 * 
 * Central registry for all Model Context Protocol (MCP) connections.
 * Orchestrates cross-server tool discovery and execution.
 */
class MCPManager {
  constructor() {
    this.clients = new Map(); // name -> MCPClient
    this.tools = []; // Cached list of all available tools
  }

  /**
   * Registers a new MCP server connection
   */
  async registerServer(name, command, args = []) {
    try {
      const secrets = keyManager.getKey(`mcp_${name}`) || {};
      const env = { ...process.env, ...secrets };
      
      const client = new MCPClient(name, command, args, { env });
      await client.connect();
      this.clients.set(name, client);
      console.log(`[MCPManager] Successfully registered server: ${name}`);
      
      // Refresh global tool list
      await this.refreshTools();
      return true;
    } catch (error) {
      console.error(`[MCPManager] Failed to register ${name}:`, error);
      return false;
    }
  }

  async refreshTools() {
    let allTools = [];
    for (const [name, client] of this.clients.entries()) {
      try {
        const response = await client.listTools();
        if (response && response.tools) {
          const mapped = response.tools.map(t => ({
            ...t,
            serverName: name,
            uniqueId: `${name}:${t.name}`
          }));
          allTools = [...allTools, ...mapped];
        }
      } catch (e) {
        console.error(`[MCPManager] Failed to list tools for ${name}:`, e);
      }
    }
    this.tools = allTools;
    return this.tools;
  }

  /**
   * Execute a tool by its unique identifier
   */
  async callTool(uniqueId, args) {
    const [serverName, toolName] = uniqueId.split(':');
    const client = this.clients.get(serverName);
    
    if (!client) throw new Error(`MCP Server ${serverName} not found`);
    
    console.log(`[MCPManager] Calling tool ${toolName} on ${serverName}...`);
    return await client.executeTool(toolName, args);
  }

  getToolsForLLM() {
    return this.tools.map(t => ({
      name: t.uniqueId.replace(/:/g, '__'), // LLMs prefer snake_case or simple names
      description: t.description,
      parameters: t.inputSchema
    }));
  }

  listServers() {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      status: 'connected', 
      description: `MCP Server: ${name}`
    }));
  }
}

export const mcpManager = new MCPManager();

// Auto-register core local servers
const isWindows = process.platform === 'win32';
const nodePath = process.execPath;

// Example: Local File System MCP (if we have one, otherwise just placeholder)
// In a real scenario, we'd point to actual installed MCP servers.
/*
await mcpManager.registerServer(
  'local-fs',
  nodePath,
  [path.join(process.cwd(), 'node_modules', '@modelcontextprotocol/server-filesystem', 'dist', 'index.js'), process.cwd()]
);
*/
