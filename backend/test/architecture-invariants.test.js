import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LANGUAGES, LanguageEnforcer } from '../orchestrator/context-builder.js';
import { ALLOWED_USER_LOCALES } from '../user_env/context_builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

async function listJsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.js')) return [fullPath];
    return [];
  }));
  return files.flat();
}

function findImportSpecifiers(source) {
  const specs = [];
  const importRegex = /(?:import\s+(?:[^'"]+?\s+from\s*)?|export\s+[^'"]+?\s+from\s*|import\(\s*)['"]([^'"]+)['"]/g;
  let match = importRegex.exec(source);
  while (match) {
    specs.push(match[1]);
    match = importRegex.exec(source);
  }
  return specs;
}

async function findForbiddenBoundaryImports(rootDir, forbiddenSegment) {
  const files = await listJsFiles(rootDir);
  const violations = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf-8');
    const forbiddenImports = findImportSpecifiers(source)
      .filter(specifier => specifier.replace(/\\/g, '/').includes(forbiddenSegment));

    if (forbiddenImports.length > 0) {
      violations.push({ file, forbiddenImports });
    }
  }

  return violations;
}

describe('V6 architecture invariants', () => {
  it('keeps org_core and user_env isolated from direct cross-imports', async () => {
    const orgViolations = await findForbiddenBoundaryImports(path.join(SERVER_ROOT, 'org_core'), 'user_env');
    const userViolations = await findForbiddenBoundaryImports(path.join(SERVER_ROOT, 'user_env'), 'org_core');

    expect(orgViolations).toEqual([]);
    expect(userViolations).toEqual([]);
  });

  it('hard-locks user languages to English, Hindi, and Odia code or', () => {
    expect([...ALLOWED_LANGUAGES]).toEqual(['en', 'hi', 'or']);
    expect([...ALLOWED_USER_LOCALES]).toEqual(['en', 'hi', 'or']);
    expect(LanguageEnforcer.validateLanguage('or')).toBe('or');
    expect(LanguageEnforcer.validateLanguage('oria')).toBe('en');
    expect(LanguageEnforcer.validateLanguage('fr')).toBe('en');
  });

  it('keeps privileged cloud execution disabled while sandbox execution goes through the provider router', async () => {
    const toolsSource = await fs.readFile(path.join(SERVER_ROOT, 'orchestrator', 'tools.js'), 'utf-8');
    const indexSource = await fs.readFile(path.join(SERVER_ROOT, 'index.js'), 'utf-8');
    const stateMachineSource = await fs.readFile(path.join(SERVER_ROOT, 'orchestrator', 'state_machine.js'), 'utf-8');

    expect(toolsSource).toMatch(/name:\s*'github_create_codespace'[\s\S]*Disabled by Selina V6 local-Docker-only execution policy/);
    expect(toolsSource).toMatch(/name:\s*'github_trigger_workflow'[\s\S]*Disabled by Selina V6 local-Docker-only execution policy/);
    expect(indexSource).toMatch(/case 'github_create_codespace':[\s\S]*code:\s*'LOCAL_DOCKER_ONLY'/);
    expect(indexSource).toMatch(/case 'github_trigger_workflow':[\s\S]*code:\s*'LOCAL_DOCKER_ONLY'/);
    expect(indexSource).toMatch(/name === 'security_sandbox'[\s\S]*sandboxProviders\.executeScript/);
    expect(stateMachineSource).toMatch(/executeGeneratedCodeInLocalDocker/);
    expect(stateMachineSource).toMatch(/SandboxExecutor\.executeLocalDockerSandbox/);
  });

  it('keeps agent model credentials behind the central auth manager', async () => {
    const checkedFiles = [
      path.join(SERVER_ROOT, 'orchestrator', 'models.js'),
      path.join(SERVER_ROOT, 'orchestrator', 'router.js'),
      path.join(SERVER_ROOT, 'memory', 'embeddings.js'),
      path.join(SERVER_ROOT, 'creative', 'generate-ui-variant.js'),
    ];
    const forbidden = /process\.env\.(GEMINI_API_KEY|OPENAI_API_KEY|QWEN_API_KEY|DEEPSEEK_API_KEY|ANTHROPIC_API_KEY|LLM_API_KEY|UI_VARIANT_API_KEY)/;

    for (const file of checkedFiles) {
      const source = await fs.readFile(file, 'utf-8');
      expect(source, file).not.toMatch(forbidden);
    }
  });

  it('keeps MCP and tool execution behind schema validation and streamed audit events', async () => {
    const indexSource = await fs.readFile(path.join(SERVER_ROOT, 'index.js'), 'utf-8');
    const expertSource = await fs.readFile(path.join(SERVER_ROOT, 'orchestrator', 'expert-base.js'), 'utf-8');
    const mcpSource = await fs.readFile(path.join(SERVER_ROOT, 'mcp', 'MCPManager.js'), 'utf-8');
    const routerSource = await fs.readFile(path.join(SERVER_ROOT, 'orchestrator', 'router.js'), 'utf-8');

    expect(expertSource).toMatch(/validateToolCallArguments\(call\.name/);
    expect(mcpSource).toMatch(/validateToolArguments\(tool,\s*args,\s*\{\s*strict:\s*true\s*\}/);
    expect(indexSource).toMatch(/type:\s*'tool_call'/);
    expect(indexSource).toMatch(/TOOL_SCHEMA_INVALID/);
    expect(routerSource).toMatch(/handleMcpDiagnostics/);
  });
});
