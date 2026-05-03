const { exec } = require('child_process');
const util = require('util');
const fs = require('fs/promises');
const path = require('path');
const execPromise = util.promisify(exec);

class SandboxExecutor {
  /**
   * Executes LLM-generated code in an isolated, ephemeral Docker container.
   * @param {string} codeToTest - The raw code string proposed by the LLM.
   */
  static async executeLocalDockerSandbox(codeToTest) {
    const sandboxId = `sandbox_${Date.now()}`;
    const sandboxDir = path.join(__dirname, '.temp', sandboxId);
    const fileName = 'agent_execution.js';
    const filePath = path.join(sandboxDir, fileName);

    try {
      // 1. Prepare isolated host directory
      await fs.mkdir(sandboxDir, { recursive: true });
      await fs.writeFile(filePath, codeToTest);

      // 2. Execute in an ephemeral Alpine Node container
      // --rm: Container is immediately purged upon exit
      // --network none: Cuts off internet access to prevent malicious execution
      // -v: Mounts only the specific test file
      const command = `docker run --rm --network none -v "${filePath}:/app/${fileName}" -w /app node:18-alpine node ${fileName}`;
      
      // Enforce a strict 10-second timeout to kill infinite loops
      const { stdout, stderr } = await execPromise(command, { timeout: 10000 });

      return {
        success: true,
        output: stdout.trim()
      };

    } catch (error) {
      // 3. Catch compilation errors or runtime crashes to feed the Rollback Loop
      const errorMsg = error.stderr ? error.stderr.trim() : error.message;
      return {
        success: false,
        error_trace: errorMsg
      };
    } finally {
      // 4. Purge the sandbox environment from the host to prevent bloat
      await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = SandboxExecutor;
