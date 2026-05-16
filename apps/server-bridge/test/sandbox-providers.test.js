import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  E2BVibeKitSandboxProvider,
  LocalDockerSandboxProvider,
  SandboxProviderRouter,
  normalizeProviderName,
} from '../sandbox/providers.js';

describe('SandboxProviderRouter', () => {
  it('normalizes provider aliases and routes to the requested provider', async () => {
    const docker = {
      name: 'docker-local',
      executeScript: vi.fn(async () => ({ success: true, sandbox: { type: 'local_docker' } })),
    };
    const e2b = {
      name: 'e2b-vibekit',
      executeScript: vi.fn(async () => ({ success: true, sandbox: { type: 'e2b_vibekit' } })),
    };
    const router = new SandboxProviderRouter({ providers: [docker, e2b] });

    expect(normalizeProviderName('vibex')).toBe('e2b-vibekit');
    await expect(router.executeScript({ provider: 'e2b', scriptPath: 'run.js' })).resolves.toMatchObject({
      sandbox: { type: 'e2b_vibekit' },
    });
    expect(e2b.executeScript).toHaveBeenCalledWith({ scriptPath: 'run.js' });
    expect(docker.executeScript).not.toHaveBeenCalled();
  });

  it('keeps Docker as the default provider seam', async () => {
    const executor = {
      executeLocalDockerSandbox: vi.fn(async () => ({ success: true, sandbox: { type: 'local_docker' } })),
      executeLocalDockerCommand: vi.fn(async () => ({ success: true, sandbox: { type: 'local_docker' } })),
    };
    const provider = new LocalDockerSandboxProvider({ executor });

    await provider.executeScript({ scriptPath: 'run.js' });
    await provider.executeCommand({ command: 'node', args: ['run.js'] });

    expect(executor.executeLocalDockerSandbox).toHaveBeenCalledWith({ scriptPath: 'run.js' });
    expect(executor.executeLocalDockerCommand).toHaveBeenCalledWith({ command: 'node', args: ['run.js'] });
  });
});

describe('E2BVibeKitSandboxProvider', () => {
  let workspaceRoot;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'selina-e2b-source-'));
  });

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it('fails closed unless explicitly configured', async () => {
    const provider = new E2BVibeKitSandboxProvider({ env: {}, adapter: null });

    await expect(provider.executeScript({
      workspacePath: workspaceRoot,
      scriptPath: 'run.js',
    })).rejects.toMatchObject({ code: 'E2B_VIBEKIT_UNCONFIGURED' });
  });

  it('copies only explicit non-secret files before handing them to the cloud adapter', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'run.js'), 'console.log("safe");', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, 'helper.txt'), 'visible', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, '.env'), 'API_KEY=hidden', 'utf-8');

    const adapter = {
      run: vi.fn(async ({ files }) => ({
        success: true,
        stdout: JSON.stringify(files),
      })),
    };
    const provider = new E2BVibeKitSandboxProvider({
      env: { E2B_API_KEY: 'test-key' },
      adapter,
    });

    const result = await provider.executeScript({
      workspacePath: workspaceRoot,
      scriptPath: 'run.js',
      includePaths: ['helper.txt'],
    });

    expect(adapter.run).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'script',
      runtime: 'node',
      files: [
        { path: 'run.js', content: 'console.log("safe");' },
        { path: 'helper.txt', content: 'visible' },
      ],
    }));
    expect(result).toMatchObject({
      success: true,
      sandbox: {
        type: 'e2b_vibekit',
        workspace: 'isolated_tmp_to_cloud',
        copiedFiles: ['run.js', 'helper.txt'],
      },
    });
  });

  it('reuses the restricted-file denylist for E2B include paths', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'run.js'), 'console.log("safe");', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, '.env'), 'API_KEY=hidden', 'utf-8');
    const provider = new E2BVibeKitSandboxProvider({
      env: { E2B_API_KEY: 'test-key' },
      adapter: { run: vi.fn() },
    });

    await expect(provider.executeScript({
      workspacePath: workspaceRoot,
      scriptPath: 'run.js',
      includePaths: ['.env'],
    })).rejects.toThrow(/restricted sandbox file/);
  });
});
