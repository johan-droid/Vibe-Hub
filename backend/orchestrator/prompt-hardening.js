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
  
  let coreText = normalizedText;
  if (isWrappedWithTag(normalizedText, normalizedTag)) {
    coreText = normalizedText.slice(normalizedTag.length + 2, -(normalizedTag.length + 3)).trim();
  }
  
  const sanitizedText = coreText
    .replace(new RegExp(`</?${normalizedTag}>`, 'gi'), '[REMOVED_TAG]');

  return `<${normalizedTag}>\n${sanitizedText}\n</${normalizedTag}>`;
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
