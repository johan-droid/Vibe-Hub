import { describe, expect, it } from 'vitest';
import {
  isFullAuditMode,
  normalizeAuditMode,
  shouldRecordAudit,
} from '../orchestrator/audit-mode.js';

describe('audit mode helpers', () => {
  it('normalizes supported audit modes and falls back safely', () => {
    expect(normalizeAuditMode('FULL')).toBe('full');
    expect(normalizeAuditMode('off')).toBe('off');
    expect(normalizeAuditMode('unknown')).toBe('standard');
  });

  it('distinguishes disabled, standard, and full audit behavior', () => {
    expect(shouldRecordAudit('off')).toBe(false);
    expect(shouldRecordAudit('standard')).toBe(true);
    expect(isFullAuditMode('full')).toBe(true);
    expect(isFullAuditMode('standard')).toBe(false);
  });
});
