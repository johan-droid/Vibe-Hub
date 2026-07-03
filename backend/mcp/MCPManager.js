import MCPClient from './MCPClient.js';
import path from 'path';
import { keyManager } from '../security/KeyManager.js';
import { validateToolArguments } from '../orchestrator/tool_schema.js';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';
import { browserAutomator } from '../vfs/browser_automator.js';
import { recordMcpToolCallMetric } from '../utils/metrics.js';
import logger from '../utils/detailed-logger.js';

/**
 * MCPManager — Principal Systems Architect Implementation
 * 
 * Central registry for all Model Context Protocol (MCP) connections.
 * Orchestrates cross-server tool discovery and execution.
 */
export class MCPManager {
  constructor() {
    this.clients = new Map(); // name -> MCPClient
    this.tools = []; // Cached list of all available tools
    this.localTools = new Map();
    this.serverStatus = new Map(); // name -> diagnostics
    this.lastRefreshAt = null;
    this.registerFirstPartyTools();
  }

  registerFirstPartyTools() {
    const firstPartyTools = [
      {
        name: 'goto',
        serverName: 'selina_browser',
        uniqueId: 'selina_browser:goto',
        description: 'Navigate the local browser automation layer to a local preview URL.',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url'],
        },
        risk: 'write',
        metadata: { risk: 'write', localOnly: true, approvalRequired: true },
        execute: async ({ url }) => {
          this.assertLocalPreviewUrl(url);
          return browserAutomator.goto(url);
        },
      },
      {
        name: 'screenshot',
        serverName: 'selina_browser',
        uniqueId: 'selina_browser:screenshot',
        description: 'Capture a screenshot from the local browser automation layer.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: [],
        },
        risk: 'readonly',
        metadata: { risk: 'readonly', localOnly: true },
        execute: async ({ path: screenshotPath } = {}) => browserAutomator.screenshot(screenshotPath),
      },
      {
        name: 'scan',
        serverName: 'selina_a11y',
        uniqueId: 'selina_a11y:scan',
        description: 'Run local accessibility checks against a local preview URL.',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url'],
        },
        risk: 'readonly',
        metadata: { risk: 'readonly', localOnly: true },
        execute: async ({ url }) => this.runA11yScan(url),
      },
    ];

    for (const tool of firstPartyTools) {
      this.localTools.set(tool.uniqueId, tool);
      this.serverStatus.set(tool.serverName, {
        name: tool.serverName,
        status: 'connected',
        command: 'first-party',
        toolCount: firstPartyTools.filter(item => item.serverName === tool.serverName).length,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
        firstParty: true,
      });
    }
  }

  assertLocalPreviewUrl(url) {
    const parsed = new URL(url);
    const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (!['http:', 'https:'].includes(parsed.protocol) || !allowedHosts.has(parsed.hostname)) {
      throw new Error('Browser and a11y MCP tools only accept local preview URLs.');
    }
  }

  async runA11yScan(url) {
    this.assertLocalPreviewUrl(url);
    const navigation = await browserAutomator.goto(url);
    if (navigation?.error) return { success: false, status: 'degraded', violations: [{ id: 'navigation', message: navigation.error }] };
    await browserAutomator.init();
    if (!browserAutomator.page) {
      return { success: false, status: 'degraded', violations: [{ id: 'browser', message: 'Browser not initialized' }] };
    }

    const result = await browserAutomator.page.evaluate(() => {
      const violations = [];
      if (!document.title?.trim()) violations.push({ id: 'document-title', message: 'Document title is missing.' });
      for (const img of Array.from(document.images)) {
        if (!img.hasAttribute('alt')) violations.push({ id: 'image-alt', message: `Image is missing alt text: ${img.currentSrc || img.src || 'inline image'}` });
      }
      for (const button of Array.from(document.querySelectorAll('button'))) {
        const label = button.textContent?.trim() || button.getAttribute('aria-label') || button.getAttribute('title');
        if (!label) violations.push({ id: 'button-name', message: 'Button is missing an accessible name.' });
      }
      for (const input of Array.from(document.querySelectorAll('input, textarea, select'))) {
        const id = input.getAttribute('id');
        const hasLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
        if (!hasLabel) violations.push({ id: 'form-label', message: `${input.tagName.toLowerCase()} is missing a label.` });
      }
      const landmark = document.querySelector('main, [role="main"]');
      if (!landmark) violations.push({ id: 'landmark-main', message: 'Page is missing a main landmark.' });
      return { violations };
    });

    return {
      success: true,
      status: result.violations.length ? 'degraded' : 'healthy',
      url,
      violations: result.violations,
    };
  }

  /**
   * Registers a new MCP server connection
   */
  async registerServer(name, command, args = []) {
    try {
      const secrets = keyManager.getKey(`mcp_${name}`) || {};
      const env = {
        ...sanitizeEnvironment(process.env, { inherit: 'core' }),
        ...secrets,
      };
      
      const client = new MCPClient(name, command, args, { env });
      await client.connect();
      this.clients.set(name, client);
      this.serverStatus.set(name, {
        name,
        status: 'connected',
        command,
        toolCount: 0,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
      });
      logger.info('MCPManager', `Successfully registered server: ${name}`);
      
      // Refresh global tool list
      await this.refreshTools();
      return true;
    } catch (error) {
      logger.error('MCPManager', `Failed to register ${name}`, error);
      this.serverStatus.set(name, {
        name,
        status: 'error',
        command,
        toolCount: 0,
        lastConnectedAt: null,
        lastError: error.message,
      });
      return false;
    }
  }

  async refreshTools() {
    let allTools = Array.from(this.localTools.values());
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
          const status = this.serverStatus.get(name) || { name };
          this.serverStatus.set(name, {
            ...status,
            status: 'connected',
            toolCount: mapped.length,
            lastRefreshAt: new Date().toISOString(),
            lastError: null,
          });
        }
      } catch (e) {
        logger.error('MCPManager', `Failed to list tools for ${name}`, e);
        const status = this.serverStatus.get(name) || { name };
        this.serverStatus.set(name, {
          ...status,
          status: 'degraded',
          lastError: e.message,
          lastRefreshAt: new Date().toISOString(),
        });
      }
    }
    this.tools = allTools;
    this.lastRefreshAt = new Date().toISOString();
    return this.tools;
  }

  /**
   * Execute a tool by its unique identifier
   */
  async callTool(uniqueId, args) {
    const localTool = this.localTools.get(uniqueId);
    if (localTool) {
      validateToolArguments(localTool, args, { strict: true });
      try {
        const result = await localTool.execute(args || {});
        recordMcpToolCallMetric(localTool.serverName, localTool.name, result?.error ? 'failed' : 'completed');
        return result;
      } catch (error) {
        recordMcpToolCallMetric(localTool.serverName, localTool.name, 'failed');
        throw error;
      }
    }

    const [serverName, toolName] = uniqueId.split(':');
    const client = this.clients.get(serverName);
    
    if (!client) throw new Error(`MCP Server ${serverName} not found`);
    const tool = this.tools.find(item => item.uniqueId === uniqueId);
    if (tool) validateToolArguments(tool, args, { strict: true });
    
    logger.info('MCPManager', `Calling tool ${toolName} on ${serverName}...`);
    try {
      const result = await client.executeTool(toolName, args);
      recordMcpToolCallMetric(serverName, toolName, 'completed');
      return result;
    } catch (error) {
      recordMcpToolCallMetric(serverName, toolName, 'failed');
      throw error;
    }
  }

  findToolByLLMName(toolName) {
    return this.tools.find(tool => tool.uniqueId.replace(/:/g, '__') === toolName);
  }

  getToolsForLLM() {
    return this.tools.map(t => ({
      name: t.uniqueId.replace(/:/g, '__'), // LLMs prefer snake_case or simple names
      description: t.description,
      parameters: t.inputSchema,
      serverName: t.serverName,
      uniqueId: t.uniqueId,
      risk: t.risk || t.metadata?.risk,
      metadata: t.metadata || {},
    }));
  }

  listServers() {
    return Array.from(this.serverStatus.values()).map(status => ({
      name: status.name,
      status: status.status,
      description: `MCP Server: ${status.name}`,
      toolCount: status.toolCount || 0,
      lastRefreshAt: status.lastRefreshAt || null,
      lastError: status.lastError || null,
    }));
  }

  diagnostics() {
    return {
      serverCount: this.serverStatus.size,
      toolCount: this.tools.length,
      lastRefreshAt: this.lastRefreshAt,
      servers: this.listServers(),
      tools: this.tools.map(tool => ({
        name: tool.name,
        uniqueId: tool.uniqueId,
        serverName: tool.serverName,
        description: tool.description,
      })),
    };
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
