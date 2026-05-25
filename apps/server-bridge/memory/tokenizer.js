import { encoding_for_model, get_encoding } from 'tiktoken';

const DEFAULT_MODEL = 'gpt-4o-mini';
const FALLBACK_ENCODING = 'o200k_base';
const MESSAGE_OVERHEAD_TOKENS = 4;
const TOKEN_COUNT_CACHE_LIMIT = 2500;
const encoderCache = new Map();
const tokenCountCache = new Map();
const fitTextCache = new Map();
const tokenCacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
};

export function countTokens(text, options = {}) {
  const normalized = normalizeTokenText(text);
  if (!normalized) return 0;

  const cacheKey = tokenCacheKey(normalized, options);
  if (tokenCountCache.has(cacheKey)) {
    const value = tokenCountCache.get(cacheKey);
    tokenCountCache.delete(cacheKey);
    tokenCountCache.set(cacheKey, value);
    tokenCacheStats.hits += 1;
    return value;
  }

  tokenCacheStats.misses += 1;
  const value = Array.from(getEncoder(options.model).encode(normalized)).length;
  rememberTokenCount(cacheKey, value);
  return value;
}

export function countTokensPrecise(text, options = {}) {
  return countTokens(text, options);
}

export function tokenize(text, options = {}) {
  const normalized = normalizeTokenText(text);
  if (!normalized) return [];
  return Array.from(getEncoder(options.model).encode(normalized));
}

export function decodeTokens(tokens, options = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return '';
  const decoded = getEncoder(options.model).decode(new Uint32Array(tokens));
  return new TextDecoder().decode(decoded);
}

export function countMessageTokens(message, options = {}) {
  return countTokens(extractMessageText(message), options) + MESSAGE_OVERHEAD_TOKENS;
}

export function fitTextToTokenBudget(text, maxTokens, options = {}) {
  const normalized = normalizeTokenText(text);
  const budget = Math.max(0, Number.parseInt(maxTokens, 10) || 0);
  
  const cacheKey = `${tokenCacheKey(normalized, options)}:${budget}:${options.mode || 'head-tail'}`;
  if (fitTextCache.has(cacheKey)) {
    const value = fitTextCache.get(cacheKey);
    fitTextCache.delete(cacheKey);
    fitTextCache.set(cacheKey, value);
    tokenCacheStats.hits += 1;
    return value;
  }
  tokenCacheStats.misses += 1;

  const originalTokens = countTokens(normalized, options);
  if (!normalized || budget <= 0) {
    const res = {
      text: '',
      originalTokens,
      tokens: 0,
      truncated: Boolean(normalized),
      savedTokens: originalTokens,
    };
    if (fitTextCache.size >= TOKEN_COUNT_CACHE_LIMIT) {
      const firstKey = fitTextCache.keys().next().value;
      fitTextCache.delete(firstKey);
      tokenCacheStats.evictions += 1;
    }
    fitTextCache.set(cacheKey, res);
    return res;
  }
  if (originalTokens <= budget) {
    const res = {
      text: normalized,
      originalTokens,
      tokens: originalTokens,
      truncated: false,
      savedTokens: 0,
    };
    if (fitTextCache.size >= TOKEN_COUNT_CACHE_LIMIT) {
      const firstKey = fitTextCache.keys().next().value;
      fitTextCache.delete(firstKey);
      tokenCacheStats.evictions += 1;
    }
    fitTextCache.set(cacheKey, res);
    return res;
  }

  const mode = options.mode || 'head-tail';
  const marker = options.marker || '\n...[token-budget-trimmed]...\n';
  const markerTokens = tokenize(marker, options);
  const sourceTokens = tokenize(normalized, options);
  const usableTokens = Math.max(1, budget - markerTokens.length);
  let fittedTokens;

  if (mode === 'head') {
    fittedTokens = [...sourceTokens.slice(0, usableTokens), ...markerTokens];
  } else if (mode === 'tail') {
    fittedTokens = [...markerTokens, ...sourceTokens.slice(-usableTokens)];
  } else {
    const headTokens = Math.ceil(usableTokens * (options.headRatio ?? 0.5));
    const tailTokens = Math.max(0, usableTokens - headTokens);
    fittedTokens = [
      ...sourceTokens.slice(0, headTokens),
      ...markerTokens,
      ...sourceTokens.slice(sourceTokens.length - tailTokens),
    ];
  }

  let fittedText = decodeTokens(fittedTokens, options);
  let fittedCount = countTokens(fittedText, options);

  while (fittedCount > budget && fittedTokens.length > 1) {
    fittedTokens = fittedTokens.slice(0, -1);
    fittedText = decodeTokens(fittedTokens, options);
    fittedCount = countTokens(fittedText, options);
  }

  const finalRes = {
    text: fittedText,
    originalTokens,
    tokens: fittedCount,
    truncated: true,
    savedTokens: Math.max(0, originalTokens - fittedCount),
  };
  
  if (fitTextCache.size >= TOKEN_COUNT_CACHE_LIMIT) {
    const firstKey = fitTextCache.keys().next().value;
    fitTextCache.delete(firstKey);
    tokenCacheStats.evictions += 1;
  }
  fitTextCache.set(cacheKey, finalRes);
  return finalRes;
}

