/**
 * Docker Client — Local Sandbox Execution v6
 * ===========================================
 *
 * Interacts with local Docker daemon for ephemeral testing.
 * Spins up Alpine containers, runs tests, captures output, destroys containers.
 * 
 * User requirement: Local Docker Desktop (no Podman support selected)
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';

const execAsync = promisify(exec);
import { exec } from 'child_process';

// ─── Docker Configuration ───────────────────────────────────────────────────

const DOCKER_CONFIG = {
  image: 'node:20-alpine',
  timeout: 120000, // 2 minutes
  memory: '512m',
  cpus: '1',
  network: 'none', // Isolate containers
};

// ─── Docker Client ────────────────────────────────────────────────────────────

export class DockerClient {
  constructor() {
    this.activeContainers = new Map(); // id -> containerInfo
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable() {
    try {
      const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Create an ephemeral container with mounted project code
   */
  async createContainer(projectPath, envVars = {}) {
    const containerId = uuid();
    const containerName = `selina-sandbox-${containerId.slice(0, 8)}`;
    
    // Build environment variables string
    const envFlags = Object.entries(envVars)
      .map(([k, v]) => `-e "${k}=${v}"`)
      .join(' ');

    const cmd = [
      'docker', 'run', '-d',
      '--name', containerName,
      '--rm', // Auto-remove on stop
      '--network', DOCKER_CONFIG.network,
      '--memory', DOCKER_CONFIG.memory,
      '--cpus', DOCKER_CONFIG.cpus,
      '-v', `${projectPath}:/workspace`,
      '-w', '/workspace',
      envFlags,
      DOCKER_CONFIG.image,
      'sh', '-c', 'while true; do sleep 1; done' // Keep container alive
    ].join(' ');

    try {
      const { stdout } = await execAsync(cmd);
      const dockerId = stdout.trim();
      
      const containerInfo = {
        id: containerId,
        dockerId,
        name: containerName,
        projectPath,
        createdAt: Date.now(),
        status: 'running'
      };
      
      this.activeContainers.set(containerId, containerInfo);
      return containerInfo;
    } catch (err) {
      throw new Error(`Failed to create container: ${err.message}`);
    }
  }

  /**
   * Execute a command in the container
   */
  async execCommand(containerId, command, timeout = DOCKER_CONFIG.timeout) {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    return new Promise((resolve, reject) => {
      const stdout = [];
      const stderr = [];
      
      const dockerCmd = [
        'docker', 'exec',
        container.dockerId,
        'sh', '-c',
        command
      ];

      const child = spawn(dockerCmd[0], dockerCmd.slice(1), {
        timeout,
        killSignal: 'SIGKILL'
      });

      child.stdout.on('data', (data) => {
        stdout.push(data.toString());
      });

      child.stderr.on('data', (data) => {
        stderr.push(data.toString());
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          timedOut: code === null
        });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Stream logs from a container
   */
  async streamLogs(containerId, onOutput) {
    const container = this.activeContainers.get(containerId);
    if (!container) return;

    const cmd = ['docker', 'logs', '-f', container.dockerId];
    const child = spawn(cmd[0], cmd.slice(1));

    child.stdout.on('data', (data) => {
      onOutput('stdout', data.toString());
    });

    child.stderr.on('data', (data) => {
      onOutput('stderr', data.toString());
    });

    return child;
  }

  /**
   * Copy file into container
   */
  async copyFile(containerId, sourcePath, destPath) {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    const cmd = `docker cp "${sourcePath}" ${container.dockerId}:"${destPath}"`;
    await execAsync(cmd);
  }

  /**
   * Copy file from container
   */
  async copyFromContainer(containerId, sourcePath, destPath) {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    const cmd = `docker cp ${container.dockerId}:"${sourcePath}" "${destPath}"`;
    await execAsync(cmd);
  }

  /**
   * Destroy a container
   */
  async destroyContainer(containerId) {
    const container = this.activeContainers.get(containerId);
    if (!container) return;

    try {
      await execAsync(`docker kill ${container.dockerId}`);
      this.activeContainers.delete(containerId);
    } catch (err) {
      // Container may already be stopped
      this.activeContainers.delete(containerId);
    }
  }

  /**
   * Destroy all active containers
   */
  async destroyAll() {
    const promises = Array.from(this.activeContainers.keys()).map(id => 
      this.destroyContainer(id)
    );
    await Promise.all(promises);
  }

  /**
   * Get container info
   */
  getContainerInfo(containerId) {
    return this.activeContainers.get(containerId);
  }

  /**
   * List active containers
   */
  listActive() {
    return Array.from(this.activeContainers.values());
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const dockerClient = new DockerClient();
export default DockerClient;
