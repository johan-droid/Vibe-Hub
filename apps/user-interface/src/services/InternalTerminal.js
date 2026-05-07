/**
 * InternalTerminal - WebContainer-based terminal service
 * 
 * Features:
 * - Multiple terminal sessions with unique IDs
 * - Command history and output buffering
 * - Agent tools for terminal interaction
 * - Session management (create, kill, list)
 */

export class InternalTerminal {
  constructor(vfsContainer) {
    this.vfs = vfsContainer;
    this.sessions = new Map();
    this.nextSessionId = 1;
  }

  /**
   * Create a new terminal session
   */
  async createSession(options = {}) {
    const sessionId = `term_${this.nextSessionId++}`;
    const session = {
      id: sessionId,
      name: options.name || `Terminal ${this.nextSessionId - 1}`,
      shell: options.shell || '/bin/bash',
      env: options.env || {},
      history: [],
      output: [],
      process: null,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    // Initialize shell process
    try {
      session.process = await this.vfs.instance.spawn(session.shell, [], {
        env: { ...process.env, ...session.env },
        terminal: {
          type: 'xterm-256color',
          cols: 80,
          rows: 24
        }
      });

      // Set up output capture
      this.setupOutputCapture(session);

      this.sessions.set(sessionId, session);
      console.log(`[Terminal] Created session: ${sessionId}`);
      return sessionId;
    } catch (err) {
      console.error(`[Terminal] Failed to create session:`, err);
      throw err;
    }
  }

  /**
   * Set up output capture for a terminal process
   */
  setupOutputCapture(session) {
    if (!session.process) return;

    let outputBuffer = '';
    
    // Capture stdout
    session.process.output.pipeTo(new WritableStream({
      write(data) {
        outputBuffer += data;
        session.output.push({
          type: 'stdout',
          data: data,
          timestamp: new Date()
        });
        session.lastActivity = new Date();
      }
    }));

    // Handle process exit
    session.process.exit.then((code) => {
      session.output.push({
        type: 'exit',
        data: `Process exited with code ${code}`,
        timestamp: new Date(),
        exitCode: code
      });
      session.isActive = false;
    });
  }

  /**
   * Execute a command in a terminal session
   */
  async executeCommand(sessionId, command, args = []) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    if (!session.isActive) {
      throw new Error(`Terminal session is not active: ${sessionId}`);
    }

    try {
      // Add command to history
      session.history.push({
        command: command,
        args: args,
        timestamp: new Date()
      });

      // Create a new process for the command
      const process = await this.vfs.instance.spawn(command, args, {
        env: { ...process.env, ...session.env },
        terminal: {
          type: 'xterm-256color',
          cols: 80,
          rows: 24
        }
      });

      let output = '';
      process.output.pipeTo(new WritableStream({
        write(data) {
          output += data;
          session.output.push({
            type: 'stdout',
            data: data,
            command: command,
            timestamp: new Date()
          });
        }
      }));

      const exitCode = await process.exit;
      
      session.output.push({
        type: 'command_complete',
        command: command,
        exitCode: exitCode,
        timestamp: new Date()
      });

      session.lastActivity = new Date();

      return {
        exitCode,
        output: output.trim()
      };
    } catch (err) {
      session.output.push({
        type: 'error',
        data: err.message,
        command: command,
        timestamp: new Date()
      });
      throw err;
    }
  }

  /**
   * Kill a terminal session
   */
  async killSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    if (session.process) {
      try {
        await session.process.kill();
      } catch (err) {
        console.warn(`[Terminal] Failed to kill process for session ${sessionId}:`, err);
      }
    }

    session.isActive = false;
    session.output.push({
      type: 'killed',
      data: 'Terminal session killed',
      timestamp: new Date()
    });

    console.log(`[Terminal] Killed session: ${sessionId}`);
  }

  /**
   * Get terminal session info
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      name: session.name,
      shell: session.shell,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      historyCount: session.history.length,
      outputCount: session.output.length
    };
  }

  /**
   * List all terminal sessions
   */
  listSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      name: session.name,
      shell: session.shell,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      historyCount: session.history.length,
      outputCount: session.output.length
    }));
  }

  /**
   * Get recent output from a session
   */
  getSessionOutput(sessionId, limit = 100) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.output.slice(-limit);
  }

  /**
   * Get command history from a session
   */
  getSessionHistory(sessionId, limit = 50) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.history.slice(-limit);
  }

  /**
   * Clean up inactive sessions
   */
  cleanup(maxAge = 3600000) { // 1 hour default
    const now = new Date();
    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive && (now - session.lastActivity) > maxAge) {
        this.sessions.delete(sessionId);
        console.log(`[Terminal] Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  /**
   * Agent tool: Execute shell command
   */
  async tool_executeShell(args) {
    const { command, args: cmdArgs = [], session = 'default' } = args;
    
    // Ensure session exists
    if (!this.sessions.has(session)) {
      await this.createSession({ name: session });
    }

    return await this.executeCommand(session, command, cmdArgs);
  }

  /**
   * Agent tool: List terminal sessions
   */
  async tool_listSessions() {
    return this.listSessions();
  }

  /**
   * Agent tool: Create terminal session
   */
  async tool_createSession(args) {
    const { name, shell = '/bin/bash' } = args;
    return await this.createSession({ name, shell });
  }

  /**
   * Agent tool: Kill terminal session
   */
  async tool_killSession(args) {
    const { session } = args;
    await this.killSession(session);
    return { success: true, message: `Killed session: ${session}` };
  }

  /**
   * Agent tool: Get session output
   */
  async tool_getOutput(args) {
    const { session, limit = 50 } = args;
    return this.getSessionOutput(session, limit);
  }
}

// Singleton instance
let terminalInstance = null;

export function getTerminal(vfsContainer) {
  if (!terminalInstance) {
    terminalInstance = new InternalTerminal(vfsContainer);
  }
  return terminalInstance;
}

// Auto-cleanup every 5 minutes
setInterval(() => {
  if (terminalInstance) {
    terminalInstance.cleanup();
  }
}, 300000);
