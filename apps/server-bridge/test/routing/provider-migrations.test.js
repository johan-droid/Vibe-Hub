import { describe, expect, it } from 'vitest';
import { isModelAffectedByMigration, getMigrationReplacementHints } from '../../orchestrator/routing/provider-migrations.js';

describe('provider-migrations', () => {
  it('identifies affected models', () => {
    expect(isModelAffectedByMigration('deepseek v3 0324')).toBe(true);
    expect(isModelAffectedByMigration({ provider: 'sambanova', displayName: 'qwen3 32b' })).toBe(true);
    expect(isModelAffectedByMigration('unknown model')).toBe(false);
  });

  it('returns replacement hints', () => {
    expect(getMigrationReplacementHints('qwen3 32b')).toContain('minimax m2.5');
    expect(getMigrationReplacementHints({ provider: 'sambanova', displayName: 'llama 3.1 8b' })).toContain('llama 3.3 70b');
    expect(getMigrationReplacementHints('unknown model')).toEqual([]);
  });
});
