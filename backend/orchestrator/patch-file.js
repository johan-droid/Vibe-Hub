import fs from 'fs/promises';
import path from 'path';

const DEFAULT_MIN_SCORE = 0.78;
const AMBIGUITY_MARGIN = 0.025;
const TOP_CANDIDATE_LIMIT = 24;
const RESTRICTED_SEGMENTS = new Set(['.git', 'node_modules']);

export class PatchFileError extends Error {
  constructor(code, message, metadata = {}) {
    super(message);
    this.name = 'PatchFileError';
    this.code = code;
    this.metadata = metadata;
  }
}

export function resolveDefaultWorkspaceRoot() {
  const configuredRoot = process.env.SELINA_WORKSPACE_ROOT
    || process.env.WORKSPACE_ROOT
    || process.env.VFS_WORK_DIR;
  if (configuredRoot) return path.resolve(configuredRoot);

  const cwd = path.resolve(process.cwd());
  if (path.basename(cwd) === 'server-bridge' && path.basename(path.dirname(cwd)) === 'apps') {
    return path.resolve(cwd, '..', '..');
  }
  return cwd;
}

export function resolveWorkspacePath(targetPath, rootDir = resolveDefaultWorkspaceRoot()) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new PatchFileError('PATCH_INVALID_PATH', 'patch_file requires a non-empty path string.');
  }

  const root = path.resolve(rootDir);
  const absolutePath = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(root, targetPath);
  const relativePath = path.relative(root, absolutePath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new PatchFileError('PATCH_PATH_ESCAPE', `Refusing to patch outside workspace root: ${targetPath}`);
  }

  const segments = relativePath.split(path.sep);
  if (segments.some(segment => RESTRICTED_SEGMENTS.has(segment) || (segment.startsWith('.') && segment !== '.' && segment !== '..'))) {
    throw new PatchFileError('PATCH_RESTRICTED_PATH', `Refusing to patch restricted or hidden path: ${targetPath}`);
  }

  return {
    root,
    absolutePath,
    relativePath: relativePath.split(path.sep).join('/'),
  };
}

function findAllIndexes(content, searchContent) {
  const indexes = [];
  let index = content.indexOf(searchContent);
  while (index !== -1) {
    indexes.push(index);
    index = content.indexOf(searchContent, index + Math.max(1, searchContent.length));
  }
  return indexes;
}

function splitLineRecords(text) {
  const records = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '' && match.index >= text.length) break;
    records.push({
      text: match[1],
      ending: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
    if (match[2] === '') break;
  }

  return records;
}

function lineNumberAt(records, index) {
  if (records.length === 0) return 1;
  for (let i = 0; i < records.length; i += 1) {
    if (index < records[i].end) return i + 1;
  }
  return records.length;
}

function matchFromOffsets(content, startIndex, endIndex, exact, score = 1) {
  const records = splitLineRecords(content);
  return {
    startIndex,
    endIndex,
    startLine: lineNumberAt(records, startIndex),
    endLine: lineNumberAt(records, Math.max(startIndex, endIndex - 1)),
    score,
    exact,
  };
}

function normalizeForMatch(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim().replace(/[ \t]+/g, ' '))
    .join('\n')
    .trim();
}

function buildCharGrams(text, width = 3) {
  const normalized = text.length < width ? `${text} `.repeat(width).slice(0, width) : text;
  const grams = new Map();
  for (let i = 0; i <= normalized.length - width; i += 1) {
    const gram = normalized.slice(i, i + width);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

function gramSimilarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;

  const leftGrams = buildCharGrams(left);
  const rightGrams = buildCharGrams(right);
  let intersection = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const [gram, count] of leftGrams) {
    leftCount += count;
    intersection += Math.min(count, rightGrams.get(gram) || 0);
  }
  for (const count of rightGrams.values()) rightCount += count;

  return (2 * intersection) / (leftCount + rightCount);
}

function levenshteinDistance(left, right) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    const leftChar = left.charCodeAt(i - 1);

    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = leftChar === right.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

function levenshteinSimilarity(left, right) {
  if (left === right) return 1;
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  return 1 - (levenshteinDistance(left, right) / longest);
}

function candidateWindows(records, searchLineCount) {
  const slack = Math.max(2, Math.ceil(searchLineCount * 0.35));
  const minLines = Math.max(1, searchLineCount - slack);
  const maxLines = Math.max(minLines, searchLineCount + slack);
  const windows = [];

  for (let start = 0; start < records.length; start += 1) {
    for (let count = minLines; count <= maxLines; count += 1) {
      const end = start + count - 1;
      if (end >= records.length) break;
      windows.push({ start, end });
    }
  }

  return windows;
}

