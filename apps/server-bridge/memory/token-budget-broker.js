import { countTokens, fitTextToTokenBudget } from './tokenizer.js';

const DEFAULT_COMPRESSOR_INPUT_BUDGET = 24000;
const DEFAULT_ERROR_LOG_BUDGET = 6000;
const DEFAULT_RAW_CODE_BUDGET = 18000;
const DEFAULT_BRAIN_CONTEXT_BUDGET = 3500;
const HIGH_COMPLEXITY_CONTEXT_TOKENS = 12000;
const HIGH_COMPLEXITY_PROMPT_TOKENS = 900;

export class TokenBudgetBroker {
  constructor(options = {}) {
    this.model = options.model || 'gpt-4o-mini';
    this.compressorInputBudget = options.compressorInputBudget || DEFAULT_COMPRESSOR_INPUT_BUDGET;
    this.errorLogBudget = options.errorLogBudget || DEFAULT_ERROR_LOG_BUDGET;
    this.rawCodeBudget = options.rawCodeBudget || DEFAULT_RAW_CODE_BUDGET;
    this.brainContextBudget = options.brainContextBudget || DEFAULT_BRAIN_CONTEXT_BUDGET;
    this.highComplexityContextTokens = options.highComplexityContextTokens || HIGH_COMPLEXITY_CONTEXT_TOKENS;
    this.highComplexityPromptTokens = options.highComplexityPromptTokens || HIGH_COMPLEXITY_PROMPT_TOKENS;
  }

  planBrainRun({ userPrompt = '', rawCode = '', errorLogs = '', preFlightSummary = '' } = {}) {
    const prompt = this.measure('userPrompt', userPrompt);
    const code = this.measure('rawCode', rawCode);
    const logs = this.measure('errorLogs', errorLogs);
    const preFlight = this.measure('preFlightSummary', preFlightSummary);
    const contextTokens = code.tokens + logs.tokens + preFlight.tokens;

    return {
      complexityHint: (
        prompt.tokens > this.highComplexityPromptTokens ||
        contextTokens > this.highComplexityContextTokens
      ) ? 'high' : 'low',
      totalInputTokens: prompt.tokens + contextTokens,
      measurements: {
        userPrompt: prompt,
        rawCode: code,
        errorLogs: logs,
        preFlightSummary: preFlight,
      },
      budgets: {
        compressorInputTokens: this.compressorInputBudget,
        rawCodeTokens: this.rawCodeBudget,
        errorLogTokens: this.errorLogBudget,
        brainContextTokens: this.brainContextBudget,
      },
    };
  }

  prepareCompressorInput({ rawCode = '', errorLogs = '', preFlightSummary = '' } = {}) {
    const rawBudget = this.fitForLayer('rawCode', rawCode, this.rawCodeBudget, { mode: 'head-tail' });
    const combinedLogs = [errorLogs, preFlightSummary].filter(Boolean).join('\n');
    const logBudget = this.fitForLayer('errorLogs', combinedLogs, this.errorLogBudget, { mode: 'tail' });

    return {
      rawCode: rawBudget.text,
      errorLogs: logBudget.text,
      report: {
        rawCode: withoutText(rawBudget),
        errorLogs: withoutText(logBudget),
        savedTokens: rawBudget.savedTokens + logBudget.savedTokens,
        compressorInputTokens: rawBudget.tokens + logBudget.tokens,
        compressorInputBudget: this.compressorInputBudget,
      },
    };
  }

  fitForLayer(layer, text, maxTokens = this.brainContextBudget, options = {}) {
    const fitted = fitTextToTokenBudget(text, maxTokens, {
      model: this.model,
      ...options,
    });

    return {
      layer,
      ...fitted,
      budgetTokens: maxTokens,
    };
  }

  measure(label, value) {
    const text = normalizePayload(value);
    return {
      label,
      chars: text.length,
      tokens: countTokens(text, { model: this.model }),
    };
  }
}

function normalizePayload(value) {
  if (typeof value === 'string') return value;
  if (!value) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function withoutText(result) {
  const { text: _text, ...rest } = result;
  return rest;
}
