import { describe, expect, it } from 'vitest';
import {
  ToolSchemaError,
  validateToolArguments,
  validateToolCallArguments,
} from '../orchestrator/tool_schema.js';

describe('tool schema validation', () => {
  it('accepts valid built-in tool arguments', () => {
    expect(validateToolCallArguments('read_file', {
      path: 'apps/server-bridge/index.js',
      start_line: 1,
      end_line: 25,
    })).toBe(true);
  });

  it('rejects missing required built-in arguments', () => {
    expect(() => validateToolCallArguments('read_file', {})).toThrow(ToolSchemaError);

    try {
      validateToolCallArguments('read_file', {});
    } catch (error) {
      expect(error.details).toContainEqual({
        field: 'arguments.path',
        message: 'Required argument is missing',
      });
    }
  });

  it('rejects hallucinated arguments in strict mode', () => {
    expect(() => validateToolCallArguments('read_file', {
      path: 'package.json',
      apiKey: 'should-never-pass',
    })).toThrow(/Invalid arguments/);
  });

  it('validates nested array/object schemas', () => {
    expect(validateToolCallArguments('patch_file', {
      path: 'src/App.jsx',
      search_content: 'const oldValue = true;',
      replace_content: 'const oldValue = false;',
    })).toBe(true);

    expect(() => validateToolCallArguments('patch_file', {
      path: 'src/App.jsx',
      StartLine: 10,
      search_content: 'old',
      replace_content: 'new',
    })).toThrow(ToolSchemaError);

    expect(validateToolCallArguments('multi_replace_file_content', {
      TargetFile: 'src/App.jsx',
      ReplacementChunks: [{
        StartLine: 10,
        EndLine: 12,
        TargetContent: 'old',
        ReplacementContent: 'new',
      }],
    })).toBe(true);

    expect(() => validateToolCallArguments('multi_replace_file_content', {
      TargetFile: 'src/App.jsx',
      ReplacementChunks: [{
        StartLine: 10,
        EndLine: 12,
        TargetContent: 'old',
      }],
    })).toThrow(ToolSchemaError);
  });

  it('enforces enum values', () => {
    expect(validateToolCallArguments('security_sandbox', {
      scriptPath: 'scripts/check.js',
      runtime: 'node',
      includePaths: ['fixtures/input.json'],
      provider: 'docker-local',
    })).toBe(true);

    expect(validateToolCallArguments('run_command', {
      command: 'node',
      args: ['--test', 'candidate.test.js'],
      includePaths: ['candidate.js'],
      sandboxProvider: 'docker-local',
    })).toBe(true);

    expect(() => validateToolCallArguments('security_sandbox', {
      scriptPath: 'scripts/check.js',
      runtime: 'curl',
    })).toThrow(ToolSchemaError);
  });

  it('validates MCP input schemas and LLM-facing MCP aliases', () => {
    const originalMcpTool = {
      name: 'query',
      uniqueId: 'postgres:query',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          mode: { type: 'string', enum: ['readonly', 'explain'] },
        },
        required: ['sql'],
      },
    };

    const llmMcpTool = {
      name: 'postgres__query',
      parameters: originalMcpTool.inputSchema,
    };

    expect(validateToolArguments(originalMcpTool, {
      sql: 'select 1',
      mode: 'readonly',
    })).toBe(true);
    expect(validateToolCallArguments('postgres__query', {
      sql: 'select 1',
      mode: 'explain',
    }, [llmMcpTool])).toBe(true);
    expect(() => validateToolCallArguments('postgres__query', {
      sql: 'select 1',
      mode: 'write',
    }, [llmMcpTool])).toThrow(ToolSchemaError);
  });
});
