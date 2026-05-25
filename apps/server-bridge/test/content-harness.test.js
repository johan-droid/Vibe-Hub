import { describe, expect, it } from 'vitest';
import {
  buildHarnessedMemoryEntries,
  extractHarnessKeywords,
  normalizeHarnessText,
} from '../memory/content-harness.js';
import { buildRecallPatterns, buildRecallTerms } from '../memory/query-sanitizer.js';

describe('content harnessing', () => {
  it('normalizes uploaded text and removes control characters', () => {
    const normalized = normalizeHarnessText('  # Plan\r\nalpha\u0000\u0007\r\n\r\n\r\nbeta  ');

    expect(normalized.text).toBe('# Plan\nalpha\n\nbeta');
    expect(normalized.truncated).toBe(false);
  });

  it('builds summary and chunk entries for agent memory recall', () => {
    const content = [
      '# Product Notes',
      '',
      'Authentication flow uses session cookies and CSRF protection.',
      'Uploads should be indexed into memory for later agent recall.',
      'The dashboard exposes repositories, MCP servers, and pending diffs.',
    ].join('\n');

    const harnessed = buildHarnessedMemoryEntries({
      sourceName: 'notes.md',
      sourcePath: '/uploads/files/notes.md',
      content,
      mimeType: 'text/markdown',
      kind: 'document',
      tags: ['upload', 'notes'],
    });

    expect(harnessed.summary).toContain('Product Notes');
    expect(harnessed.keywords).toEqual(expect.arrayContaining(['authentication', 'dashboard']));
    expect(harnessed.itemsStored).toBeGreaterThanOrEqual(2);
    expect(harnessed.entries[0]).toMatchObject({
      kind: 'content_harness_summary',
      metadata: expect.objectContaining({
        harnessed: true,
        memoryClass: 'source',
        ragStage: 'canonicalized_source',
        sourceName: 'notes.md',
        contentKind: 'document',
      }),
    });
    expect(harnessed.entries[1].content).toContain('Uploads should be indexed into memory');
  });

  it('extracts stable recall terms from natural prompts', () => {
    expect(extractHarnessKeywords('dashboard dashboard auth auth cookies uploads')).toEqual([
      'auth',
      'dashboard',
      'cookies',
      'uploads',
    ]);

    expect(buildRecallTerms('Can you use the uploaded auth cookies notes from the dashboard?')).toEqual([
      'uploaded',
      'auth',
      'cookies',
      'notes',
      'dashboard',
    ]);

    expect(buildRecallPatterns('Find the CSRF upload dashboard note')).toEqual([
      '%find%',
      '%csrf%',
      '%upload%',
      '%dashboard%',
      '%note%',
    ]);
  });
});