export function chunkTextByTokenBudget(source, text, tokenBudget, options = {}) {
  const normalized = typeof text === 'string' ? text.trim() : '';
  const budget = Math.max(1, Number.parseInt(tokenBudget, 10) || 1);
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/);
  const chunks = [];
  let currentLines = [];
  let currentTokenEstimate = 0;
  let currentStartLine = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineTokenEstimate = countTokens(line, options) + 1;

    if (lineTokenEstimate > budget) {
      if (currentLines.length > 0) {
        chunks.push(buildTokenChunk(source, currentStartLine, index, currentLines, currentTokenEstimate));
        currentLines = [];
        currentTokenEstimate = 0;
      }

      const lineTokens = tokenize(line, options);
      for (let cursor = 0; cursor < lineTokens.length; cursor += budget) {
        const partTokens = lineTokens.slice(cursor, cursor + budget);
        const partIndex = Math.floor(cursor / budget) + 1;
        chunks.push({
          source,
          label: `${source}:${index + 1}.${partIndex}`,
          text: decodeTokens(partTokens, options),
          tokenEstimate: partTokens.length,
        });
      }
      currentStartLine = index + 2;
      continue;
    }

    if (currentLines.length > 0 && currentTokenEstimate + lineTokenEstimate > budget) {
      chunks.push(buildTokenChunk(source, currentStartLine, index, currentLines, currentTokenEstimate));
      currentLines = [line];
      currentTokenEstimate = lineTokenEstimate;
      currentStartLine = index + 1;
      continue;
    }

    currentLines.push(line);
    currentTokenEstimate += lineTokenEstimate;
  }

  if (currentLines.length > 0) {
    chunks.push(buildTokenChunk(source, currentStartLine, lines.length, currentLines, currentTokenEstimate));
  }

  return chunks;
}

export function getTokenizerCacheStats() {
  return {
    ...tokenCacheStats,
    size: tokenCountCache.size,
  };
}

export function resetTokenizerCache() {
  tokenCountCache.clear();
  tokenCacheStats.hits = 0;
  tokenCacheStats.misses = 0;
  tokenCacheStats.evictions = 0;
}

export function extractMessageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;

  if (Array.isArray(message.parts)) {
    return message.parts.map(part => extractMessageText(part?.text ?? part)).filter(Boolean).join('\n');
  }

  if (Array.isArray(message.content)) {
    return message.content.map(item => {
      if (typeof item === 'string') return item;
      if (item?.text) return item.text;
      if (item?.content) return extractMessageText(item.content);
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }).filter(Boolean).join('\n');
  }

  if (typeof message.content === 'string') return message.content;
  if (message.text) return message.text;

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function getEncoder(model = DEFAULT_MODEL) {
  const cacheKey = model || DEFAULT_MODEL;
  if (!encoderCache.has(cacheKey)) {
    try {
      encoderCache.set(cacheKey, encoding_for_model(cacheKey));
    } catch {
      encoderCache.set(cacheKey, get_encoding(FALLBACK_ENCODING));
    }
  }
  return encoderCache.get(cacheKey);
}

function normalizeTokenText(text) {
  if (typeof text === 'string') return text;
  if (!text) return '';
  if (typeof text === 'object') return extractMessageText(text);
  return String(text);
}

function rememberTokenCount(cacheKey, value) {
  if (tokenCountCache.size >= TOKEN_COUNT_CACHE_LIMIT) {
    const oldestKey = tokenCountCache.keys().next().value;
    tokenCountCache.delete(oldestKey);
    tokenCacheStats.evictions += 1;
  }
  tokenCountCache.set(cacheKey, value);
}

function tokenCacheKey(text, options = {}) {
  return `${options.model || DEFAULT_MODEL}:${text.length}:${fingerprint(text)}`;
}

function fingerprint(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildTokenChunk(source, startLine, endLine, lines, tokenEstimate) {
  return {
    source,
    label: `${source}:${startLine}-${endLine}`,
    text: lines.join('\n'),
    tokenEstimate,
  };
}
