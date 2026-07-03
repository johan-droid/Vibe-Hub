import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

const BUG_FIX_PATTERNS = [
  /\bbug\b/i,
  /\bfix\b/i,
  /\berror\b/i,
  /\bfail(?:ed|ing)?\b/i,
  /\bcrash\b/i,
  /\bexception\b/i,
  /\bregression\b/i,
  /\btimeout\b/i,
];

const FEATURE_PATTERNS = [
  /\badd\b/i,
  /\bcreate\b/i,
  /\bimplement\b/i,
  /\bbuild\b/i,
  /\bfeature\b/i,
  /\bsupport\b/i,
  /\bintroduce\b/i,
];

const HIGH_COMPLEXITY_PATTERNS = [
  /\barchitecture\b/i,
  /\brefactor\b/i,
  /\broad\b/i,
  /\bmultiple\b/i,
  /\bend-to-end\b/i,
  /\bphase\b/i,
  /\bsystem\b/i,
  /\bscal(?:e|ability)\b/i,
];

const FILE_PATH_PATTERN = /\b(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+\.(?:js|jsx|ts|tsx|json|md|css|scss|yml|yaml)\b/g;
const FILE_NAME_PATTERN = /\b[a-zA-Z0-9_.-]+\.(?:js|jsx|ts|tsx|json|md|css|scss|yml|yaml)\b/g;

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function deterministicTriage(userPrompt) {
  const prompt = String(userPrompt || '').trim();
  const directPaths = unique(prompt.match(FILE_PATH_PATTERN) || []).slice(0, 3);
  const fileNames = unique(prompt.match(FILE_NAME_PATTERN) || []).slice(0, 3);
  const bugHits = BUG_FIX_PATTERNS.filter(pattern => pattern.test(prompt)).length;
  const featureHits = FEATURE_PATTERNS.filter(pattern => pattern.test(prompt)).length;
  const complexityHits = HIGH_COMPLEXITY_PATTERNS.filter(pattern => pattern.test(prompt)).length;

  const intent = bugHits > featureHits
    ? 'bug_fix'
    : featureHits > bugHits
      ? 'feature_request'
      : 'unknown';

  const complexity = complexityHits >= 2 || prompt.length > 220
    ? 'high'
    : 'low';

  return {
    intent,
    target_files: directPaths.length > 0 ? directPaths : fileNames,
    complexity,
    strategy: 'deterministic',
  };
}

export async function triageAndRoute(userPrompt) {
  const deterministic = deterministicTriage(userPrompt);
  const shouldUseModelFallback = process.env.SELINA_ENABLE_TRIAGE_MODEL === 'true';

  if (!shouldUseModelFallback) {
    return deterministic;
  }

  const governor = new TokenGovernor();
  const systemPrompt = "You are the Triage Router. Analyze the prompt. Identify the intent (bug_fix or feature_request). Identify the 2-3 specific file paths in the VFS that are relevant to this request. Output strict JSON: { 'intent': string, 'target_files': string[], 'complexity': 'low'|'high' }.";

  const result = await governor.getCompute('low', 'router', (key, model, provider) => (
    callRoutedTextModel(key, model, systemPrompt, userPrompt, { provider, maxOutputTokens: 512, jsonMode: true })
  ));
  try {
      return {
        ...deterministic,
        ...JSON.parse(result),
        strategy: 'deterministic+model-fallback',
      };
  } catch (e) {
      return deterministic;
  }
}
