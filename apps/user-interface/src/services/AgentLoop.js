/**
 * Agent Loop - Automated Code Execution and Debugging System
 * 
 * Architecture:
 * 1. Generate/modify code files
 * 2. Execute command in hidden terminal
 * 3. Capture stdout, stderr, exit code
 * 4. Parse output, check for errors
 * 5. If errors → fix code → rerun
 * 6. If success → present result
 */

export class AgentLoop {
  constructor(vfsContainer, onProgress, onComplete, onError) {
    this.vfs = vfsContainer;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
    this.isRunning = false;
    this.currentIteration = 0;
    this.maxIterations = 10;
    this.sessionId = null;
    this.history = [];
  }

  /**
   * Start the agent loop with initial code and command
   */
  async start({ files, command, args = [], options = {} }) {
    if (this.isRunning) {
      throw new Error('Agent loop is already running');
    }

    this.isRunning = true;
    this.currentIteration = 0;
    this.maxIterations = options.maxIterations || 10;
    this.sessionId = `agent_loop_${Date.now()}`;
    this.history = [];

    try {
      // Create hidden terminal session
      await this.vfs.terminal.tool_createSession({
        name: this.sessionId,
        shell: '/bin/bash'
      });

      // Write initial files
      await this.writeFiles(files);

      // Execute and iterate
      const result = await this.executeAndIterate(command, args, options);

      this.onComplete(result);
      return result;
    } catch (err) {
      this.onError(err);
      throw err;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Write multiple files to the workspace
   */
  async writeFiles(files) {
    this.log('Writing files...', 'info');
    
    for (const [path, content] of Object.entries(files)) {
      await this.vfs.executeTool('create_file', {
        path,
        content
      });
      this.log(`Created: ${path}`, 'success');
    }
  }

  /**
   * Execute command and iterate on errors
   */
  async executeAndIterate(command, args, options) {
    let lastError = null;
    let lastOutput = null;

    while (this.currentIteration < this.maxIterations && this.isRunning) {
      this.currentIteration++;
      
      this.log(`Iteration ${this.currentIteration}: Executing ${command} ${args.join(' ')}`, 'info');

      // Execute command
      const result = await this.vfs.terminal.tool_executeShell({
        command,
        args,
        session: this.sessionId
      });

      lastOutput = result.output;
      
      // Parse output for errors
      const errors = this.parseErrors(result.output, options.language);
      
      if (errors.length === 0 && result.exitCode === 0) {
        // Success!
        this.log(`✅ Success! Command completed with exit code 0`, 'success');
        return {
          success: true,
          output: result.output,
          exitCode: result.exitCode,
          iterations: this.currentIteration,
          history: this.history
        };
      }

      // Handle errors
      lastError = errors[0] || { message: `Command failed with exit code ${result.exitCode}` };
      this.log(`❌ Error detected: ${lastError.message}`, 'error');

      // Add to history
      this.history.push({
        iteration: this.currentIteration,
        command,
        args,
        output: result.output,
        exitCode: result.exitCode,
        errors: errors,
        timestamp: new Date()
      });

      // Try to fix the errors
      if (this.currentIteration < this.maxIterations) {
        this.log('Attempting to fix errors...', 'info');
        const fixResult = await this.attemptFix(errors, result.output, options);
        
        if (!fixResult.success) {
          this.log('Could not auto-fix errors', 'warning');
          break;
        }
        
        this.log(`Applied fixes to ${fixResult.fixedFiles.length} files`, 'success');
      }
    }

    // Max iterations reached or couldn't fix
    return {
      success: false,
      output: lastOutput,
      exitCode: lastError?.exitCode || 1,
      iterations: this.currentIteration,
      errors: [lastError],
      history: this.history
    };
  }

  /**
   * Parse errors from command output
   */
  parseErrors(output, language = 'auto') {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const error = this.extractError(line, language);
      if (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Extract error information from a line
   */
  extractError(line, language) {
    // Python errors
    const pythonMatch = line.match(/^(.*?):(\d+):\s*(.*)$/);
    if (pythonMatch && line.includes('Error')) {
      return {
        type: 'python',
        file: pythonMatch[1],
        line: parseInt(pythonMatch[2]),
        message: pythonMatch[3],
        raw: line
      };
    }

    // JavaScript/Node errors
    const jsMatch = line.match(/^(.*?):(\d+):\s*(.*)$/);
    if (jsMatch && (line.includes('Error') || line.includes('ReferenceError') || line.includes('TypeError'))) {
      return {
        type: 'javascript',
        file: jsMatch[1],
        line: parseInt(jsMatch[2]),
        message: jsMatch[3],
        raw: line
      };
    }

    // TypeScript errors
    const tsMatch = line.match(/^error TS(\d+):\s*(.*)$/);
    if (tsMatch) {
      return {
        type: 'typescript',
        code: tsMatch[1],
        message: tsMatch[2],
        raw: line
      };
    }

    // Go errors
    const goMatch = line.match(/^^(.*?):(\d+):\d+:\s*(.*)$/);
    if (goMatch) {
      return {
        type: 'go',
        file: goMatch[1],
        line: parseInt(goMatch[2]),
        message: goMatch[3],
        raw: line
      };
    }

    // Generic error patterns
    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
      return {
        type: 'generic',
        message: line.trim(),
        raw: line
      };
    }

    return null;
  }

  /**
   * Attempt to fix detected errors
   */
  async attemptFix(errors, output, options) {
    const fixedFiles = [];
    
    for (const error of errors) {
      try {
        const fix = await this.generateFix(error, output, options);
        if (fix && fix.success) {
          await this.applyFix(fix);
          fixedFiles.push(fix.file);
        }
      } catch (err) {
        this.log(`Failed to fix error in ${error.file || 'unknown'}: ${err.message}`, 'error');
      }
    }

    return {
      success: fixedFiles.length > 0,
      fixedFiles
    };
  }

  /**
   * Generate a fix for an error
   */
  async generateFix(error, output, options) {
    const { type, file, line, message } = error;

    switch (type) {
      case 'python':
        return await this.fixPythonError(error, output);
      
      case 'javascript':
      case 'typescript':
        return await this.fixJSError(error, output);
      
      case 'go':
        return await this.fixGoError(error, output);
      
      default:
        return await this.fixGenericError(error, output);
    }
  }

  /**
   * Fix Python errors
   */
  async fixPythonError(error, output) {
    const { file, line, message } = error;

    // Read the file
    const content = await this.vfs.executeTool('read_file', { path: file });
    const lines = content.split('\n');

    // Common Python fixes
    if (message.includes('NameError')) {
      // Missing variable or import
      const varName = message.match(/name '(\w+)' is not defined/)?.[1];
      if (varName) {
        // Try to add import at top
        const importLine = `import ${varName}`;
        if (!content.includes(importLine)) {
          lines.unshift(importLine);
          return {
            success: true,
            file,
            line: 1,
            original: content,
            fixed: lines.join('\n'),
            fix: `Added import: ${importLine}`
          };
        }
      }
    }

    if (message.includes('IndentationError')) {
      // Fix indentation
      const errorLine = lines[line - 1];
      const fixedLine = '    ' + errorLine.trim();
      lines[line - 1] = fixedLine;
      return {
        success: true,
        file,
        line,
        original: errorLine,
        fixed: fixedLine,
        fix: 'Fixed indentation'
      };
    }

    if (message.includes('SyntaxError')) {
      // Try to fix common syntax errors
      const errorLine = lines[line - 1];
      
      // Missing colon
      if (errorLine.includes('if') && !errorLine.endsWith(':')) {
        lines[line - 1] = errorLine + ':';
        return {
          success: true,
          file,
          line,
          original: errorLine,
          fixed: errorLine + ':',
          fix: 'Added missing colon'
        };
      }
    }

    return null;
  }

  /**
   * Fix JavaScript/TypeScript errors
   */
  async fixJSError(error, output) {
    const { file, line, message } = error;

    const content = await this.vfs.executeTool('read_file', { path: file });
    const lines = content.split('\n');

    // Common JS fixes
    if (message.includes('ReferenceError')) {
      const varName = message.match(/(\w+) is not defined/)?.[1];
      if (varName) {
        // Try to add const/let declaration
        const errorLine = lines[line - 1];
        const fixedLine = `const ${varName} = {}; /* Selina review required: initialize with the correct domain value */\n${errorLine}`;
        lines[line - 1] = fixedLine;
        return {
          success: true,
          file,
          line,
          original: errorLine,
          fixed: fixedLine,
          fix: `Added variable declaration for ${varName}`
        };
      }
    }

    if (message.includes('TypeError')) {
      // Common type errors
      if (message.includes('is not a function')) {
        // Try to add function declaration
        const errorLine = lines[line - 1];
        const funcName = message.match(/(\w+) is not a function/)?.[1];
        if (funcName) {
          const funcDecl = `function ${funcName}() { throw new Error('Selina review required: implement ${funcName}'); }\n`;
          lines.unshift(funcDecl);
          return {
            success: true,
            file,
            line: 1,
            original: content,
            fixed: lines.join('\n'),
            fix: `Added function declaration for ${funcName}`
          };
        }
      }
    }

    return null;
  }

  /**
   * Fix Go errors
   */
  async fixGoError(error, output) {
    const { file, line, message } = error;

    const content = await this.vfs.executeTool('read_file', { path: file });
    const lines = content.split('\n');

    // Common Go fixes
    if (message.includes('undefined')) {
      // Add variable declaration
      const varName = message.match(/undefined: (\w+)/)?.[1];
      if (varName) {
        const errorLine = lines[line - 1];
        const fixedLine = `var ${varName} string // Selina review required: initialize with the correct domain value\n${errorLine}`;
        lines[line - 1] = fixedLine;
        return {
          success: true,
          file,
          line,
          original: errorLine,
          fixed: fixedLine,
          fix: `Added variable declaration for ${varName}`
        };
      }
    }

    if (message.includes('missing return')) {
      // Add return statement
      const errorLine = lines[line - 1];
      const fixedLine = `${errorLine}\nreturn nil`;
      lines[line] = fixedLine;
      return {
        success: true,
        file,
        line: line + 1,
        original: '',
        fixed: 'return nil',
        fix: 'Added return statement'
      };
    }

    return null;
  }

  /**
   * Fix generic errors
   */
  async fixGenericError(error, output) {
    // Try to infer fixes from common patterns
    const { message } = error;

    if (message.includes('permission denied')) {
      return {
        success: true,
        fix: 'Make sure files have proper permissions',
        suggestion: 'chmod +x file'
      };
    }

    if (message.includes('command not found')) {
      const cmd = message.match(/command not found: (.+)/)?.[1];
      if (cmd) {
        return {
          success: true,
          fix: `Install missing command: ${cmd}`,
          suggestion: `apt-get install ${cmd} || npm install -g ${cmd}`
        };
      }
    }

    return null;
  }

  /**
   * Apply a fix to the code
   */
  async applyFix(fix) {
    if (fix.file && fix.original !== undefined && fix.fixed !== undefined) {
      await this.vfs.executeTool('edit_file', {
        path: fix.file,
        edits: [{
          search: fix.original,
          replace: fix.fixed
        }]
      });
      this.log(`Fixed ${fix.file}: ${fix.fix}`, 'success');
    }
  }

  /**
   * Log progress
   */
  log(message, level = 'info') {
    const logEntry = {
      message,
      level,
      timestamp: new Date(),
      iteration: this.currentIteration
    };
    
    this.history.push(logEntry);
    this.onProgress?.(logEntry);
  }

  /**
   * Stop the agent loop
   */
  stop() {
    this.isRunning = false;
    this.log('Agent loop stopped', 'info');
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.isRunning = false;
    
    if (this.sessionId) {
      try {
        await this.vfs.terminal.tool_killSession({ session: this.sessionId });
      } catch (err) {
        // Session might already be dead
      }
    }
  }

  /**
   * Get execution history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Check if loop is running
   */
  isActive() {
    return this.isRunning;
  }
}

// Singleton instance
let agentLoopInstance = null;

export function getAgentLoop(vfsContainer, onProgress, onComplete, onError) {
  if (!agentLoopInstance) {
    agentLoopInstance = new AgentLoop(vfsContainer, onProgress, onComplete, onError);
  }
  return agentLoopInstance;
}
