import { describe, expect, it, vi } from 'vitest';
import { AgentAuthManager, AuthError, authToken, callWithAuthRetry } from '../auth/agent-auth.js';
import { ApprovalEngine } from '../auth/approval-engine.js';
import { authorizeToolCall, ToolAuthError, getToolAuthPolicy } from '../orchestrator/tool_auth_guard.js';
import { sanitizeEnvironment } from '../utils/env-sanitizer.js';

describe('Agent auth gate', () => {
  it('centralizes provider credentials and returns cloned snapshots', async () => {
    const manager = new AgentAuthManager({
      env: {
        OPENAI_API_KEY: 'sk-test-value',
        GEMINI_API_KEY: 'gemini-value',
      },
    });

    const snapshot = await manager.auth('openai');
    snapshot.value = 'mutated';

    expect(authToken(await manager.auth('openai'))).toBe('sk-test-value');
    expect(manager.hasProvider('gemini')).toBe(true);
  });

  it('deduplicates OAuth refresh and retries a 401 exactly once', async () => {
    const refreshOAuth = vi.fn(async () => ({
      accessToken: 'fresh-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 120_000,
    }));
    const manager = new AgentAuthManager({ env: {}, refreshOAuth });
    manager.loadOAuth('openai', {
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 120_000,
    });

    const statuses = [401, 200];
    const response = await callWithAuthRetry(manager, 'openai', async () => ({
      status: statuses.shift(),
    }));

    expect(response.status).toBe(200);
    expect(refreshOAuth).toHaveBeenCalledTimes(1);
  });

  it('fails closed when API-key credentials receive a 401', async () => {
    const manager = new AgentAuthManager({ env: { OPENAI_API_KEY: 'sk-test-value' } });

    await expect(callWithAuthRetry(manager, 'openai', async () => ({ status: 401 })))
      .rejects.toThrow(AuthError);
  });

  it('scrubs secret-like variables before spawning subprocesses', () => {
    const clean = sanitizeEnvironment({
      PATH: '/bin',
      OPENAI_API_KEY: 'sk-secret',
      JWT_SECRET: 'jwt-secret',
      NODE_ENV: 'test',
      CUSTOM_VALUE: 'safe',
    }, { inherit: 'all' });

    expect(clean.PATH).toBe('/bin');
    expect(clean.NODE_ENV).toBe('test');
    expect(clean.CUSTOM_VALUE).toBe('safe');
    expect(clean.OPENAI_API_KEY).toBeUndefined();
    expect(clean.JWT_SECRET).toBeUndefined();
  });

  it('requires authenticated approval for write-capable tools', async () => {
    await expect(authorizeToolCall('run_command', { command: 'npm' }, {
      authSnapshot: null,
      approvalFn: async () => true,
    })).rejects.toThrow(ToolAuthError);

    await expect(authorizeToolCall('run_command', { command: 'npm' }, {
      authSnapshot: { type: 'user-session', userId: 'user-1' },
      approvalFn: async () => false,
    })).rejects.toThrow('user denied write operation');

    await expect(authorizeToolCall('read_file', { path: 'package.json' }, {
      authSnapshot: { type: 'user-session', userId: 'user-1' },
    })).resolves.toMatchObject({ approved: true });

    expect(getToolAuthPolicy('create_file')).toMatchObject({ type: 'write', requireApproval: true });
    expect(getToolAuthPolicy('patch_file')).toMatchObject({ type: 'write', requireApproval: true });
  });

  it('approval engine denies on timeout', async () => {
    vi.useFakeTimers();
    const engine = new ApprovalEngine({ timeoutMs: 10 });
    const decision = engine.request(
      'write file',
      { toolName: 'create_file', params: '{}' },
      () => new Promise(() => {})
    );

    await vi.advanceTimersByTimeAsync(11);
    await expect(decision).resolves.toBe(false);
    vi.useRealTimers();
  });

  it('scopes approval leases to runId and toolName', async () => {
    const engine = new ApprovalEngine({ timeoutMs: 10 });
    const firstApproval = vi.fn(async () => 'approve');
    const denied = vi.fn(async () => 'deny');

    await expect(engine.request('write file', {
      runId: 'run-a',
      toolName: 'create_file',
      params: '{}',
    }, firstApproval)).resolves.toBe(true);

    await expect(engine.request('write file again', {
      runId: 'run-a',
      toolName: 'create_file',
      params: '{}',
    }, denied)).resolves.toBe(true);
    expect(denied).not.toHaveBeenCalled();

    await expect(engine.request('other run same tool', {
      runId: 'run-b',
      toolName: 'create_file',
      params: '{}',
    }, denied)).resolves.toBe(false);
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it('does not create reusable approval leases without a runId', async () => {
    const engine = new ApprovalEngine({ timeoutMs: 10 });

    await expect(engine.request('write file', {
      toolName: 'create_file',
      params: '{}',
    }, async () => 'approve')).resolves.toBe(true);

    await expect(engine.request('write file again', {
      toolName: 'create_file',
      params: '{}',
    }, async () => 'deny')).resolves.toBe(false);
  });
});
