import { AGENT_TOOLS } from './tools.js';

export class ToolSchemaError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ToolSchemaError';
    this.details = details;
  }
}

function normalizeType(type) {
  const normalized = String(type || 'object').toLowerCase();
  if (normalized === 'object') return 'object';
  if (normalized === 'array') return 'array';
  if (normalized === 'string') return 'string';
  if (normalized === 'number') return 'number';
  if (normalized === 'integer') return 'integer';
  if (normalized === 'boolean') return 'boolean';
  return normalized;
}

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function schemaForTool(tool) {
  return tool?.parameters || tool?.inputSchema || { type: 'object', properties: {} };
}

function validateValue(value, schema = {}, path = 'arguments', details = [], options = {}) {
  if (schema.anyOf) {
    const matched = schema.anyOf.some(candidate => validateValue(value, candidate, path, [], options).length === 0);
    if (!matched) details.push({ field: path, message: 'Value does not match any allowed schema' });
    return details;
  }

  if (schema.oneOf) {
    const matchCount = schema.oneOf.filter(candidate => validateValue(value, candidate, path, [], options).length === 0).length;
    if (matchCount !== 1) details.push({ field: path, message: 'Value must match exactly one allowed schema' });
    return details;
  }

  const expected = normalizeType(schema.type);
  const actual = valueType(value);

  if (expected === 'object') {
    if (actual !== 'object') {
      details.push({ field: path, message: `Expected object, received ${actual}` });
      return details;
    }

    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const key of required) {
      if (value[key] === undefined) {
        details.push({ field: `${path}.${key}`, message: 'Required argument is missing' });
      }
    }

    if (options.strict !== false && schema.additionalProperties !== true) {
      for (const key of Object.keys(value)) {
        if (!properties[key]) {
          details.push({ field: `${path}.${key}`, message: 'Unknown argument is not allowed' });
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) {
        validateValue(value[key], childSchema, `${path}.${key}`, details, options);
      }
    }
    return details;
  }

  if (expected === 'array') {
    if (actual !== 'array') {
      details.push({ field: path, message: `Expected array, received ${actual}` });
      return details;
    }
    const itemSchema = schema.items || {};
    value.forEach((item, index) => validateValue(item, itemSchema, `${path}[${index}]`, details, options));
    return details;
  }

  if (expected === 'number') {
    if (actual !== 'number' || Number.isNaN(value)) {
      details.push({ field: path, message: `Expected number, received ${actual}` });
      return details;
    }
  } else if (expected === 'integer') {
    if (actual !== 'number' || !Number.isInteger(value)) {
      details.push({ field: path, message: `Expected integer, received ${actual}` });
      return details;
    }
  } else if (expected === 'string') {
    if (actual !== 'string') details.push({ field: path, message: `Expected string, received ${actual}` });
  } else if (expected === 'boolean') {
    if (actual !== 'boolean') details.push({ field: path, message: `Expected boolean, received ${actual}` });
  }

  if (schema.enum && !schema.enum.includes(value)) {
    details.push({ field: path, message: `Expected one of: ${schema.enum.join(', ')}` });
  }

  return details;
}

export function validateToolArguments(tool, args = {}, options = {}) {
  if (!tool) throw new ToolSchemaError('Unknown tool definition');
  const schema = schemaForTool(tool);
  const details = validateValue(args || {}, schema, 'arguments', [], options);

  if (details.length > 0) {
    throw new ToolSchemaError(`Invalid arguments for tool ${tool.name || tool.uniqueId || 'unknown'}`, details);
  }

  return true;
}

export function findToolDefinition(toolName, tools = AGENT_TOOLS) {
  return tools.find(tool => tool.name === toolName || tool.uniqueId === toolName);
}

export function validateToolCallArguments(toolName, args = {}, tools = AGENT_TOOLS, options = {}) {
  const tool = findToolDefinition(toolName, tools);
  if (!tool) {
    throw new ToolSchemaError(`Unknown tool: ${toolName}`, [{ field: 'tool', message: 'Tool is not registered' }]);
  }
  return validateToolArguments(tool, args, options);
}
