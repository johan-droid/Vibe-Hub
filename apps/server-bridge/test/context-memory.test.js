import { afterEach, describe, expect, it, vi } from 'vitest';
import { countTokens, tokenize } from '../memory/tokenizer.js';
import { ContextPruner } from '../orchestrator/utils/context-pruner.js';
import { ContextCompressor } from '../orchestrator/agents/context-compressor.js';
import { TokenGovernor } from '../orchestrator/token-governor.js';

describe('memory tokenizer', () => {
  it('uses a real tokenizer instead of the length-divided heuristic', () => {
    const sample = 'const x = 1;';
    expect(countTokens(sample)).toBe(6);
    expect(tokenize(sample)).toHaveLength(6);
  });

  it('extracts text from structured messages before counting', () => {
    const message = {
      role: 'user',
      parts: [{ text: 'alpha' }, { text: 'beta' }],
    };

    expect(countTokens(message)).toBeGreaterThan(0);
    expect(tokenize(message)).toHaveLength(countTokens(message));
  });
});

describe('ContextPruner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anchors the system prompt and keeps the most recent exchanges', async () => {
    vi.spyOn(TokenGovernor.prototype, 'getCompute').mockResolvedValue('Older context summary');

    const pruner = new ContextPruner({
      maxHistoryTokens: 40,
      targetHistoryTokens: 100,
      recentUserTurns: 2,
    });

    const history = [
      { role: 'system', content: 'You are a coding agent. Always preserve architecture rules.' },
      { role: 'user', content: 'first request with a fair bit of detail' },
      { role: 'assistant', content: 'first answer with implementation notes' },
      { role: 'user', content: 'second request with more detail to keep token counts high' },
      { role: 'assistant', content: 'second answer that should be summarized away' },
      { role: 'user', content: 'third request that must stay visible' },
      { role: 'assistant', content: 'third answer that must stay visible' },
      { role: 'user', content: 'fourth request that must stay visible' },
      { role: 'assistant', content: 'fourth answer that must stay visible' },
    ];

    const pruned = await pruner.pruneSessionMemory(history);

    expect(pruned[0]).toMatchObject({ role: 'system', content: history[0].content });
    expect(pruned[1]).toMatchObject({ role: 'user', content: expect.stringContaining('Context summary:') });
    expect(pruned).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: 'third request that must stay visible' }),
      expect.objectContaining({ role: 'assistant', content: 'third answer that must stay visible' }),
      expect.objectContaining({ role: 'user', content: 'fourth request that must stay visible' }),
      expect.objectContaining({ role: 'assistant', content: 'fourth answer that must stay visible' }),
    ]));
  });
});

describe('ContextCompressor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs a map-reduce compression pass across chunked logs and code', async () => {
    const getCompute = vi.spyOn(TokenGovernor.prototype, 'getCompute');
    getCompute
      .mockResolvedValueOnce(JSON.stringify({
        source: 'errorLogs',
        chunkLabel: 'errorLogs:1-2',
        pointOfFailure: 'Unhandled TypeError in router',
        evidence: ['TypeError: x is undefined'],
        relevantAreas: ['router.js'],
        risk: 'request path crashes',
      }))
      .mockResolvedValueOnce(JSON.stringify({
        source: 'rawCode',
        chunkLabel: 'rawCode:1-2',
        pointOfFailure: 'Guard clause missing in handler',
        evidence: ['handler accesses x before null check'],
        relevantAreas: ['router.js', 'handler()'],
        risk: 'crash on malformed payload',
      }))
      .mockResolvedValueOnce(JSON.stringify({
        pointOfFailure: 'router.js handler dereferences x before validating the payload.',
        evidence: ['TypeError: x is undefined', 'handler accesses x before null check'],
        relevantAreas: ['router.js', 'handler()'],
        nextStep: 'Add an input guard before dereferencing x.',
      }));

    const compressor = new ContextCompressor({ mapChunkTokenBudget: 20 });
    const result = await compressor.minifyContext(
      ['function handler(x) {', '  return x.value;', '}'].join('\n'),
      'Fix the crashing route',
      ['TypeError: x is undefined', 'at handler (router.js:4:10)'].join('\n')
    );

    expect(getCompute).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      pointOfFailure: 'router.js handler dereferences x before validating the payload.',
      evidence: ['TypeError: x is undefined', 'handler accesses x before null check'],
      relevantAreas: ['router.js', 'handler()'],
      nextStep: 'Add an input guard before dereferencing x.',
    });
  });
});
