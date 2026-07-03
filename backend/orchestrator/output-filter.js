const STRONG_LEAK_PATTERNS = [
  /here(?:'s| are)?\s+(?:my|the)\s+(?:system prompt|system instructions|developer message|developer instructions)/i,
  /===\s*\[IMMUTABLE ORGANIZATION CONSTRAINTS\]\s*===/i,
  /===\s*PROMPT INJECTION HARDENING\s*===/i,
  /<user_query>/i,
  /\bCRITICAL DIRECTIVE:\b/i,
];

const WEAK_LEAK_PATTERNS = [
  /\b(?:system prompt|system instructions|developer message|developer instructions|hidden prompt)\b/i,
  /\bignore(?:\s+all)?\s+(?:previous|earlier|prior)\s+instructions\b/i,
  /\bchain of thought\b/i,
];

const SAFE_REFUSAL_PATTERNS = [
  /\b(?:cannot|can't|won't|will not)\b.{0,40}\b(?:share|reveal|provide|expose)\b.{0,40}\b(?:system prompt|system instructions|developer message)\b/i,
];

const SECRET_PATTERNS = [
  { label: 'openai_api_key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: 'github_token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g },
  { label: 'aws_access_key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { label: 'slack_token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { label: 'private_key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g },
];

const CREDIT_CARD_CANDIDATE = /\b(?:\d[ -]*?){13,19}\b/g;
const HIGH_ENTROPY_CANDIDATE = /\b[A-Za-z0-9_+/=-]{24,}\b/g;
const DLP_FALLBACK = 'I cannot display that response because it may contain sensitive data. I flagged this session for review and withheld the unsafe content.';
const PROMPT_FALLBACK = 'I can help with the task, but internal system instructions were withheld for safety.';

export function filterModelOutput(text, {
  fallback = PROMPT_FALLBACK,
  dlpFallback = DLP_FALLBACK,
  tenantFingerprints = [],
} = {}) {
  const content = String(text ?? '');
  if (!content.trim()) {
    return { flagged: false, safeText: content, reason: null };
  }

  const dlp = scanSensitiveOutput(content, { tenantFingerprints });
  if (dlp.flagged) {
    return {
      flagged: true,
      safeText: dlpFallback,
      reason: dlp.reasons.join(','),
      category: 'dlp',
      findings: dlp.findings,
    };
  }

  if (SAFE_REFUSAL_PATTERNS.some(pattern => pattern.test(content))) {
    return { flagged: false, safeText: content, reason: null };
  }

  const strongMatch = STRONG_LEAK_PATTERNS.find(pattern => pattern.test(content));
  if (strongMatch) {
    return {
      flagged: true,
      safeText: fallback,
      reason: strongMatch.source,
      category: 'prompt_leakage',
    };
  }

  const weakMatches = WEAK_LEAK_PATTERNS.filter(pattern => pattern.test(content));
  if (weakMatches.length >= 2) {
    return {
      flagged: true,
      safeText: fallback,
      reason: weakMatches.map(pattern => pattern.source).join(','),
      category: 'prompt_leakage',
    };
  }

  return { flagged: false, safeText: content, reason: null };
}

export function scanSensitiveOutput(text, { tenantFingerprints = [], entropyThreshold = 4.2 } = {}) {
  const content = String(text ?? '');
  const findings = [];

  for (const pattern of SECRET_PATTERNS) {
    const matches = [...content.matchAll(pattern.regex)];
    for (const match of matches) {
      findings.push({ type: pattern.label, sample: redactFinding(match[0]) });
    }
  }

  for (const match of content.matchAll(CREDIT_CARD_CANDIDATE)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      findings.push({ type: 'credit_card', sample: redactFinding(digits) });
    }
  }

  for (const match of content.matchAll(HIGH_ENTROPY_CANDIDATE)) {
    const token = match[0];
    if (token.length >= 24 && shannonEntropy(token) >= entropyThreshold && !looksLikeSafePublicIdentifier(token)) {
      findings.push({ type: 'high_entropy_secret', sample: redactFinding(token) });
    }
  }

  for (const fingerprint of tenantFingerprints) {
    const normalized = String(fingerprint || '').trim();
    if (normalized.length >= 6 && content.includes(normalized)) {
      findings.push({ type: 'tenant_fingerprint', sample: redactFinding(normalized) });
    }
  }

  return {
    flagged: findings.length > 0,
    reasons: [...new Set(findings.map(item => item.type))],
    findings,
  };
}

function luhnCheck(digits) {
  let sum = 0;
  let doubleNext = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number.parseInt(digits[index], 10);
    if (doubleNext) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleNext = !doubleNext;
  }
  return sum % 10 === 0;
}

function shannonEntropy(value) {
  const text = String(value || '');
  const counts = new Map();
  for (const char of text) counts.set(char, (counts.get(char) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const probability = count / text.length;
    return sum - probability * Math.log2(probability);
  }, 0);
}

function looksLikeSafePublicIdentifier(value) {
  const text = String(value || '');
  if (/^[a-f0-9-]{32,36}$/i.test(text)) return true;
  if (/^[A-Z_]{24,}$/.test(text)) return true;
  return false;
}

function redactFinding(value) {
  const text = String(value || '');
  if (text.length <= 8) return '[redacted]';
  return `${text.slice(0, 4)}...[redacted]...${text.slice(-4)}`;
}
