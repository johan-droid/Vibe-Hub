import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';
import { createActionGrant, hashToolParams, verifyActionGrant } from '../auth/action-grants.js';
import { authorizeToolCall, ToolAuthError } from '../orchestrator/tool_auth_guard.js';
import { extractCodePayload } from '../orchestrator/llm_client.js';
import { normalizeAnalyzerPath } from '../orchestrator/static-analyzer.js';
import { countTokens } from '../memory/tokenizer.js';
import { VFSContainer } from '../vfs/container.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('security regression: auth-boundary', () => {
  it('rejects action grants forged for another run', () => {
    vi.stubEnv('SELINA_ACTION_GRANT_SECRET', 'security-regression-secret');
    const paramsHash = hashToolParams({ path: 'src/App.jsx', content: 'safe' });
    const grant = createActionGrant({
      userId: 'user-a',
      runId: 'run-a',
      toolName: 'patch_file',
      paramsHash,
      now: 1000,
    });

    expect(verifyActionGrant(grant.token, {
      userId: 'user-a',
      runId: 'run-b',
      toolName: 'patch_file',
      paramsHash,
      now: 1001,
    })).toMatchObject({ ok: false, code: 'ACTION_GRANT_SCOPE_MISMATCH' });

    vi.unstubAllEnvs();
  });
});

describe('security regression: tool-auth', () => {
  it('fails closed for prompt-injected unknown mutation tools', async () => {
    await expect(authorizeToolCall('postgres__drop_all_tables', {}, {
      authSnapshot: { type: 'user-session', userId: 'user-a' },
      toolDefinition: { serverName: 'postgres', metadata: {} },
      approvalFn: async () => false,
    })).rejects.toThrow(ToolAuthError);
  });
});

describe('security regression: sandbox', () => {
  it('documents networkless explicit-copy sandbox semantics in the tool contract', async () => {
    const toolsSource = await fs.readFile(path.join(REPO_ROOT, 'apps/server-bridge/orchestrator/tools.js'), 'utf-8');
    expect(toolsSource).toContain('copies only requested files');
    expect(toolsSource).toContain('no network access');
    expect(toolsSource).toContain('.env, .git, credential, key, and token-like files are refused');
  });
});

describe('security regression: vfs-paths', () => {
  it('rejects similarly prefixed sibling paths', () => {
    const vfs = new VFSContainer({ workDir: path.join(REPO_ROOT, 'apps/server-bridge') });
    expect(() => vfs._validatePath(`${vfs.root}-secrets/key.txt`)).toThrow('Path escape attempt');
  });
});

describe('security regression: model-memory', () => {
  it('uses real token counts and preserves internal fenced code text', () => {
    expect(countTokens('const x = 1;')).toBe(6);
    expect(extractCodePayload([
      '```javascript',
      'const payload = `',
      '```',
      'not a fence close inside template',
      '`;',
      '```',
    ].join('\n'))).toContain('not a fence close inside template');
  });
});

describe('security regression: static-analysis boundary', () => {
  it('accepts only workspace-relative analysis targets before invoking eslint', () => {
    expect(normalizeAnalyzerPath('src/App.jsx')).toBe('src/App.jsx');
    expect(() => normalizeAnalyzerPath('../.env')).toThrow('escapes workspace');
    expect(() => normalizeAnalyzerPath(path.resolve(REPO_ROOT, 'package.json'))).toThrow('escapes workspace');
  });
});

describe('security regression: workflow-supply-chain', () => {
  it('keeps workflows away from pull_request_target privilege escalation', async () => {
    const workflowDir = path.join(REPO_ROOT, '.github/workflows');
    const files = await fs.readdir(workflowDir);
    const sources = await Promise.all(files.map(file => fs.readFile(path.join(workflowDir, file), 'utf-8')));
    expect(sources.join('\n')).not.toMatch(/pull_request_target\s*:/);
  });
});

describe('security regression: frontend-xss', () => {
  it('keeps raw HTML rendering and terminal output behind sanitization or React escaping', async () => {
    const uiFiles = [
      'apps/user-interface/src/features/chat/components/ChatInterface.jsx',
      'apps/user-interface/src/features/editor/components/Terminal.jsx',
      'apps/user-interface/src/features/editor/components/DiffViewer.jsx',
    ];
    const sources = await Promise.all(uiFiles.map(file => fs.readFile(path.join(REPO_ROOT, file), 'utf-8')));

    expect(sources[0]).toContain('ReactMarkdown');
    expect(sources[0]).not.toContain('rehypeRaw');
    expect(sources.join('\n')).not.toContain('dangerouslySetInnerHTML');
    expect(sources.join('\n')).toContain('DOMPurify.sanitize');
  });
});
