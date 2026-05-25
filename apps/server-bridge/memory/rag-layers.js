import path from 'path';
import { buildRecallTerms, sanitizeRagQuery } from './query-sanitizer.js';
import { countTokens, fitTextToTokenBudget } from './tokenizer.js';

export const DEFAULT_RECALL_STRATEGY = 'lexical_first';

const QUERY_TYPE_CONFIG = Object.freeze({
  auth: {
    preferredMemoryClasses: ['source', 'learned', 'working'],
    preferredKinds: ['content_harness_summary', 'content_harness_chunk', 'brain_journal'],
    maxItems: 4,
    evidenceTokenBudget: 700,
    riskLevel: 'high',
    requireSourceEvidence: true,
  },
  code: {
    preferredMemoryClasses: ['source', 'working', 'learned'],
    preferredKinds: ['content_harness_chunk', 'content_harness_summary', 'brain_journal'],
    maxItems: 5,
    evidenceTokenBudget: 820,
    riskLevel: 'high',
    requireSourceEvidence: true,
  },
  docs: {
    preferredMemoryClasses: ['source', 'learned', 'working'],
    preferredKinds: ['content_harness_summary', 'content_harness_chunk', 'brain_journal'],
    maxItems: 4,
    evidenceTokenBudget: 680,
    riskLevel: 'medium',
    requireSourceEvidence: false,
  },
  error: {
    preferredMemoryClasses: ['source', 'working', 'learned'],
    preferredKinds: ['content_harness_chunk', 'brain_journal', 'content_harness_summary'],
    maxItems: 5,
    evidenceTokenBudget: 820,
    riskLevel: 'high',
    requireSourceEvidence: true,
  },
  tooling: {
    preferredMemoryClasses: ['source', 'learned', 'working'],
    preferredKinds: ['content_harness_summary', 'content_harness_chunk', 'brain_journal'],
    maxItems: 4,
    evidenceTokenBudget: 700,
    riskLevel: 'high',
    requireSourceEvidence: true,
  },
  workflow: {
    preferredMemoryClasses: ['source', 'learned', 'working'],
    preferredKinds: ['content_harness_summary', 'brain_journal', 'content_harness_chunk'],
    maxItems: 4,
    evidenceTokenBudget: 680,
    riskLevel: 'medium',
    requireSourceEvidence: false,
  },
  generic: {
    preferredMemoryClasses: ['source', 'learned', 'working'],
    preferredKinds: ['content_harness_summary', 'content_harness_chunk', 'brain_journal'],
    maxItems: 4,
    evidenceTokenBudget: 680,
    riskLevel: 'medium',
    requireSourceEvidence: false,
  },
});

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function classifyQueryType(sanitizedLower) {
  if (!sanitizedLower) return { queryType: 'generic', rationale: 'No query text was provided.' };

  const typeChecks = [
    {
      queryType: 'auth',
      rationale: 'The query references authentication, sessions, cookies, or CSRF mechanics.',
      match: /(?:auth|authentication|authorize|oauth|session|cookie|jwt|token|csrf|permission|tenant|login|logout)/u,
    },
    {
      queryType: 'error',
      rationale: 'The query looks like a bug, crash, stack trace, or failing verification loop.',
      match: /(?:error|bug|failing|failed|exception|trace|stack|crash|build|test|regression|timeout)/u,
    },
    {
      queryType: 'code',
      rationale: 'The query references implementation details such as code, files, handlers, or components.',
      match: /(?:code|function|class|component|handler|router|file|patch|refactor|tsx|jsx|javascript|typescript|module)/u,
    },
    {
      queryType: 'docs',
      rationale: 'The query references docs, guides, specs, notes, or README-style material.',
      match: /(?:docs?|guide|readme|spec|notes?|architecture|design|plan|principles)/u,
    },
    {
      queryType: 'workflow',
      rationale: 'The query is asking for process, planning, or execution guidance.',
      match: /(?:workflow|roadmap|process|steps?|sequence|plan|triage|how should)/u,
    },
    {
      queryType: 'tooling',
      rationale: 'The query references tools, MCP, APIs, schemas, or integration surfaces.',
      match: /(?:\bmcp\b|\btool\b|\bschema\b|\bopenapi\b|\bapi\b|\bintegration\b|\bendpoint\b|\broute\b|\bcommand\b|\bserver\b)/u,
    },
  ];

  const matched = typeChecks.find((entry) => entry.match.test(sanitizedLower));
  return matched || {
    queryType: 'generic',
    rationale: 'The query did not strongly match a specialized retrieval category.',
  };
}