function chooseBestCandidate(content, searchContent, options = {}) {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const normalizedSearch = normalizeForMatch(searchContent);
  const records = splitLineRecords(content);
  const searchLineCount = Math.max(1, splitLineRecords(searchContent).length);
  const searchEndsWithNewline = /(?:\r\n|\n|\r)$/.test(searchContent);
  const roughFloor = Math.max(0.35, minScore - 0.28);
  const candidates = [];

  for (const window of candidateWindows(records, searchLineCount)) {
    const startIndex = records[window.start].start;
    const endIndex = searchEndsWithNewline
      ? records[window.end].end
      : records[window.end].end - records[window.end].ending.length;
    const text = content.slice(startIndex, endIndex);
    const normalizedText = normalizeForMatch(text);
    const roughScore = gramSimilarity(normalizedSearch, normalizedText);

    if (roughScore >= roughFloor) {
      candidates.push({
        startIndex,
        endIndex,
        startLine: window.start + 1,
        endLine: window.end + 1,
        roughScore,
        normalizedText,
      });
    }
  }

  const scored = candidates
    .sort((left, right) => right.roughScore - left.roughScore)
    .slice(0, TOP_CANDIDATE_LIMIT)
    .map(candidate => ({
      ...candidate,
      score: levenshteinSimilarity(normalizedSearch, candidate.normalizedText),
      exact: false,
    }))
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0 || scored[0].score < minScore) {
    throw new PatchFileError(
      'PATCH_SEARCH_NOT_FOUND',
      `No sufficiently similar block found for patch_file search_content. Best score: ${scored[0]?.score?.toFixed(3) || 'none'}.`,
      { minScore, bestScore: scored[0]?.score || 0 },
    );
  }

  const [best, second] = scored;
  if (second && second.score >= minScore && best.score - second.score <= AMBIGUITY_MARGIN) {
    throw new PatchFileError(
      'PATCH_AMBIGUOUS',
      'patch_file search_content matched multiple similar blocks. Add more surrounding context.',
      {
        bestScore: best.score,
        secondScore: second.score,
        matches: [
          { startLine: best.startLine, endLine: best.endLine, score: best.score },
          { startLine: second.startLine, endLine: second.endLine, score: second.score },
        ],
      },
    );
  }

  return best;
}

export function findBestFuzzyBlock(content, searchContent, options = {}) {
  if (!searchContent || typeof searchContent !== 'string') {
    throw new PatchFileError('PATCH_EMPTY_SEARCH', 'patch_file search_content must be a non-empty string.');
  }

  const exactMatches = findAllIndexes(content, searchContent);
  if (exactMatches.length === 1) {
    return matchFromOffsets(content, exactMatches[0], exactMatches[0] + searchContent.length, true);
  }

  if (exactMatches.length > 1) {
    throw new PatchFileError(
      'PATCH_AMBIGUOUS',
      'patch_file search_content matched multiple exact blocks. Add more surrounding context.',
      { matches: exactMatches.length },
    );
  }

  return chooseBestCandidate(content, searchContent, options);
}

function detectNewline(content) {
  const crlf = content.match(/\r\n/g)?.length || 0;
  const lf = content.match(/(?<!\r)\n/g)?.length || 0;
  return crlf > lf ? '\r\n' : '\n';
}

function normalizeReplacementNewlines(replacementContent, newline) {
  return String(replacementContent ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, newline);
}

export async function applyFuzzyPatchFile({
  path: targetPath,
  search_content: searchContent,
  replace_content: replaceContent,
  rootDir = resolveDefaultWorkspaceRoot(),
  minScore = DEFAULT_MIN_SCORE,
} = {}) {
  const { absolutePath, relativePath, root } = resolveWorkspacePath(targetPath, rootDir);
  const originalContent = await fs.readFile(absolutePath, 'utf-8');
  const match = findBestFuzzyBlock(originalContent, searchContent, { minScore });
  const newline = detectNewline(originalContent);
  const replacement = normalizeReplacementNewlines(replaceContent, newline);
  const nextContent = `${originalContent.slice(0, match.startIndex)}${replacement}${originalContent.slice(match.endIndex)}`;

  await fs.writeFile(absolutePath, nextContent, 'utf-8');

  return {
    success: true,
    path: relativePath,
    root,
    startLine: match.startLine,
    endLine: match.endLine,
    score: Number(match.score.toFixed(4)),
    exact: match.exact,
    bytesChanged: Buffer.byteLength(nextContent, 'utf-8') - Buffer.byteLength(originalContent, 'utf-8'),
  };
}
