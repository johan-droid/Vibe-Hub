export const AGENT_CAPABILITY_MANIFEST = Object.freeze({
  frontend: {
    current: 'vite-react',
    target: 'nextjs',
    integration: 'migration-ready',
    adapter: 'route future Next.js UI through the existing API/socket contract',
  },
  backend: {
    current: 'express-node',
    target: ['fastapi', 'langgraph'],
    integration: 'sidecar-ready',
    adapter: 'FastAPI/LangGraph can run as a sidecar behind the same tool/auth/sandbox contracts',
  },
  agentRuntime: {
    current: 'brain-system-orchestrator',
    target: ['autogen', 'openhands-concepts'],
    integration: 'concept-adapter',
    adapter: 'keep BrainSystem as control plane; use group-chat/planning patterns only after tool policy checks',
  },
  execution: {
    active: ['docker-local', 'e2b-vibekit'],
    adapter: 'SandboxProviderRouter',
  },
  retrieval: {
    active: ['tree-sitter'],
    optional: ['qdrant'],
    adapter: 'createVectorStore',
  },
  browser: {
    active: ['playwright'],
    adapter: 'existing browser/e2e harness and Browser plugin workflows',
  },
  codingModels: {
    active: ['qwen', 'deepseek', 'groq', 'nim', 'gemini', 'openai', 'anthropic'],
    adapter: 'ModelService and TokenGovernor coding-provider route',
  },
  verification: {
    active: ['pytest', 'semgrep', 'ruff'],
    adapter: 'helper_run_pytest/helper_run_semgrep/helper_run_ruff through sandbox providers',
  },
  memory: {
    active: ['local'],
    optional: ['mem0'],
    adapter: 'createMemoryProvider',
  },
});

export function listAgentCapabilities() {
  return AGENT_CAPABILITY_MANIFEST;
}

export function getCapabilityStatus(name) {
  return AGENT_CAPABILITY_MANIFEST[name] || null;
}
