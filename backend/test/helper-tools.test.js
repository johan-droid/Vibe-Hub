import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeHelperTool, isHelperTool } from '../orchestrator/helper-tools.js';
import { getToolAuthPolicy } from '../orchestrator/tool_auth_guard.js';
import { validateToolCallArguments } from '../orchestrator/tool_schema.js';

vi.mock('../sandbox/providers.js', () => ({
  SandboxProviderRouter: vi.fn(function SandboxProviderRouter() {
    this.executeCommand = vi.fn(async params => ({
      success: true,
      stdout: 'ok',
      stderr: '',
      sandbox: { type: params.provider || 'docker-local' },
      params,
    }));
  }),
}));

describe('read-only helper tool pack', () => {
  let workspaceRoot;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'selina-helper-tools-'));
    await fs.writeFile(path.join(workspaceRoot, '.gitignore'), '.env\n.env.*\n*.pem\n*.key\n', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it('registers helper tools as readonly and schema-validated', () => {
    expect(isHelperTool('helper_validate_json')).toBe(true);
    expect(getToolAuthPolicy('helper_validate_json')).toMatchObject({ type: 'readonly' });
    expect(validateToolCallArguments('helper_validate_json', {
      path: 'package.json',
      workspacePath: workspaceRoot,
    })).toBe(true);
    expect(getToolAuthPolicy('helper_run_pytest')).toMatchObject({ type: 'write', requireApproval: true });
  });

  it('validates JSON files without mutating the workspace', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'good.json'), '{"ok":true}', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, 'bad.json'), '{"ok":', 'utf-8');

    await expect(executeHelperTool('helper_validate_json', {
      path: 'good.json',
      workspacePath: workspaceRoot,
    })).resolves.toMatchObject({ success: true, valid: true });

    await expect(executeHelperTool('helper_validate_json', {
      path: 'bad.json',
      workspacePath: workspaceRoot,
    })).resolves.toMatchObject({ success: false, valid: false });
  });

  it('scans explicit files for credential-like strings and refuses secret-like paths', async () => {
    await fs.writeFile(path.join(workspaceRoot, 'source.js'), 'const token = "sk-abcdefghijklmnopqrstuvwxyz123456";', 'utf-8');
    await fs.writeFile(path.join(workspaceRoot, '.env'), 'SECRET=sk-abcdefghijklmnopqrstuvwxyz123456', 'utf-8');

    await expect(executeHelperTool('helper_scan_secret_strings', {
      path: 'source.js',
      workspacePath: workspaceRoot,
    })).resolves.toMatchObject({
      success: true,
      matches: ['credential-like-pattern'],
    });

    await expect(executeHelperTool('helper_scan_secret_strings', {
      path: '.env',
      workspacePath: workspaceRoot,
    })).rejects.toThrow(/Refusing to scan secret-like helper path/);
  });

  it('checks gitignore coverage for common secret files', async () => {
    await expect(executeHelperTool('helper_check_gitignore', {
      workspacePath: workspaceRoot,
    })).resolves.toMatchObject({
      success: true,
      missing: [],
    });
  });

  it('routes Pytest, Ruff, and Semgrep through sandbox verification commands', async () => {
    await expect(executeHelperTool('helper_run_pytest', {
      workspacePath: workspaceRoot,
      args: ['tests/test_api.py', '-q'],
      sandboxProvider: 'e2b-vibekit',
    })).resolves.toMatchObject({
      success: true,
      verification: { tool: '-m pytest', sandboxProvider: 'e2b-vibekit' },
      params: {
        provider: 'e2b-vibekit',
        command: 'python3',
        args: ['-m', 'pytest', 'tests/test_api.py', '-q'],
      },
    });

    await expect(executeHelperTool('helper_run_ruff', {
      workspacePath: workspaceRoot,
      args: ['app'],
    })).resolves.toMatchObject({
      params: { args: ['-m', 'ruff', 'check', 'app'] },
    });

    await expect(executeHelperTool('helper_run_semgrep', {
      workspacePath: workspaceRoot,
      args: ['--config', 'auto', '.'],
    })).resolves.toMatchObject({
      params: { args: ['-m', 'semgrep', '--config', 'auto', '.'] },
    });
  });
});
