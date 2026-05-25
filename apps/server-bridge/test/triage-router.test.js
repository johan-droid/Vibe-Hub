import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../orchestrator/token-governor.js', () => ({
  TokenGovernor: class {
    async getCompute() {
      throw new Error('model fallback should not be reached');
    }
  },
  callRoutedTextModel: vi.fn(),
}));

import { deterministicTriage, triageAndRoute } from '../orchestrator/agents/triage-router.js';

describe('triage router', () => {
  beforeEach(() => {
    delete process.env.SELINA_ENABLE_TRIAGE_MODEL;
  });

  it('classifies bug-fix style prompts deterministically and extracts file hints', async () => {
    const result = await triageAndRoute('Fix the upload crash in apps/server-bridge/orchestrator/router.js and tighten the handler.');

    expect(result).toMatchObject({
      intent: 'bug_fix',
      complexity: 'low',
      strategy: 'deterministic',
    });
    expect(result.target_files).toContain('apps/server-bridge/orchestrator/router.js');
  });

  it('keeps complex planning prompts high complexity without a model round-trip', () => {
    const result = deterministicTriage('Plan a broad end-to-end architecture refactor across multiple phases with scalability concerns.');

    expect(result.intent).toBe('unknown');
    expect(result.complexity).toBe('high');
    expect(result.strategy).toBe('deterministic');
  });
});
