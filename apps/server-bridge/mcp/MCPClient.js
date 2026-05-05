import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';

/**
 * MCPClient — High Reliability Implementation
 * 
 * Implements the Model Context Protocol (MCP) over JSON-RPC 2.0.
 * Designed for low-latency communication with external capability providers.
 */
class MCPClient {
  constructor(name, command, args = [], options = {}) {
    this.name = name;
    this.command = command;
    this.args = args;
    this.options = options;
    this.child = null;
    this.pendingRequests = new Map();
    this.capabilities = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`[MCP] Connecting to ${this.name}...`);
      this.child = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'inherit'],
        shell: true,
        env: this.options.env || process.env
      });

      this.child.stdout.on('data', (data) => {
        const responses = data.toString().split('\n').filter(l => l.trim());
        for (const res of responses) {
          try {
            const json = JSON.parse(res);
            if (this.pendingRequests.has(json.id)) {
              const { resolve } = this.pendingRequests.get(json.id);
              this.pendingRequests.delete(json.id);
              resolve(json.result);
            }
          } catch (e) {
            console.error(`[MCP] Malformed response from ${this.name}:`, res);
          }
        }
      });

      this.child.on('error', reject);
      this.child.on('exit', (code) => {
        console.warn(`[MCP] ${this.name} exited with code ${code}`);
      });

      // Initialize session
      this.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Vibe-Hub-Bridge', version: '6.0.0' }
      }).then(res => {
        this.capabilities = res.capabilities;
        resolve(res);
      }).catch(reject);
    });
  }

  async call(method, params = {}) {
    if (!this.child) throw new Error('MCP Client not connected');
    
    const id = uuid();
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async listTools() {
    return this.call('tools/list');
  }

  async executeTool(name, args) {
    return this.call('tools/call', { name, arguments: args });
  }

  disconnect() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

export default MCPClient;
