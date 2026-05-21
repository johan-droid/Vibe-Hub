import { getPromptHardeningDirective } from './prompt-secrets.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

export function hardenSystemPrompt(systemPrompt = '') {
  const base = normalizeText(systemPrompt);
  const directive = getPromptHardeningDirective();
  if (base.includes(directive)) return base;
  return [base, directive].filter(Boolean).join('\n\n');
}

export function wrapUntrustedInput(text, tagName = 'user_query') {
  const normalizedTag = normalizeTagName(tagName);
  const normalizedText = String(text ?? '');
  if (isWrappedWithTag(normalizedText, normalizedTag)) {
    return normalizedText;
  }
  return `<${normalizedTag}>\n${normalizedText}\n</${normalizedTag}>`;
}

export function wrapUserQuery(text) {
  return wrapUntrustedInput(text, 'user_query');
}

export function isWrappedWithTag(text, tagName = 'user_query') {
  const normalizedTag = normalizeTagName(tagName);
  const normalizedText = String(text ?? '').trim();
  return normalizedText.startsWith(`<${normalizedTag}>`) && normalizedText.endsWith(`</${normalizedTag}>`);
}

function normalizeTagName(tagName) {
  return String(tagName || 'user_query')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_') || 'user_query';
}
