import crypto from 'crypto';
import path from 'path';

export class SandboxExecutor {
  static async executeLocalDockerSandbox({ workspacePath, scriptPath, runtime = 'node', timeoutMs } = {}) {
    throw new Error('Local Docker sandboxing is not permitted. All code execution, unit testing, and sandboxing must be strictly offloaded to GitHub Actions.');
  }

  static async executeLocalDockerCommand({ workspacePath, command, args = [], timeoutMs } = {}) {
    throw new Error('Local Docker sandboxing is not permitted. All code execution, unit testing, and sandboxing must be strictly offloaded to GitHub Actions.');
  }
}

export default SandboxExecutor;
