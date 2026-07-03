import { AGENT_TOOLS } from './tools.js';

const READONLY_METHODS = new Set(['get', 'head', 'options']);
const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export function createDraftToolCards({ tools = AGENT_TOOLS, openApiSpec = null } = {}) {
  const builtinCards = tools.map(tool => createToolCard(tool, {
    source: tool.serverName ? 'mcp' : (tool.metadata?.source || 'builtin'),
  }));
  const openApiCards = openApiSpec ? createOpenApiToolCards(openApiSpec) : [];

  return {
    source: 'adopt-zapi-style-discovery',
    status: 'draft',
    enabled: false,
    cards: [...builtinCards, ...openApiCards],
  };
}

export function createToolCard(tool, { source = tool?.metadata?.source || 'builtin' } = {}) {
  const risk = inferToolRisk(tool);
  return {
    id: tool.uniqueId || tool.name,
    name: tool.name,
    source,
    description: tool.description || '',
    inputSchema: tool.parameters || tool.inputSchema || { type: 'OBJECT', properties: {}, required: [] },
    risk,
    authRequired: risk !== 'none',
    approvalRequired: risk === 'write',
    enabled: false,
    status: 'draft',
    reviewRequired: true,
  };
}

export function createOpenApiToolCards(spec = {}) {
  const cards = [];
  const paths = spec.paths && typeof spec.paths === 'object' ? spec.paths : {};

  for (const [routePath, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const [method, operation] of Object.entries(methods)) {
      const normalizedMethod = method.toLowerCase();
      if (![...READONLY_METHODS, ...MUTATION_METHODS].includes(normalizedMethod)) continue;
      const name = operation.operationId || `${normalizedMethod}_${routePath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      cards.push(createToolCard({
        name,
        description: operation.summary || operation.description || `${normalizedMethod.toUpperCase()} ${routePath}`,
        parameters: openApiOperationToSchema(operation),
        metadata: {
          source: 'openapi',
          method: normalizedMethod,
          path: routePath,
        },
      }, { source: 'openapi' }));
    }
  }

  return cards;
}

export function inferToolRisk(tool = {}) {
  const declaredRisk = String(tool.metadata?.risk || tool.risk || tool.annotations?.risk || '').toLowerCase();
  if (['none', 'safe'].includes(declaredRisk)) return 'none';
  if (['read', 'readonly', 'low'].includes(declaredRisk)) return 'readonly';
  if (['write', 'mutation', 'destructive', 'high'].includes(declaredRisk)) return 'write';

  const method = String(tool.metadata?.method || '').toLowerCase();
  if (READONLY_METHODS.has(method)) return 'readonly';
  if (MUTATION_METHODS.has(method)) return 'write';

  const haystack = `${tool.name || ''} ${tool.description || ''}`.toLowerCase();
  if (/^(read|list|search|grep|status|summary|validate|check|diagnostic|fetch|get|scan)_/.test(haystack)) {
    return 'readonly';
  }
  if (/^(create|write|edit|patch|replace|delete|run|exec|command|deploy|publish|clone|push|trigger|generate)_/.test(haystack)) {
    return 'write';
  }
  if (/\b(read|list|search|grep|status|summary|validate|check|diagnostic|fetch|get|scan)\b/.test(haystack)) {
    return 'readonly';
  }
  if (/\b(create|write|edit|patch|replace|delete|run|exec|command|deploy|publish|clone|push|trigger|generate)\b/.test(haystack)) {
    return 'write';
  }
  if (/\b(clarification|plan)\b/.test(haystack)) {
    return 'none';
  }
  return 'write';
}

function openApiOperationToSchema(operation = {}) {
  const properties = {};
  const required = [];

  for (const parameter of operation.parameters || []) {
    properties[parameter.name] = {
      type: normalizeJsonSchemaType(parameter.schema?.type || 'string'),
      description: parameter.description || `${parameter.in || 'parameter'} parameter`,
    };
    if (parameter.required) required.push(parameter.name);
  }

  const jsonBody = operation.requestBody?.content?.['application/json']?.schema;
  if (jsonBody && jsonBody.properties) {
    properties.body = {
      type: 'OBJECT',
      properties: normalizeSchemaProperties(jsonBody.properties),
      required: jsonBody.required || [],
    };
    if (operation.requestBody.required) required.push('body');
  }

  return {
    type: 'OBJECT',
    properties,
    required,
  };
}

function normalizeSchemaProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties).map(([key, schema]) => [
    key,
    {
      ...schema,
      type: normalizeJsonSchemaType(schema.type || 'string'),
    },
  ]));
}

function normalizeJsonSchemaType(type) {
  const normalized = String(type || 'string').toLowerCase();
  if (normalized === 'object') return 'OBJECT';
  if (normalized === 'array') return 'ARRAY';
  if (normalized === 'number') return 'NUMBER';
  if (normalized === 'integer') return 'NUMBER';
  if (normalized === 'boolean') return 'BOOLEAN';
  return 'STRING';
}