export function inferMemoryClass(kind, metadata = {}) {
  const explicit = String(metadata.memoryClass || metadata.memory_class || '').trim().toLowerCase();
  if (['source', 'working', 'learned'].includes(explicit)) return explicit;

  if (metadata.harnessed || /^content_harness_/u.test(String(kind || ''))) return 'source';
  if (
    String(kind || '') === 'brain_journal'
    || String(metadata.source || '').toLowerCase() === 'brain_journal'
    || String(metadata.entryType || '').toLowerCase() === 'learning'
  ) {
    return 'learned';
  }

  return 'working';
}

export function normalizeMemoryItem(row = {}) {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata
    : {};

  return {
    kind: row.kind || 'memory',
    content: String(row.content || ''),
    metadata,
    createdAt: row.created_at || row.createdAt || null,
    projectName: row.project_name || row.projectName || 'default',
    sourcePath: metadata.sourcePath || metadata.path || null,
    sourceName: metadata.sourceName || metadata.name || null,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    memoryClass: inferMemoryClass(row.kind, metadata),
  };
}

const retrievalPlanCache = new Map();
const RAG_CACHE_LIMIT = 500;

export function classifyRetrievalPlan(query, { maxTerms = 6 } = {}) {
  const sanitized = sanitizeRagQuery(query, { maxLength: 240 });
  const cacheKey = `${sanitized}:${maxTerms}`;

  if (retrievalPlanCache.has(cacheKey)) {
    const cached = retrievalPlanCache.get(cacheKey);
    retrievalPlanCache.delete(cacheKey);
    retrievalPlanCache.set(cacheKey, cached);
    return cached;
  }

  const lower = sanitized.toLowerCase();
  const { queryType, rationale } = classifyQueryType(lower);
  const terms = buildRecallTerms(sanitized, { maxTerms });
  const config = QUERY_TYPE_CONFIG[queryType] || QUERY_TYPE_CONFIG.generic;

  const plan = {
    query: sanitized,
    queryType,
    rationale,
    terms,
    recallStrategy: DEFAULT_RECALL_STRATEGY,
    riskLevel: config.riskLevel || 'medium',
    requireSourceEvidence: config.requireSourceEvidence === true,
    preferredMemoryClasses: [...config.preferredMemoryClasses],
    preferredKinds: [...config.preferredKinds],
    maxItems: config.maxItems,
    evidenceTokenBudget: config.evidenceTokenBudget,
  };

  if (retrievalPlanCache.size >= RAG_CACHE_LIMIT) {
    retrievalPlanCache.delete(retrievalPlanCache.keys().next().value);
  }
  retrievalPlanCache.set(cacheKey, plan);
  return plan;
}

function sourcePathBoost(queryType, sourcePath = '') {
  const ext = path.extname(String(sourcePath || '').toLowerCase());
  if (!ext) return 0;

  if (queryType === 'code' && ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go'].includes(ext)) return 12;
  if (queryType === 'docs' && ['.md', '.mdx', '.txt'].includes(ext)) return 12;
  if (queryType === 'tooling' && ['.json', '.yaml', '.yml', '.js', '.ts'].includes(ext)) return 8;
  if (queryType === 'auth' && ['.md', '.txt', '.js', '.ts'].includes(ext)) return 6;
  return 0;
}

function recencyBoost(createdAt) {
  if (!createdAt) return 0;
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageMs = Date.now() - timestamp;
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= 24) return 6;
  if (ageHours <= 24 * 7) return 4;
  if (ageHours <= 24 * 30) return 2;
  return 0;
}

function buildCandidateText(item) {
  return [
    item.content,
    item.sourcePath,
    item.sourceName,
    item.tags.join(' '),
    item.keywords.join(' '),
    item.metadata.chunkLabel || '',
  ].filter(Boolean).join('\n').toLowerCase();
}

function matchCount(terms, text) {
  let total = 0;
  for (const term of terms) {
    if (text.includes(term)) total += 1;
  }
  return total;
}

function kindPreferenceBoost(item, retrievalPlan) {
  const preferred = retrievalPlan.preferredKinds || [];
  const index = preferred.findIndex((candidate) => candidate === item.kind);
  if (index === -1) return 0;
  return Math.max(2, (preferred.length - index) * 3);
}

function memoryClassPreferenceBoost(item, retrievalPlan) {
  const preferred = retrievalPlan.preferredMemoryClasses || [];
  const index = preferred.findIndex((candidate) => candidate === item.memoryClass);
  if (index === -1) return 0;
  return Math.max(3, (preferred.length - index) * 4);
}

function entryTypeBoost(item, retrievalPlan) {
  const entryType = String(item.metadata.entryType || '').toLowerCase();
  if (!entryType) return 0;
  if (entryType === 'summary' && ['docs', 'workflow', 'tooling', 'auth', 'generic'].includes(retrievalPlan.queryType)) return 6;
  if (entryType === 'chunk' && ['code', 'error'].includes(retrievalPlan.queryType)) return 6;
  return 2;
}

