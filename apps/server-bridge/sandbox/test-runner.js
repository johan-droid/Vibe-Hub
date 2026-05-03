/**
 * Test Runner — Ephemeral Docker-based Testing v6
 * =================================================
 *
 * Orchestrates the testing flow:
 *   1. Spin up Alpine container
 *   2. Inject generated code
 *   3. Run npm install / build / test
 *   4. Capture output
 *   5. Destroy container
 *   6. Return structured result
 */

import { dockerClient } from './docker-client.js';
import { v4 as uuid } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// ─── Test Configuration ───────────────────────────────────────────────────────

const TEST_CONFIG = {
  defaultTimeout: 120000, // 2 minutes
  buildCommands: {
    node: ['npm install', 'npm run build'],
    test: ['npm test'],
    lint: ['npm run lint']
  }
};

// ─── Test Runner ────────────────────────────────────────────────────────────

export class SandboxTestRunner {
  constructor() {
    this.testRuns = new Map(); // id -> testRunInfo
  }

  /**
   * Run a complete test cycle in an ephemeral container
   * 
   * @param {Object} options
   * @param {string} options.projectPath - Local path to project
   * @param {string} options.testType - 'build' | 'test' | 'lint' | 'full'
   * @param {Object} options.codeChanges - Map of file paths to new content
   * @param {Function} options.onProgress - Callback for progress updates
   * @returns {Promise<TestResult>}
   */
  async runTest({ projectPath, testType = 'build', codeChanges = {}, onProgress }) {
    const testId = uuid();
    const tempDir = await this._createTempProject(projectPath, codeChanges);
    
    const sendProgress = (stage, message) => {
      if (onProgress) onProgress({ testId, stage, message });
    };

    sendProgress('setup', 'Creating ephemeral test environment...');

    let container = null;
    const startTime = Date.now();

    try {
      // 1. Create container
      container = await dockerClient.createContainer(tempDir, {
        NODE_ENV: 'test',
        CI: 'true'
      });

      sendProgress('container', `Container ${container.name} ready`);

      const results = {
        testId,
        containerId: container.id,
        stages: {},
        exitCode: 0,
        success: true,
        duration: 0,
        logs: []
      };

      // 2. Run npm install
      sendProgress('install', 'Installing dependencies...');
      const installResult = await this._runStage(container.id, 'npm install', 'install');
      results.stages.install = installResult;
      results.logs.push({ stage: 'install', ...installResult });

      if (installResult.exitCode !== 0) {
        results.success = false;
        results.exitCode = installResult.exitCode;
        return results;
      }

      // 3. Run build
      if (['build', 'full'].includes(testType)) {
        sendProgress('build', 'Running build...');
        const buildResult = await this._runStage(container.id, 'npm run build', 'build');
        results.stages.build = buildResult;
        results.logs.push({ stage: 'build', ...buildResult });

        if (buildResult.exitCode !== 0) {
          results.success = false;
          results.exitCode = buildResult.exitCode;
          return results;
        }
      }

      // 4. Run tests
      if (['test', 'full'].includes(testType)) {
        sendProgress('test', 'Running test suite...');
        const testResult = await this._runStage(container.id, 'npm test', 'test');
        results.stages.test = testResult;
        results.logs.push({ stage: 'test', ...testResult });

        if (testResult.exitCode !== 0) {
          results.success = false;
          results.exitCode = testResult.exitCode;
          return results;
        }
      }

      // 5. Run lint
      if (['lint', 'full'].includes(testType)) {
        sendProgress('lint', 'Running linter...');
        const lintResult = await this._runStage(container.id, 'npm run lint', 'lint');
        results.stages.lint = lintResult;
        results.logs.push({ stage: 'lint', ...lintResult });

        if (lintResult.exitCode !== 0) {
          results.success = false;
          results.exitCode = lintResult.exitCode;
          return results;
        }
      }

      results.duration = Date.now() - startTime;
      sendProgress('complete', `All tests passed in ${results.duration}ms`);
      
      return results;

    } catch (err) {
      return {
        testId,
        containerId: container?.id,
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
        logs: [{ stage: 'error', message: err.message }]
      };
    } finally {
      // 6. Cleanup
      if (container) {
        sendProgress('cleanup', 'Destroying test environment...');
        await dockerClient.destroyContainer(container.id);
      }
      
      // Cleanup temp directory
      await this._cleanupTemp(tempDir);
    }
  }

  /**
   * Quick validation - just syntax check without full container
   */
  async quickValidate(code, language = 'javascript') {
    const testId = uuid();
    const tempFile = path.join(os.tmpdir(), `selina-quick-${testId}.js`);

    try {
      await fs.writeFile(tempFile, code);

      if (language === 'javascript' || language === 'typescript') {
        const { stdout, stderr } = await execAsync(`node --check "${tempFile}"`);
        return {
          valid: stderr.length === 0,
          errors: stderr || null
        };
      }

      return { valid: true, errors: null };
    } catch (err) {
      return {
        valid: false,
        errors: err.message
      };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  async _createTempProject(basePath, codeChanges) {
    const tempDir = path.join(os.tmpdir(), `selina-sandbox-${uuid().slice(0, 8)}`);
    
    // Copy base project
    await this._copyDir(basePath, tempDir);
    
    // Apply code changes
    for (const [filePath, content] of Object.entries(codeChanges)) {
      const fullPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }
    
    return tempDir;
  }

  async _copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await this._copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async _cleanupTemp(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  async _runStage(containerId, command, stageName) {
    const start = Date.now();
    const result = await dockerClient.execCommand(containerId, command);
    
    return {
      stage: stageName,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      duration: Date.now() - start
    };
  }
}

// ─── Code Validator (Orchestrator Integration) ────────────────────────────────

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export class CodeValidator {
  constructor() {
    this.testRunner = new SandboxTestRunner();
  }

  /**
   * Validate code changes with full Docker test
   */
  async validate({ projectPath, codeChanges, testType = 'build' }) {
    const result = await this.testRunner.runTest({
      projectPath,
      testType,
      codeChanges,
      onProgress: ({ stage, message }) => {
        // Progress updates can be sent to orchestrator
      }
    });

    return {
      success: result.success,
      exitCode: result.exitCode,
      logs: result.logs,
      formattedError: this._formatError(result)
    };
  }

  /**
   * Format error for LLM consumption
   */
  _formatError(result) {
    if (result.success) return null;

    const errorLog = result.logs.find(l => l.exitCode !== 0);
    if (!errorLog) return 'Unknown error';

    const relevant = errorLog.stderr || errorLog.stdout;
    // Truncate to avoid token explosion
    return relevant.slice(-2000); // Last 2000 chars usually contain the actual error
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const sandboxTestRunner = new SandboxTestRunner();
export const codeValidator = new CodeValidator();
export default { SandboxTestRunner, CodeValidator, dockerClient };
