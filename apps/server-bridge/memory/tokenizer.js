import { encoding_for_model, get_encoding } from 'tiktoken';

const DEFAULT_MODEL = 'gpt-4o-mini';
const FALLBACK_ENCODING = 'o200k_base';
const MESSAGE_OVERHEAD_TOKENS = 4;
const encoderCache = new Map();

export function countTokens(text, options = {}) {
  const normalized = normalizeTokenText(text);
  if (!normalized) return 0;
  return getEncoder(options.model).encode(normalized).length;
}

export function tokenize(text, options = {}) {
  const normalized = normalizeTokenText(text);
  if (!normalized) return [];
  return Array.from(getEncoder(options.model).encode(normalized));
}

export function countMessageTokens(message, options = {}) {
  return countTokens(extractMessageText(message), options) + MESSAGE_OVERHEAD_TOKENS;
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
