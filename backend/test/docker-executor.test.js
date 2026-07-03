import { EventEmitter } from 'events';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
  execFile: mocks.execFile,
}));

const { SandboxExecutor } = await import('../sandbox/docker_executor.js');

function createDockerChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

function dockerMountFromSpawn() {
  const dockerArgs = mocks.spawn.mock.calls.at(-1)?.[1] || [];
  const mount = dockerArgs[dockerArgs.indexOf('-v') + 1];
  const suffix = ':/workspace:rw';
  expect(mount).toEqual(expect.stringContaining(suffix));
  return path.normalize(mount.slice(0, -suffix.length));
}

describe('SandboxExecutor isolated Docker workspace', () => {
  let workspaceRoot;
  let children;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'selina-source-'));
    children = [];
    mocks.spawn.mockImplementation(() => {
      const child = createDockerChild();
      children.push(child);
      return child;
    });
    mocks.execFile.mockImplementation((_cmd, _args, _options, callback) => callback(null, '', ''));
  });

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('mounts a temporary sandbox directory read-write instead of the source workspace', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'run.js'), 'console.log("safe");', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, '.env'), 'API_KEY=should-not-copy', 'utf-8');

    const resultPromise = SandboxExecutor.executeLocalDockerSandbox({
      workspacePath: workspaceRoot,
      scriptPath: 'run.js',
      runtime: 'node',
    });
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));

    const sandboxMount = dockerMountFromSpawn();
    expect(sandboxMount).not.toBe(path.normalize(workspaceRoot));
    await expect(fs.readFile(path.join(sandboxMount, 'run.js'), 'utf-8')).resolves.toBe('console.log("safe");');
    await expect(fs.access(path.join(sandboxMount, '.env'))).rejects.toThrow();

    children[0].emit('close', 0, null);
    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      sandbox: {
        workspace: 'isolated_tmp',
        mount: 'rw',
        copiedFiles: ['run.js'],
      },
    });
    await expect(fs.access(sandboxMount)).rejects.toThrow();
  });

  it('refuses to copy secret-like requested files', async () => {
    await fs.writeFile(path.join(workspaceRoot, '.env'), 'API_KEY=should-not-copy', 'utf-8');

    await expect(SandboxExecutor.executeLocalDockerSandbox({
      workspacePath: workspaceRoot,
      scriptPath: '.env',
      runtime: 'node',
    })).rejects.toThrow(/restricted sandbox file/);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('copies only explicit command file arguments into command sandboxes', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'candidate.test.js'), 'console.log("test");', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, 'secrets.json'), '{"token":"should-not-copy"}', 'utf-8');

    const resultPromise = SandboxExecutor.executeLocalDockerCommand({
      workspacePath: workspaceRoot,
      command: 'node',
      args: ['--test', 'candidate.test.js'],
    });
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));

    const sandboxMount = dockerMountFromSpawn();
    await expect(fs.readFile(path.join(sandboxMount, 'candidate.test.js'), 'utf-8')).resolves.toBe('console.log("test");');
    await expect(fs.access(path.join(sandboxMount, 'secrets.json'))).rejects.toThrow();

    children[0].emit('close', 0, null);
    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      sandbox: { copiedFiles: ['candidate.test.js'] },
    });
  });
});
