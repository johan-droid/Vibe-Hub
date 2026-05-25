import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildContextAuditSummary,
  buildSystemPromptV6,
  CONTEXT_SECTION_TOKEN_BUDGETS,
  OrgConstraintsLoader,
  UserPreferencesLoader,
} from '../orchestrator/context-builder.js';

describe('ContextBuilder token discipline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compresses large project, memory, and MCP context into bounded sections', async () => {
    vi.spyOn(OrgConstraintsLoader, 'load').mockResolvedValue([]);
    vi.spyOn(UserPreferencesLoader, 'load').mockResolvedValue({});

    const projectTree = Array.from({ length: 250 }, (_, index) => `src/features/very/deep/path/component-${index}.tsx`).join('\n');
    const packageJson = {
      name: 'vibe-hub',
      dependencies: Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`pkg-${index}`, `^${index}.0.0`])),
    };
    const userMemory = Array.from({ length: 120 }, (_, index) => `Memory note ${index} about auth, routing, and uploads.`).join('\n');
    const brainJournal = Array.from({ length: 12 }, (_, index) => ({ content: `Journal entry ${index} with implementation notes.` }));
    const mcpTools = Array.from({ length: 20 }, (_, index) => ({
      name: `tool_${index}`,
      description: `Execute operation ${index} with many words so the description itself can grow quite large for prompt budget testing.`,
      parameters: {
        type: 'object',
        required: ['path', 'mode'],
        properties: {
          path: { type: 'string' },
          mode: { type: 'string' },
          recursive: { type: 'boolean' },
          filter: { type: 'string' },
          dangerousNestedSetting: {
            type: 'object',
            properties: {
              shouldNeverAppearVerbatim: { type: 'string' },
            },
          },
        },
      },
    }));
    const linkedProjects = Array.from({ length: 12 }, (_, index) => ({
      name: `repo-${index}`,
      type: 'repo',
      indexedSymbols: 100 + index,
      path: `/repos/repo-${index}`,
    }));

    const prompt = await buildSystemPromptV6({
      projectName: 'vibe-hub',
      userId: '11111111-1111-4111-8111-111111111111',
      domain: 'code',
      projectTree,
      packageJson,
      userMemory,
      brainJournal,
      retrievalPlan: {
        queryType: 'code',
        rationale: 'Code-focused query',
        recallStrategy: 'lexical_first',
        riskLevel: 'high',
        requireSourceEvidence: true,
        preferredMemoryClasses: ['source', 'working', 'learned'],
        terms: ['router', 'upload', 'handler'],
      },
      evidencePacket: {
        selectedCount: 0,
        promptBlock: '',
      },
      skillProfile: { selectedSkills: [{ label: 'Code' }] },
      mcpTools,
      linkedProjects,
    });

    const audit = buildContextAuditSummary({
      projectTree,
      packageJson,
      userMemory,
      brainJournal,
      retrievalPlan: {
        queryType: 'code',
        rationale: 'Code-focused query',
        recallStrategy: 'lexical_first',
        riskLevel: 'high',
        requireSourceEvidence: true,
        preferredMemoryClasses: ['source', 'working', 'learned'],
        terms: ['router', 'upload', 'handler'],
      },
      evidencePacket: {
        selectedCount: 0,
        promptBlock: '',
      },
      mcpTools,
      linkedProjects,
    });

    expect(prompt).toContain('token-budget-trimmed');
    expect(prompt).toContain('risk:');
    expect(prompt).toContain('Additional tools not shown');
    expect(prompt).toContain('Additional linked repositories not shown');
    expect(prompt).not.toContain('shouldNeverAppearVerbatim');

    expect(audit.tokens.projectTree).toBeLessThanOrEqual(CONTEXT_SECTION_TOKEN_BUDGETS.projectTree);
    expect(audit.tokens.packageJson).toBeLessThanOrEqual(CONTEXT_SECTION_TOKEN_BUDGETS.packageJson);
    expect(audit.tokens.userMemory).toBeLessThanOrEqual(CONTEXT_SECTION_TOKEN_BUDGETS.userMemory);
    expect(audit.tokens.evidencePacket).toBeLessThanOrEqual(CONTEXT_SECTION_TOKEN_BUDGETS.evidencePacket);
    expect(audit.tokens.mcpTools).toBeLessThanOrEqual(CONTEXT_SECTION_TOKEN_BUDGETS.mcpTools);
  });

  it('suppresses broad project context when packed evidence already exists', async () => {
    vi.spyOn(OrgConstraintsLoader, 'load').mockResolvedValue([]);
    vi.spyOn(UserPreferencesLoader, 'load').mockResolvedValue({});

    const prompt = await buildSystemPromptV6({
      projectName: 'vibe-hub',
      userId: '11111111-1111-4111-8111-111111111111',
      domain: 'code',
      projectTree: Array.from({ length: 250 }, (_, index) => `src/features/very/deep/path/component-${index}.tsx`).join('\n'),
      packageJson: { name: 'vibe-hub', dependencies: { react: '^19.0.0', vite: '^7.0.0' } },
      userMemory: 'Stored note',
      brainJournal: [],
      retrievalPlan: {
        queryType: 'code',
        rationale: 'Code-focused query',
        recallStrategy: 'lexical_first',
        riskLevel: 'high',
        requireSourceEvidence: true,
        preferredMemoryClasses: ['source', 'working', 'learned'],
        terms: ['router', 'upload', 'handler'],
      },
      evidencePacket: {
        selectedCount: 2,
        evidence: [
          { sourcePath: '/repo/src/router.js', sourceName: 'router.js' },
          { sourcePath: '/repo/src/upload-handler.ts', sourceName: 'upload-handler.ts' },
        ],
        promptBlock: '=== RETRIEVED EVIDENCE ===\n[1] content_harness_chunk / source\nExcerpt:\n' + 'evidence '.repeat(200),
      },
      skillProfile: { selectedSkills: [{ label: 'Code' }] },
      mcpTools: [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object' } }],
      linkedProjects: [{ name: 'repo-a', type: 'repo', indexedSymbols: 10, path: '/repos/repo-a' }],
    });

    expect(prompt).toContain('Evidence-first mode is active');
    expect(prompt).toContain('/repo/src/router.js');
    expect(prompt).not.toContain('component-249.tsx');
    expect(prompt).toContain('Tool inventory is intentionally compressed');
    expect(prompt).toContain('Linked repository summaries are suppressed');
  });
});
