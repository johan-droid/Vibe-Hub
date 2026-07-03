import crypto from 'crypto';
import { chunkTextByTokenBudget, countTokens, fitTextToTokenBudget } from './tokenizer.js';

const MAX_CONTENT_CHARS = 100_000;
const CHUNK_TOKEN_BUDGET = 220;
const MAX_CHUNKS = 8;
const KEYWORD_LIMIT = 8;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HEADING_PREFIX = /^(#{1,6}\s+|[A-Z][A-Z0-9 _-]{3,}:?$|[-*]\s+|\d+\.\s+)/;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'agent', 'also', 'and', 'another', 'been', 'before', 'being',
  'between', 'build', 'built', 'can', 'code', 'content', 'could', 'data', 'does', 'each',
  'for', 'from', 'have', 'into', 'just', 'like', 'make', 'more', 'most', 'need', 'only',
  'other', 'over', 'project', 'same', 'should', 'some', 'such', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'this', 'through', 'under', 'use', 'using',
  'very', 'want', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would',
  'you', 'your',
]);

export function normalizeHarnessText(value, { maxChars = MAX_CONTENT_CHARS } = {}) {
  const original = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .trim();

  if (!original) return { text: '', truncated: false, originalLength: 0 };

  const collapsed = original
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  const text = collapsed.slice(0, maxChars);
  return {
    text,
    truncated: collapsed.length > text.length,
    originalLength: collapsed.length,
  };
}

export function extractHarnessKeywords(text, { limit = KEYWORD_LIMIT } = {}) {
  const matches = String(text || '').toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || [];
  const counts = new Map();

  for (const word of matches) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function buildHarnessSummary({ sourceName, sourcePath, content }) {
  const lines = String(content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const highlights = [];

  for (const line of lines) {
    if (HEADING_PREFIX.test(line) || highlights.length < 3) {
      highlights.push(line);
    }
    if (highlights.length >= 8) break;
  }

  const candidate = [
    sourceName ? `Source: ${sourceName}` : null,
    sourcePath ? `Path: ${sourcePath}` : null,
    ...highlights,
  ].filter(Boolean).join('\n');

  return fitTextToTokenBudget(candidate || content, 180, { mode: 'head-tail' }).text;
}

function selectRepresentativeChunks(chunks, maxChunks = MAX_CHUNKS) {
  if (chunks.length <= maxChunks) return chunks;

  const headCount = Math.max(1, Math.ceil(maxChunks * 0.75));
  const tailCount = Math.max(0, maxChunks - headCount);
  const selected = [
    ...chunks.slice(0, headCount),
    ...chunks.slice(-tailCount),
  ];

  return selected.filter((chunk, index, list) =>
    list.findIndex(other => other.label === chunk.label) === index
  );
}

function createContentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const harnessCache = new Map();
const HARNESS_CACHE_LIMIT = 500;

export function buildHarnessedMemoryEntries({
  sourceName,
  sourcePath,
  content,
  mimeType = 'text/plain',
  kind = 'upload',
  tags = [],
} = {}) {
  const normalized = normalizeHarnessText(content);
  if (!normalized.text) {
    throw new Error('Content is empty after normalization.');
  }

  const contentHash = createContentHash(normalized.text);
  if (harnessCache.has(contentHash)) {
    const cached = harnessCache.get(contentHash);
    harnessCache.delete(contentHash);
    harnessCache.set(contentHash, cached);
    return cached;
  }

  const keywords = extractHarnessKeywords(normalized.text);
  const summary = buildHarnessSummary({
    sourceName,
    sourcePath,
    content: normalized.text,
  });
  const excerpt = fitTextToTokenBudget(normalized.text, 260, { mode: 'head-tail' });
  const allChunks = chunkTextByTokenBudget(sourceName || 'content', normalized.text, CHUNK_TOKEN_BUDGET);
  const chunks = selectRepresentativeChunks(allChunks, MAX_CHUNKS);
  const tokenCount = countTokens(normalized.text);

  const commonMetadata = {
    harnessed: true,
    memoryClass: 'source',
    ragStage: 'canonicalized_source',
    sourceName,
    sourcePath,
    mimeType,
    contentKind: kind,
    tags,
    keywords,
    contentHash,
    tokenCount,
    truncated: normalized.truncated,
    originalLength: normalized.originalLength,
    storedLength: normalized.text.length,
  };

  const entries = [
    {
      kind: 'content_harness_summary',
      content: [
        sourceName ? `Source: ${sourceName}` : null,
        sourcePath ? `Path: ${sourcePath}` : null,
        `Type: ${kind}`,
        mimeType ? `MIME: ${mimeType}` : null,
        keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : null,
        'Summary:',
        summary,
        '',
        'Excerpt:',
        excerpt.text,
      ].filter(Boolean).join('\n'),
      metadata: {
        ...commonMetadata,
        entryType: 'summary',
      },
    },
    ...chunks.map((chunk, index) => ({
      kind: 'content_harness_chunk',
      content: [
        sourceName ? `Source: ${sourceName}` : null,
        sourcePath ? `Path: ${sourcePath}` : null,
        `Chunk: ${index + 1}/${chunks.length}`,
        keywords.length > 0 ? `Keywords: ${keywords.slice(0, 5).join(', ')}` : null,
        'Content:',
        chunk.text,
      ].filter(Boolean).join('\n'),
      metadata: {
        ...commonMetadata,
        entryType: 'chunk',
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        chunkLabel: chunk.label,
        chunkTokenEstimate: chunk.tokenEstimate,
      },
    })),
  ];

  const result = {
    summary,
    keywords,
    tokenCount,
    chunkCount: chunks.length,
    itemsStored: entries.length,
    truncated: normalized.truncated,
    contentHash,
    entries,
  };

  if (harnessCache.size >= HARNESS_CACHE_LIMIT) {
    const firstKey = harnessCache.keys().next().value;
    harnessCache.delete(firstKey);
  }
  harnessCache.set(contentHash, result);

  return result;
}
