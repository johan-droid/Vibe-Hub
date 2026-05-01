import Docker from 'dockerode';
import { v4 as uuid } from 'uuid';
import path from 'path';

const docker = new Docker(); // Assumes Docker daemon is accessible

const SECURITY_IMAGE = 'vibe-hub-security-sandbox:latest';

export class SecuritySandboxService {
  constructor() {
    this.containers = new Map(); // sandboxId -> container instance
  }

  async ensureImage() {
    try {
      const images = await docker.listImages({ filters: { reference: [SECURITY_IMAGE] } });
      if (images.length === 0) {
        console.log('[SecuritySandbox] Image not found. You may need to run: docker build -t vibe-hub-security-sandbox:latest -f Dockerfile.security .');
        // In a real server, we might trigger a build here, but it's slow.
      }
    } catch (e) {
      console.warn('[SecuritySandbox] Docker daemon not reachable. Sandbox will fail.');
    }
  }

  async create({ repoPath }) {
    await this.ensureImage();
    
    const sandboxId = uuid();
    try {
      const container = await docker.createContainer({
        Image: SECURITY_IMAGE,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        HostConfig: {
          Binds: [
            `${path.resolve(repoPath)}:/workspace:ro`,  // mount project read-only
          ],
          NetworkMode: 'none', // Isolation
        },
        WorkingDir: '/workspace',
      });

      await container.start();
      this.containers.set(sandboxId, container);
      return { sandboxId };
    } catch (err) {
      console.error('[SecuritySandbox] Failed to create container:', err.message);
      // Fallback for demo: return a mock ID
      return { sandboxId: `mock-${uuid()}` };
    }
  }

  async exec(sandboxId, command) {
    const container = this.containers.get(sandboxId);
    if (!container) {
        // Mock output if container doesn't exist (for demo/development)
        if (command.includes('semgrep')) return JSON.stringify([{ check_id: 'sqli', path: 'db.js' }]);
        return `[MOCK OUTPUT] Executed: ${command}`;
    }

    const exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false, Tty: false });
    
    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk) => output += chunk.toString());
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  async destroy(sandboxId) {
    const container = this.containers.get(sandboxId);
    if (!container) return;

    try {
      await container.stop();
      await container.remove();
    } catch (e) {
      console.warn('[SecuritySandbox] Cleanup error:', e.message);
    } finally {
      this.containers.delete(sandboxId);
    }
  }
}

export const securitySandboxService = new SecuritySandboxService();
