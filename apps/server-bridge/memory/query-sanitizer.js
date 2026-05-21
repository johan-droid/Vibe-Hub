const RESERVED_SYNTAX_PATTERN = /[+\-!(){}\[\]^"~*?:\\/|&]/g;
const BOOLEAN_OPERATORS_PATTERN = /\b(?:AND|OR|NOT)\b/g;
const REGEX_DELIMITER_PATTERN = /(^|[\s(])\/[^/\n]{1,200}\/[gimsuy]*/g;
const WHITESPACE_PATTERN = /\s+/g;
const LIKE_META_PATTERN = /([\\%_])/g;

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

