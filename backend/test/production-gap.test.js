import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActionGrant, hashToolParams, verifyActionGrant } from '../auth/action-grants.js';
import { buildExpertDiagnostics, resolveExpertProfile } from '../orchestrator/expert-routing.js';
import { createJsonRpcEvent, validateJsonRpcEnvelope } from '../orchestrator/jsonrpc.js';
import { createChildRunIdentity, createRootRunIdentity } from '../orchestrator/run_identity.js';
import { authorizeToolCall, ToolAuthError } from '../orchestrator/tool_auth_guard.js';
import { AgentAuthManager } from '../auth/agent-auth.js';
import { ModelService } from '../orchestrator/models.js';

describe('production gap closure primitives', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('routes CodeExpert to OpenAI and DebuggerExpert to Anthropic with provider fallback diagnostics', () => {
    const env = {
      OPENAI_API_KEY: 'sk-openai',
      OPENAI_MODEL: 'gpt-code',
      ANTHROPIC_API_KEY: 'sk-ant',
      ANTHROPIC_MODEL: 'claude-debug',
      SELINA_EXPERT_CODE_PROVIDER: 'openai',
      SELINA_EXPERT_DEBUG_PROVIDER: 'anthropic',
      SELINA_EXPERT_MANAGER_PROVIDER: 'openai',
    };
    const service = new ModelService(env, new AgentAuthManager({ env }));

    expect(resolveExpertProfile({ domain: 'code', modelService: service, env })).toMatchObject({
      provider: 'openai',
      model: 'gpt-code',
    });
    expect(resolveExpertProfile({ domain: 'debug', modelService: service, env })).toMatchObject({
      provider: 'anthropic',
      model: 'claude-debug',
    });
    expect(buildExpertDiagnostics(service, env).experts.find(item => item.expert === 'manager')).toMatchObject({
      provider: 'openai',
      health: 'configured',
    });
  });

  it('creates JSON-RPC-compatible nested run events', () => {
    const root = createRootRunIdentity({ expert: 'manager', provider: 'openai', model: 'gpt-code' });
    const child = createChildRunIdentity(root, { expert: 'debug', provider: 'anthropic', model: 'claude-debug' });
    const event = createJsonRpcEvent({
      method: 'agent.tool_call',
      params: { type: 'tool_call', status: 'started', tool: 'read_file' },
      runIdentity: child,
    });

    expect(validateJsonRpcEnvelope(event)).toBe(true);
    expect(child.rootRunId).toBe(root.rootRunId);
    expect(child.parentRunId).toBe(root.runId);
    expect(child.depth).toBe(1);
    expect(event.runId).toBe(child.runId);
    expect(event.parentRunId).toBe(root.runId);
  });

  it('signs short-lived action grants against tool intent and params hash', () => {
    vi.stubEnv('SELINA_ACTION_GRANT_SECRET', 'action-grant-secret-for-tests');
    const paramsHash = hashToolParams({ path: 'src/App.jsx', content: 'x' });
    const grant = createActionGrant({
      userId: 'user-1',
      runId: 'run-1',
      toolName: 'create_file',
      paramsHash,
      decision: 'approve',
      now: 1000,
      ttlMs: 5000,
    });

    expect(verifyActionGrant(grant.token, {
      userId: 'user-1',
      runId: 'run-1',
      toolName: 'create_file',
      paramsHash,
      now: 2000,
    }).ok).toBe(true);

    expect(verifyActionGrant(grant.token, {
      userId: 'user-1',
      runId: 'run-1',
      toolName: 'create_file',
      paramsHash: hashToolParams({ path: 'src/App.jsx', content: 'y' }),
      now: 2000,
    })).toMatchObject({ ok: false, code: 'ACTION_GRANT_SCOPE_MISMATCH' });
  });

  it('requires SELINA_ACTION_GRANT_SECRET instead of falling back to JWT, master, or test keys', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('SELINA_ACTION_GRANT_SECRET', '');
    vi.stubEnv('VIBE_MASTER_KEY', 'master-key-that-must-not-sign-grants');
    vi.stubEnv('JWT_SECRET', 'jwt-secret-that-must-not-sign-grants');

    expect(() => createActionGrant({
      userId: 'user-1',
      runId: 'run-1',
      toolName: 'create_file',
      paramsHash: hashToolParams({ path: 'src/App.jsx' }),
    })).toThrow(/SELINA_ACTION_GRANT_SECRET is missing/);
  });

  it('fails closed for unknown MCP mutation risk and allows declared readonly MCP tools', async () => {
    await expect(authorizeToolCall('remote_server__mutate', {}, {
      authSnapshot: { type: 'user-session', userId: 'user-1', permissions: ['tool:mcp'] },
      toolDefinition: { serverName: 'remote_server', metadata: {} },
      approvalFn: async () => false,
    })).rejects.toThrow(ToolAuthError);

    await expect(authorizeToolCall('selina_a11y__scan', { url: 'http://localhost:5173' }, {
      authSnapshot: { type: 'user-session', userId: 'user-1', permissions: ['tool:mcp'] },
      toolDefinition: { serverName: 'selina_a11y', metadata: { risk: 'readonly' } },
    })).resolves.toMatchObject({ approved: true });
  });
});
