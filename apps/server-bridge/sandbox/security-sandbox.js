import Docker from 'dockerode';
import { v4 as uuid } from 'uuid';
import path from 'path';

const docker = new Docker(); // Assumes Docker daemon is accessible

const SECURITY_IMAGE = 'vibe-hub-security-sandbox:latest';

// Security configuration constants
const SANDBOX_TIMEOUT_MS = 30000; // 30 second timeout for commands
const MAX_MEMORY_MB = 512; // 512MB memory limit
const MAX_CPU_PERIOD = 100000; // CPU period in microseconds
const MAX_CPU_QUOTA = 50000; // 50% of one CPU core

export class SecuritySandboxService {
  constructor() {
    this.containers = new Map(); // sandboxId -> container instance + metadata
    this.executionTimeouts = new Map(); // sandboxId -> timeout timers
  }

  async ensureImage() {
    try {
      const images = await docker.listImages({ filters: { reference: [SECURITY_IMAGE] } });
      if (images.length === 0) {
        console.log('[SecuritySandbox] Image not found. Building...');
        // In production, trigger a build or pull from registry
        throw new Error('Security sandbox image not available. Run: docker build -t vibe-hub-security-sandbox:latest -f Dockerfile.security .');
      }
    } catch (e) {
      console.error('[SecuritySandbox] Docker daemon error:', e.message);
      throw e;
    }
  }

  /**
   * Create a fresh security sandbox with strict resource limits
   */
  async create({ repoPath }) {
    await this.ensureImage();
    
    const sandboxId = uuid();
    try {
      const container = await docker.createContainer({
        Image: SECURITY_IMAGE,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        OpenStdin: false,
        HostConfig: {
          Binds: [
            `${path.resolve(repoPath)}:/workspace:ro`,  // mount project read-only
          ],
          NetworkMode: 'none', // Complete network isolation
          Memory: MAX_MEMORY_MB * 1024 * 1024, // Memory limit in bytes
          MemorySwap: MAX_MEMORY_MB * 1024 * 1024, // Disable swap
          CpuPeriod: MAX_CPU_PERIOD,
          CpuQuota: MAX_CPU_QUOTA,
          PidsLimit: 50, // Limit number of processes
          ReadonlyRootfs: true, // Read-only filesystem
          SecurityOpt: [
            'no-new-privileges:true', // Prevent privilege escalation
            'apparmor:docker-default', // Use AppArmor profile if available
          ],
          CapDrop: ['ALL'], // Drop all Linux capabilities
          CapAdd: [], // Don't add any back
        },
        WorkingDir: '/workspace',
        Env: [
          'NODE_ENV=sandbox',
          'NO_NETWORK=true',
        ],
      });

      await container.start();
      
      // Store container with metadata
      this.containers.set(sandboxId, {
        container,
        createdAt: Date.now(),
        commandHistory: [],
      });

      console.log(`[SecuritySandbox] Created sandbox ${sandboxId} with strict limits`);
      return { sandboxId };
    } catch (err) {
      console.error('[SecuritySandbox] Failed to create container:', err.message);
      throw new Error(`Sandbox creation failed: ${err.message}`);
    }
  }