function buildSelectionReason(item, retrievalPlan, termHits) {
  const reasons = [];
  if (termHits > 0) reasons.push(`matched ${termHits} recall term${termHits === 1 ? '' : 's'}`);
  if (item.memoryClass === 'source') reasons.push('prefers source memory');
  if (item.metadata.entryType === 'summary') reasons.push('summary view');
  if (item.metadata.entryType === 'chunk') reasons.push('fine-grained chunk');
  if (item.sourcePath) reasons.push(`from ${item.sourcePath}`);
  if (reasons.length === 0) reasons.push('recent memory candidate');
  return reasons.join(', ');
}

export function scoreMemoryItem(itemInput, retrievalPlan) {
  const item = normalizeMemoryItem(itemInput);
  const candidateText = buildCandidateText(item);
  const termHits = matchCount(retrievalPlan.terms || [], candidateText);
  const baseClassWeight = { source: 34, learned: 24, working: 16 }[item.memoryClass] || 12;

  let score = baseClassWeight
    + (termHits * 9)
    + memoryClassPreferenceBoost(item, retrievalPlan)
    + kindPreferenceBoost(item, retrievalPlan)
    + entryTypeBoost(item, retrievalPlan)
    + sourcePathBoost(retrievalPlan.queryType, item.sourcePath)
    + (includesAny(candidateText, ['csrf', 'cookie', 'session', 'jwt']) && retrievalPlan.queryType === 'auth' ? 8 : 0)
    + recencyBoost(item.createdAt);

  if (retrievalPlan.riskLevel === 'high' && item.memoryClass === 'learned') {
    score = Math.min(score, 33); // Cap below base source weight (34)
  }

  return {
    ...item,
    retrievalScore: score,
    termHits,
    selectionReason: buildSelectionReason(item, retrievalPlan, termHits),
  };
}

function filterMemoryItem(itemInput, retrievalPlan) {
  const item = normalizeMemoryItem(itemInput);
  
  if (retrievalPlan.tenantId && item.metadata.tenantId && item.metadata.tenantId !== retrievalPlan.tenantId) {
    return false;
  }

  if (!['source', 'working', 'learned'].includes(item.memoryClass)) return false;
  
  const ageMs = item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) : 0;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Filter out working memories older than 30 days
  if (item.memoryClass === 'working' && ageDays > 30) return false;

  // Filter out items that are not in the preferred classes if risk level is high
  if (retrievalPlan.riskLevel === 'high' && !retrievalPlan.preferredMemoryClasses.includes(item.memoryClass)) {
    return false;
  }
  
  return true;
}

