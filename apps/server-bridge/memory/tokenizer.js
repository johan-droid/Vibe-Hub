export function countTokens(text) {
  if (typeof text !== 'string') text = JSON.stringify(text ?? '');
  return Math.ceil(text.length / 4);
}

export function tokenize(text) {
  if (!text) return [];
  return text.match(/[\w]+|[^\s\w]/g) || [];
}