  /**
   * Execute a command with timeout and output streaming
   */
  async exec(sandboxId, command, options = {}) {
    const containerData = this.containers.get(sandboxId);
    if (!containerData) {
      throw new Error(`Sandbox ${sandboxId} not found or already destroyed`);
    }

    const { container } = containerData;
    const timeout = options.timeout || SANDBOX_TIMEOUT_MS;

    // Track command
    containerData.commandHistory.push({ command, timestamp: Date.now() });

    // Check for dangerous patterns
    if (this._isDangerousCommand(command)) {
      throw new Error('Security violation: Dangerous command detected');
    }

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      User: 'nobody', // Run as non-root user
      WorkingDir: '/workspace',
      Env: ['NO_NETWORK=true'],
    });

    // Start execution with timeout
    const stream = await exec.start({ Detach: false, Tty: false, hijack: true });
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let hasData = false;

      const timeoutTimer = setTimeout(() => {
        stream.destroy();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      stream.on('data', (chunk) => {
        hasData = true;
        // First byte indicates stream type: 1=stdout, 2=stderr
        const streamType = chunk[0];
        const data = chunk.slice(8).toString();
        
        if (streamType === 1) {
          stdout += data;
        } else if (streamType === 2) {
          stderr += data;
        }
      });

      stream.on('end', () => {
        clearTimeout(timeoutTimer);
        resolve({ stdout, stderr, exitCode: 0 });
      });

      stream.on('error', (err) => {
        clearTimeout(timeoutTimer);
        reject(err);
      });

      stream.on('close', (code) => {
        clearTimeout(timeoutTimer);
        resolve({ stdout, stderr, exitCode: code || 0 });
      });
    });
  }

  /**
   * Execute with automatic retry and circuit breaker
   */
  async execWithRetry(sandboxId, command, options = {}) {
    const maxRetries = options.retries || 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.exec(sandboxId, command, options);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          console.log(`[SecuritySandbox] Retry ${attempt + 1}/${maxRetries} for command: ${command}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if command matches dangerous patterns
   */
  _isDangerousCommand(command) {
    const dangerousPatterns = [
      /\brm\s+(-rf?|--recursive)\s+[\/~]/i, // rm -rf /
      /\bchmod\s+777/i, // chmod 777
      /\bchown\s+root/i, // chown root
      /\bcurl.*\|\s*(ba)?sh/i, // curl | sh
      /\bwget.*\|\s*(ba)?sh/i, // wget | sh
      /\bmkfs/i, // format disk
      /\bdd\s+if=/i, // dd command
      /\bfork\b/i, // fork bombs
      /:\(\)\{\s*:\s*\|\s*&\s*\};:/, // Classic fork bomb
      /\bnc\s+-/i, // netcat reverse shell
      /\bbash\s+-i/i, // Interactive bash
      /\bpython\s+-c\s+['"].*socket/i, // Python reverse shell
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Get sandbox statistics
   */
  getStats(sandboxId) {
    const containerData = this.containers.get(sandboxId);
    if (!containerData) return null;

    return {
      sandboxId,
      createdAt: containerData.createdAt,
      uptime: Date.now() - containerData.createdAt,
      commandCount: containerData.commandHistory.length,
      recentCommands: containerData.commandHistory.slice(-5),
    };
  }

  /**
   * Destroy sandbox and cleanup resources
   */
  async destroy(sandboxId) {
    const containerData = this.containers.get(sandboxId);
    if (!containerData) {
      console.warn(`[SecuritySandbox] Sandbox ${sandboxId} not found`);
      return { status: 'not_found' };
    }

    const { container } = containerData;

    try {
      // Stop container with timeout
      await container.stop({ t: 5 });
      
      // Remove container
      await container.remove({ force: true });
      
      this.containers.delete(sandboxId);
      
      console.log(`[SecuritySandbox] Destroyed sandbox ${sandboxId}`);
      return { status: 'destroyed' };
    } catch (e) {
      console.error('[SecuritySandbox] Cleanup error:', e.message);
      // Force delete from map even if Docker cleanup fails
      this.containers.delete(sandboxId);
      return { status: 'error', message: e.message };
    }
  }

  /**
   * Cleanup all sandboxes (for shutdown)
   */
  async destroyAll() {
    const promises = Array.from(this.containers.keys()).map(id => this.destroy(id));
    await Promise.allSettled(promises);
    console.log('[SecuritySandbox] All sandboxes destroyed');
  }

  /**
   * Periodic health check for runaway containers
   */
  startHealthCheck(intervalMs = 60000) {
    const healthInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes

      for (const [id, data] of this.containers.entries()) {
        if (now - data.createdAt > maxAge) {
          console.log(`[SecuritySandbox] Auto-destroying old sandbox ${id}`);
          this.destroy(id).catch(console.error);
        }
      }
    }, intervalMs);

    // Don't block process exit
    healthInterval.unref();
    return healthInterval;
  }
}

export const securitySandboxService = new SecuritySandboxService();
