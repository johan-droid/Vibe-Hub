const RESERVED_SYNTAX_PATTERN = /[+\-!(){}\[\]^"~*?:\\/|&]/g;
const BOOLEAN_OPERATORS_PATTERN = /\b(?:AND|OR|NOT)\b/g;
const REGEX_DELIMITER_PATTERN = /(^|[\s(])\/[^/\n]{1,200}\/[gimsuy]*/g;
const WHITESPACE_PATTERN = /\s+/g;
const LIKE_META_PATTERN = /([\\%_])/g;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'agent', 'also', 'among', 'been', 'before', 'being',
  'can', 'could', 'for', 'from', 'have', 'into', 'just', 'like', 'make', 'need', 'only',
  'over', 'same', 'should', 'some', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'this', 'through', 'under', 'use', 'using', 'very', 'want', 'what',
  'when', 'where', 'which', 'while', 'with', 'would', 'you', 'your',
]);

export function sanitizeRagQuery(query, { maxLength = 240 } = {}) {
  const original = String(query ?? '');
  const stripped = original
    .replace(REGEX_DELIMITER_PATTERN, ' ')
    .replace(BOOLEAN_OPERATORS_PATTERN, ' ')
    .replace(RESERVED_SYNTAX_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return stripped.slice(0, maxLength);
}

export function escapeLikePattern(query, { maxLength = 240 } = {}) {
  return sanitizeRagQuery(query, { maxLength }).replace(LIKE_META_PATTERN, '\\$1');
}

export function buildRecallTerms(query, { maxTerms = 6 } = {}) {
  const sanitized = sanitizeRagQuery(query, { maxLength: 240 }).toLowerCase();
  if (!sanitized) return [];

  const words = sanitized.match(/[a-z][a-z0-9_-]{2,}/g) || [];
  const seen = new Set();
  const terms = [];

  for (const word of words) {
    if (STOP_WORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= maxTerms) break;
  }

  return terms;
}

export function buildRecallPatterns(query, { maxTerms = 6 } = {}) {
  const terms = buildRecallTerms(query, { maxTerms });
  return terms.map(term => `%${escapeLikePattern(term, { maxLength: term.length })}%`);
}

