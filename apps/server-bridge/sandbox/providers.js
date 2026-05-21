import fs from 'fs/promises';
import path from 'path';
import SandboxExecutor, {
  cleanupSandboxWorkspace,
  createIsolatedSandboxWorkspace,
} from './docker_executor.js';

export class SandboxProviderError extends Error {
  constructor(message, code = 'SANDBOX_PROVIDER_ERROR') {
    super(message);
    this.name = 'SandboxProviderError';
    this.code = code;
  }
}

export class LocalDockerSandboxProvider {
  constructor({ executor = SandboxExecutor } = {}) {
    this.name = 'docker-local';
    this.executor = executor;
  }

  async executeScript(params = {}) {
    return this.executor.executeLocalDockerSandbox(params);
  }

  async executeCommand(params = {}) {
    return this.executor.executeLocalDockerCommand(params);
  }
}

export class E2BVibeKitSandboxProvider {
  constructor({ env = process.env, adapter = null } = {}) {
    this.name = 'e2b-vibekit';
    this.env = env;
    this.adapter = adapter;
  }

  isConfigured() {
    return Boolean(this.adapter && (this.env.E2B_API_KEY || this.env.VIBEKIT_API_KEY));
  }

  async executeScript({
    workspacePath,
    scriptPath,
    runtime = 'node',
    timeoutMs,
    includePaths = [],
  } = {}) {
    if (!this.isConfigured()) {
      throw new SandboxProviderError(
        'E2B/VibeKit sandbox provider is not configured. Set E2B_API_KEY and supply a VibeKit/E2B adapter.',
        'E2B_VIBEKIT_UNCONFIGURED'
      );
    }

    const isolatedWorkspace = await createIsolatedSandboxWorkspace({
      workspacePath,
      requestedPaths: [scriptPath, ...includePaths],
    });

    try {
      const files = await readCopiedFiles(isolatedWorkspace.sandboxRoot, isolatedWorkspace.copiedPaths);
      const result = await this.adapter.run({
        mode: 'script',
        runtime,
        scriptPath,
        timeoutMs,
        network: 'restricted',
        files,
      });
      return normalizeE2BResult(result, isolatedWorkspace.copiedPaths);
    } finally {
      await cleanupSandboxWorkspace(isolatedWorkspace.sandboxRoot);
    }
  }

  async executeCommand({
    workspacePath,
    command,
    args = [],
    timeoutMs,
    includePaths = [],
  } = {}) {
    if (!this.isConfigured()) {
      throw new SandboxProviderError(
        'E2B/VibeKit sandbox provider is not configured. Set E2B_API_KEY and supply a VibeKit/E2B adapter.',
        'E2B_VIBEKIT_UNCONFIGURED'
      );
    }

    const isolatedWorkspace = await createIsolatedSandboxWorkspace({
      workspacePath,
      requestedPaths: includePaths,
    });

    try {
      const files = await readCopiedFiles(isolatedWorkspace.sandboxRoot, isolatedWorkspace.copiedPaths);
      const result = await this.adapter.run({
        mode: 'command',
        command,
        args: Array.isArray(args) ? args.map(String) : [],
        timeoutMs,
        network: 'restricted',
        files,
      });
      return normalizeE2BResult(result, isolatedWorkspace.copiedPaths);
    } finally {
      await cleanupSandboxWorkspace(isolatedWorkspace.sandboxRoot);
    }
  }
}

export class SandboxProviderRouter {
  constructor({
    env = process.env,
    providers = null,
    defaultProvider = env.SELINA_SANDBOX_PROVIDER || 'docker-local',
  } = {}) {
    this.defaultProvider = normalizeProviderName(defaultProvider);
    this.providers = new Map();

    const providerList = providers || [
      new LocalDockerSandboxProvider(),
      new E2BVibeKitSandboxProvider({ env }),
    ];

    for (const provider of providerList) {
      this.providers.set(normalizeProviderName(provider.name), provider);
    }
  }

  getProvider(providerName = this.defaultProvider) {
    const normalized = normalizeProviderName(providerName || this.defaultProvider);
    const provider = this.providers.get(normalized);
    if (!provider) {
      throw new SandboxProviderError(`Unknown sandbox provider: ${providerName}`, 'SANDBOX_PROVIDER_UNKNOWN');
    }
    return provider;
  }

  async executeScript({ provider, ...params } = {}) {
    return this.getProvider(provider).executeScript(params);
  }

  async executeCommand({ provider, ...params } = {}) {
    return this.getProvider(provider).executeCommand(params);
  }
}

export function normalizeProviderName(providerName = 'docker-local') {
  const normalized = String(providerName || 'docker-local').trim().toLowerCase();
  if (['docker', 'local', 'local-docker'].includes(normalized)) return 'docker-local';
  if (['e2b', 'vibekit', 'e2b-vibekit', 'vibex'].includes(normalized)) return 'e2b-vibekit';
  return normalized;
}

async function readCopiedFiles(sandboxRoot, copiedPaths = []) {
  const files = [];
  for (const copiedPath of copiedPaths) {
    const absolutePath = path.resolve(sandboxRoot, copiedPath);
    const relative = path.relative(sandboxRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SandboxProviderError(`Copied file escaped sandbox root: ${copiedPath}`, 'SANDBOX_FILE_ESCAPE');
    }
    files.push({
      path: copiedPath,
      content: await fs.readFile(absolutePath, 'utf-8'),
    });
  }
  return files;
}

function normalizeE2BResult(result = {}, copiedFiles = []) {
  return {
    success: result.success !== false && (result.exitCode === undefined || result.exitCode === 0),
    exitCode: result.exitCode ?? 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
    sandbox: {
      type: 'e2b_vibekit',
      isolation: 'firecracker_microvm',
      workspace: 'isolated_tmp_to_cloud',
      mount: 'copied_files_only',
      network: result.network || 'restricted',
      ephemeral: true,
      freshInvocation: true,
      copiedFiles,
    },
  };
}

export default SandboxProviderRouter;
