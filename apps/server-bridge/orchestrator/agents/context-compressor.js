import { countTokens } from '../../memory/tokenizer.js';
import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

const MAP_CHUNK_TOKEN_BUDGET = 1800;
const MAP_OUTPUT_TOKEN_BUDGET = 320;
const REDUCE_OUTPUT_TOKEN_BUDGET = 384;

export class ContextCompressor {
  constructor(options = {}) {
    this.governor = new TokenGovernor();
    this.mapChunkTokenBudget = options.mapChunkTokenBudget || MAP_CHUNK_TOKEN_BUDGET;
    this.mapOutputTokenBudget = options.mapOutputTokenBudget || MAP_OUTPUT_TOKEN_BUDGET;
    this.reduceOutputTokenBudget = options.reduceOutputTokenBudget || REDUCE_OUTPUT_TOKEN_BUDGET;
  }

  async minifyContext(rawCode, userIntent, errorLogs) {
    const chunks = [
      ...chunkTextByLines('errorLogs', errorLogs, this.mapChunkTokenBudget),
      ...chunkTextByLines('rawCode', rawCode, this.mapChunkTokenBudget),
    ];

    if (chunks.length === 0) {
      return {
        pointOfFailure: 'No code or error logs were provided.',
        evidence: [],
        relevantAreas: [],
        nextStep: 'Capture the failing logs and surrounding code before retrying compression.',
      };
    }

    const mapResults = [];
    for (const chunk of chunks) {
      mapResults.push(await this.compressChunk(chunk, userIntent));
    }

    return this.reduceChunkSummaries(mapResults, userIntent);
  }

  async compressChunk(chunk, userIntent) {
    const systemPrompt = [
      'You are the Context Compressor map stage.',
      'Inspect one chunk of code or logs and extract only debugging-relevant facts.',
      'Output strict JSON with keys: source, chunkLabel, pointOfFailure, evidence, relevantAreas, risk.',
      'Do not write code and do not include markdown.'
    ].join(' ');

    const userPrompt = [
      `User Intent: ${userIntent}`,
      `Source: ${chunk.source}`,
      `Chunk Label: ${chunk.label}`,
      'Chunk Content:',
      chunk.text,
    ].join('\n\n');

    const responseText = await this.governor.getCompute('low', 'planner', (key, model, provider) => (
      callRoutedTextModel(key, model, systemPrompt, userPrompt, {
        provider,
        maxOutputTokens: this.mapOutputTokenBudget,
        jsonMode: true,
      })
    ));

    return {
      source: chunk.source,
      chunkLabel: chunk.label,
      ...parseJsonObject(responseText, {
        source: chunk.source,
        chunkLabel: chunk.label,
        pointOfFailure: '',
        evidence: [],
        relevantAreas: [],
        risk: '',
      }),
    };
  }

  async reduceChunkSummaries(mapResults, userIntent) {
    const systemPrompt = [
      'You are the Context Compressor reduce stage.',
      'Merge chunk-level debugging findings into one final incident summary.',
      'Output strict JSON with keys: pointOfFailure, evidence, relevantAreas, nextStep.',
      'Keep the result concise and grounded in the supplied evidence.'
    ].join(' ');

    const userPrompt = [
      `User Intent: ${userIntent}`,
      'Chunk Findings:',
      JSON.stringify(mapResults, null, 2),
    ].join('\n\n');

    const responseText = await this.governor.getCompute(mapResults.length > 2 ? 'high' : 'low', 'planner', (key, model, provider) => (
      callRoutedTextModel(key, model, systemPrompt, userPrompt, {
        provider,
        maxOutputTokens: this.reduceOutputTokenBudget,
        jsonMode: true,
      })
    ));

    return parseJsonObject(responseText, {
      pointOfFailure: 'Unable to determine the exact failure point from the provided context.',
      evidence: mapResults.flatMap(result => result.evidence || []).slice(0, 6),
      relevantAreas: uniqueStrings(mapResults.flatMap(result => result.relevantAreas || [])).slice(0, 6),
      nextStep: 'Inspect the newest log evidence alongside the listed relevant areas.',
    });
  }
}

function chunkTextByLines(source, text, tokenBudget) {
  const normalized = typeof text === 'string' ? text.trim() : '';
  if (!normalized) return [];

  const lines = normalized.split(/\r?\n/);
  const chunks = [];
  let currentLines = [];
  let currentStartLine = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const candidateLines = [...currentLines, line];
    const candidateText = candidateLines.join('\n');

    if (currentLines.length > 0 && countTokens(candidateText) > tokenBudget) {
      chunks.push(buildChunk(source, currentStartLine, index, currentLines));
      currentLines = [line];
      currentStartLine = index + 1;
      continue;
    }

    currentLines = candidateLines;
  }

  if (currentLines.length > 0) {
    chunks.push(buildChunk(source, currentStartLine, lines.length, currentLines));
  }

  return chunks;
}

function buildChunk(source, startLine, endLine, lines) {
  return {
    source,
    label: `${source}:${startLine}-${endLine}`,
    text: lines.join('\n'),
  };
}

function parseJsonObject(text, fallback) {
  if (!text) return fallback;

  try {
    return { ...fallback, ...JSON.parse(text) };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ...fallback, pointOfFailure: text.trim() || fallback.pointOfFailure };
    }

    try {
      return { ...fallback, ...JSON.parse(match[0]) };
    } catch {
      return { ...fallback, pointOfFailure: text.trim() || fallback.pointOfFailure };
    }
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()))];
}