export function rankMemoryItems(items = [], retrievalPlan = classifyRetrievalPlan('')) {
  // Degraded mode fallback: Cap massive inputs to bound p95 latency
  let processableItems = items;
  if (items.length > 5000) {
    processableItems = [...items]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5000);
  }

  return processableItems
    .filter(item => filterMemoryItem(item, retrievalPlan))
    .map(item => scoreMemoryItem(item, retrievalPlan))
    .sort((left, right) => right.retrievalScore - left.retrievalScore || right.termHits - left.termHits || String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

function compactEvidenceText(item, tokenBudget) {
  return fitTextToTokenBudget(item.content, tokenBudget, { mode: 'head-tail' });
}

const evidencePacketCache = new Map();

export function buildEvidencePacket({
  query = '',
  retrievalPlan = classifyRetrievalPlan(query),
  items = [],
  maxItems = retrievalPlan.maxItems,
  tokenBudget = retrievalPlan.evidenceTokenBudget,
  strictSecurity = false,
} = {}) {
  const cacheKey = `${query}:${retrievalPlan.tenantId || 'shared'}:${maxItems}:${tokenBudget}:${items.length}`;
  if (evidencePacketCache.has(cacheKey)) {
    const cached = evidencePacketCache.get(cacheKey);
    evidencePacketCache.delete(cacheKey);
    evidencePacketCache.set(cacheKey, cached);
    return cached;
  }

  const ranked = rankMemoryItems(items, retrievalPlan).slice(0, Math.max(1, maxItems));
  const evidence = [];
  let tokenEstimate = 0;
  const perItemBudget = Math.max(80, Math.floor(tokenBudget / Math.max(1, ranked.length)));

  for (let index = 0; index < ranked.length; index += 1) {
    const item = ranked[index];
    const excerpt = compactEvidenceText(item, perItemBudget);
    const citation = `${index + 1}. ${item.kind} (${item.memoryClass})${item.sourcePath ? ` - ${item.sourcePath}` : item.sourceName ? ` - ${item.sourceName}` : ''}`;
    const block = [
      `[${index + 1}] ${item.kind} / ${item.memoryClass}`,
      item.sourceName ? `Source: ${item.sourceName}` : null,
      item.sourcePath ? `Path: ${item.sourcePath}` : null,
      `Reason: ${item.selectionReason}`,
      'Excerpt:',
      excerpt.text,
    ].filter(Boolean).join('\n');
    const blockTokens = countTokens(block);
    tokenEstimate += blockTokens;

    evidence.push({
      rank: index + 1,
      kind: item.kind,
      memoryClass: item.memoryClass,
      sourceName: item.sourceName,
      sourcePath: item.sourcePath,
      projectName: item.projectName,
      tags: item.tags,
      keywords: item.keywords,
      score: item.retrievalScore,
      reason: item.selectionReason,
      createdAt: item.createdAt,
      metadata: item.metadata,
      excerpt: excerpt.text,
      citation,
      tokenEstimate: blockTokens,
      tokensBefore: excerpt.originalTokens,
      tokensAfter: excerpt.tokens,
    });
  }

  const promptBlock = evidence.length > 0
    ? [
      '=== RETRIEVED EVIDENCE ===',
      `Query Type: ${retrievalPlan.queryType}`,
      `Recall Strategy: ${retrievalPlan.recallStrategy || DEFAULT_RECALL_STRATEGY}`,
      `Risk Level: ${retrievalPlan.riskLevel || 'medium'}`,
      retrievalPlan.rationale ? `Rationale: ${retrievalPlan.rationale}` : null,
      retrievalPlan.terms.length > 0 ? `Recall Terms: ${retrievalPlan.terms.join(', ')}` : null,
      '',
      ...evidence.map(item => [
        `[${item.rank}] ${item.kind} / ${item.memoryClass}`,
        item.sourceName ? `Source: ${item.sourceName}` : null,
        item.sourcePath ? `Path: ${item.sourcePath}` : null,
        `Reason: ${item.reason}`,
        'Excerpt:',
        item.excerpt,
      ].filter(Boolean).join('\n')),
    ].filter(Boolean).join('\n\n')
    : '';

  const sourceCount = evidence.filter(item => item.memoryClass === 'source').length;
  const learnedCount = evidence.filter(item => item.memoryClass === 'learned').length;
  const workingCount = evidence.filter(item => item.memoryClass === 'working').length;

  const riskFlags = [];
  const sourceItems = evidence.filter(i => i.memoryClass === 'source');
  
  if (retrievalPlan.requireSourceEvidence && sourceItems.length === 0) {
    riskFlags.push('missing_source_attribution');
    riskFlags.push('missing_source_evidence');

    if (strictSecurity === true) {
      throw new Error('SECURITY_VIOLATION: Missing source attribution in a high-risk code-changing flow.');
    }
  }

  if (tokenEstimate > tokenBudget * 0.95) {
    riskFlags.push('oversized_prompt');
  }

  if (evidence.some(i => i.memoryClass === 'working' && i.tokenEstimate > 20000)) {
    riskFlags.push('suspicious_upload');
  }

  const pathCommits = new Map();
  for (const item of evidence) {
    if (item.sourcePath && item.metadata?.commitHash) {
      if (pathCommits.has(item.sourcePath) && pathCommits.get(item.sourcePath) !== item.metadata.commitHash) {
        riskFlags.push('contradictory_evidence');
        break;
      }
      pathCommits.set(item.sourcePath, item.metadata.commitHash);
    }
  }

  if (evidence.length === 0) riskFlags.push('no_evidence_selected');

  const result = {
    query: retrievalPlan.query,
    queryType: retrievalPlan.queryType,
    rationale: retrievalPlan.rationale,
    terms: retrievalPlan.terms,
    recallStrategy: retrievalPlan.recallStrategy || DEFAULT_RECALL_STRATEGY,
    riskLevel: retrievalPlan.riskLevel || 'medium',
    requiresSourceEvidence: retrievalPlan.requireSourceEvidence === true,
    selectedCount: evidence.length,
    rejectedCount: items.length - evidence.length,
    tokenBudget,
    tokenEstimate,
    sourceCount,
    learnedCount,
    workingCount,
    riskFlags,
    citations: evidence.map(item => item.citation),
    evidence,
    promptBlock,
  };

  if (evidencePacketCache.size >= RAG_CACHE_LIMIT) {
    evidencePacketCache.delete(evidencePacketCache.keys().next().value);
  }
  evidencePacketCache.set(cacheKey, result);
  return result;
}

export function formatEvidencePacketForPrompt(evidencePacket) {
  if (!evidencePacket?.promptBlock) return '';

  const warning = evidencePacket.riskFlags?.includes('missing_source_evidence')
    ? 'WARNING: No source-backed evidence matched this high-risk query. Treat learned memory as advisory and verify with tools or files before making changes.\n\n'
    : '';

  return `${warning}${evidencePacket.promptBlock}`;
}
