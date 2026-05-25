import { describe, expect, it } from 'vitest';
import {
  buildEvidencePacket,
  classifyRetrievalPlan,
  inferMemoryClass,
  rankMemoryItems,
} from '../memory/rag-layers.js';

describe('RAG retrieval planning', () => {
  it('classifies auth-oriented queries into a source-first retrieval plan', () => {
    const plan = classifyRetrievalPlan('How do session cookies and CSRF protection work in the dashboard auth flow?');

    expect(plan).toMatchObject({
      queryType: 'auth',
      recallStrategy: 'lexical_first',
      riskLevel: 'high',
      requireSourceEvidence: true,
      preferredMemoryClasses: ['source', 'learned', 'working'],
    });
    expect(plan.terms).toEqual(expect.arrayContaining(['session', 'cookies', 'csrf']));
  });

  it('keeps code and error queries chunk-oriented and budget-aware', () => {
    const plan = classifyRetrievalPlan('Fix the router.js build error in the upload handler');

    expect(plan.queryType).toBe('error');
    expect(plan.preferredKinds[0]).toBe('content_harness_chunk');
    expect(plan.evidenceTokenBudget).toBeGreaterThanOrEqual(800);
  });
});

describe('RAG evidence packing', () => {
  it('prefers source memory over learned memory for grounded auth queries', () => {
    const items = [
      {
        kind: 'brain_journal',
        content: 'We once fixed a login issue by adjusting a button. This is not the source of truth.',
        metadata: {
          source: 'brain_journal',
          memoryClass: 'learned',
          tags: ['ui'],
        },
        created_at: '2026-05-20T10:00:00.000Z',
        project_name: 'default',
      },
      {
        kind: 'content_harness_summary',
        content: [
          'Source: auth-notes.md',
          'Path: /uploads/files/auth-notes.md',
          'Summary:',
          'Authentication flow uses session cookies and CSRF protection for dashboard actions.',
        ].join('\n'),
        metadata: {
          harnessed: true,
          memoryClass: 'source',
          entryType: 'summary',
          sourceName: 'auth-notes.md',
          sourcePath: '/uploads/files/auth-notes.md',
          tags: ['upload', 'auth'],
          keywords: ['authentication', 'session', 'csrf', 'dashboard'],
        },
        created_at: '2026-05-25T10:00:00.000Z',
        project_name: 'default',
      },
    ];

    const packet = buildEvidencePacket({
      query: 'How does auth and CSRF work for the dashboard session flow?',
      items,
    });

    expect(packet.queryType).toBe('auth');
    expect(packet.selectedCount).toBeGreaterThan(0);
    expect(packet.evidence[0]).toMatchObject({
      kind: 'content_harness_summary',
      memoryClass: 'source',
      sourcePath: '/uploads/files/auth-notes.md',
    });
    expect(packet.promptBlock).toContain('=== RETRIEVED EVIDENCE ===');
    expect(packet.promptBlock).toContain('Query Type: auth');
    expect(packet.promptBlock).toContain('Recall Strategy: lexical_first');
    expect(packet.promptBlock).toContain('Risk Level: high');
    expect(packet.citations[0]).toContain('/uploads/files/auth-notes.md');
    expect(packet.riskFlags).toEqual([]);
  });

  it('infers memory classes and ranks chunk evidence for code-like queries', () => {
    const plan = classifyRetrievalPlan('Patch the upload handler in router.js');
    const ranked = rankMemoryItems([
      {
        kind: 'content_harness_chunk',
        content: 'router.js upload handler validates files and stores dashboard metadata.',
        metadata: {
          harnessed: true,
          entryType: 'chunk',
          sourcePath: '/repo/src/router.js',
          sourceName: 'router.js',
          keywords: ['router', 'upload', 'handler'],
        },
        created_at: '2026-05-25T11:00:00.000Z',
        project_name: 'default',
      },
      {
        kind: 'brain_journal',
        content: 'Remember to keep handlers small.',
        metadata: {
          source: 'brain_journal',
        },
        created_at: '2026-05-24T11:00:00.000Z',
        project_name: 'default',
      },
    ], plan);

    expect(inferMemoryClass('content_harness_chunk', { harnessed: true })).toBe('source');
    expect(inferMemoryClass('brain_journal', { source: 'brain_journal' })).toBe('learned');
    expect(ranked[0]).toMatchObject({
      kind: 'content_harness_chunk',
      memoryClass: 'source',
    });
    expect(ranked[0].selectionReason).toContain('matched');
  });

  it('flags high-risk retrievals that lack source evidence', () => {
    const packet = buildEvidencePacket({
      query: 'Patch the auth middleware and session validation flow',
      items: [
        {
          kind: 'brain_journal',
          content: 'We probably fixed auth once by changing a middleware order.',
          metadata: {
            source: 'brain_journal',
            memoryClass: 'learned',
          },
          created_at: '2026-05-24T11:00:00.000Z',
          project_name: 'default',
        },
      ],
    });

    expect(packet.queryType).toBe('auth');
    expect(packet.requiresSourceEvidence).toBe(true);
    expect(packet.sourceCount).toBe(0);
    expect(packet.riskFlags).toContain('missing_source_evidence');
  });
});
