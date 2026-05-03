const TOKEN_SPLIT = /[^a-z0-9+#.]+/i;

export const CS_SKILL_NODES = [
  {
    id: 'software_architecture',
    label: 'Software Architecture',
    expertDomain: 'manager',
    keywords: ['architecture', 'system design', 'scalability', 'microservice', 'monolith', 'modular', 'saas', 'multi tenant', 'roadmap'],
    directives: ['Model boundaries, interfaces, failure modes, and evolution paths before coding.', 'Prefer explicit tradeoffs and incremental migration over big-bang rewrites.'],
    bridges: ['backend_engineering', 'distributed_systems', 'devops_cloud', 'security_engineering'],
  },
  {
    id: 'algorithms_data_structures',
    label: 'Algorithms & Data Structures',
    expertDomain: 'code',
    keywords: ['algorithm', 'complexity', 'big o', 'graph', 'tree', 'heap', 'queue', 'dynamic programming', 'search', 'sort', 'data structure'],
    directives: ['State invariants and complexity explicitly.', 'Use simple correct structures before clever optimizations.'],
    bridges: ['performance_engineering', 'programming_languages', 'ai_ml'],
  },
  {
    id: 'backend_engineering',
    label: 'Backend Engineering',
    expertDomain: 'code',
    keywords: ['api', 'rest', 'graphql', 'express', 'fastify', 'server', 'endpoint', 'middleware', 'auth', 'oauth', 'jwt', 'rate limit'],
    directives: ['Design stable request/response contracts and validate inputs at boundaries.', 'Keep auth, persistence, and business logic separated.'],
    bridges: ['databases', 'security_engineering', 'observability', 'distributed_systems'],
  },
  {
    id: 'frontend_engineering',
    label: 'Frontend Engineering',
    expertDomain: 'ui',
    keywords: ['react', 'component', 'frontend', 'ui', 'ux', 'css', 'tailwind', 'responsive', 'dashboard', 'landing', 'animation'],
    directives: ['Prioritize hierarchy, accessibility, responsive states, and meaningful empty/error/loading states.', 'Respect the project design system before inventing new primitives.'],
    bridges: ['accessibility', 'product_design', 'performance_engineering'],
  },
  {
    id: 'databases',
    label: 'Databases & Storage',
    expertDomain: 'code',
    keywords: ['database', 'postgres', 'mysql', 'sqlite', 'redis', 'schema', 'migration', 'index', 'query', 'sql', 'transaction', 'vector'],
    directives: ['Protect data integrity with constraints, transactions, and migration-safe changes.', 'Explain index and query-plan implications when performance matters.'],
    bridges: ['backend_engineering', 'data_engineering', 'security_engineering'],
  },
  {
    id: 'distributed_systems',
    label: 'Distributed Systems',
    expertDomain: 'manager',
    keywords: ['distributed', 'queue', 'event', 'pubsub', 'kafka', 'consensus', 'replication', 'eventual consistency', 'workflow', 'orchestration'],
    directives: ['Identify ordering, idempotency, retry, backpressure, and consistency assumptions.', 'Design for partial failure as the default state.'],
    bridges: ['backend_engineering', 'observability', 'devops_cloud'],
  },
  {
    id: 'security_engineering',
    label: 'Security Engineering',
    expertDomain: 'security',
    keywords: ['security', 'hardening', 'vulnerability', 'xss', 'csrf', 'ssrf', 'injection', 'secret', 'audit', 'threat', 'sandbox', 'permission'],
    directives: ['Threat-model inputs, trust boundaries, secrets, and privilege before implementing.', 'Prefer deny-by-default and redact sensitive output.'],
    bridges: ['backend_engineering', 'devops_cloud', 'privacy_compliance', 'testing_quality'],
  },
  {
    id: 'ai_ml',
    label: 'AI / ML / Agents',
    expertDomain: 'code',
    keywords: ['ai', 'ml', 'llm', 'agent', 'moe', 'model', 'embedding', 'rag', 'prompt', 'token', 'inference', 'classifier', 'neural'],
    directives: ['Separate routing, memory, tools, and model calls into testable layers.', 'Budget tokens, cap context, and log redacted diagnostics for every model boundary.'],
    bridges: ['data_engineering', 'algorithms_data_structures', 'observability', 'security_engineering'],
  },
  {
    id: 'data_engineering',
    label: 'Data Engineering',
    expertDomain: 'code',
    keywords: ['etl', 'pipeline', 'warehouse', 'analytics', 'stream', 'batch', 'dataset', 'parquet', 'spark', 'airflow', 'ingestion'],
    directives: ['Track data lineage, schema drift, replay safety, and backfill strategy.', 'Favor deterministic transforms with observability hooks.'],
    bridges: ['databases', 'ai_ml', 'distributed_systems'],
  },
  {
    id: 'devops_cloud',
    label: 'DevOps / Cloud / Platform',
    expertDomain: 'debug',
    keywords: ['docker', 'kubernetes', 'render', 'deploy', 'ci', 'cd', 'github actions', 'terraform', 'cloud', 'infra', 'container', 'pipeline'],
    directives: ['Treat deployment as code: reproducible, observable, rollbackable.', 'Validate env vars, ports, health checks, and least-privilege secrets.'],
    bridges: ['security_engineering', 'observability', 'distributed_systems'],
  },
  {
    id: 'observability',
    label: 'Observability & Reliability',
    expertDomain: 'debug',
    keywords: ['log', 'metrics', 'trace', 'monitor', 'alert', 'slo', 'latency', 'timeout', 'retry', 'diagnostic', 'debug'],
    directives: ['Expose structured status, bounded logs, correlation IDs, and actionable error messages.', 'Design retries with caps, jitter, and idempotency.'],
    bridges: ['devops_cloud', 'distributed_systems', 'performance_engineering'],
  },
  {
    id: 'testing_quality',
    label: 'Testing & Quality',
    expertDomain: 'debug',
    keywords: ['test', 'unit', 'integration', 'e2e', 'vitest', 'jest', 'playwright', 'coverage', 'qa', 'regression'],
    directives: ['Add tests at the lowest level that proves behavior.', 'Test failure modes, not just happy paths.'],
    bridges: ['debugging', 'security_engineering', 'backend_engineering', 'frontend_engineering'],
  },
  {
    id: 'performance_engineering',
    label: 'Performance Engineering',
    expertDomain: 'debug',
    keywords: ['performance', 'optimize', 'memory', 'cpu', 'bundle', 'cache', 'profiling', 'leak', 'slow', 'throughput'],
    directives: ['Measure before optimizing and name the bottleneck.', 'Prefer algorithmic and architectural fixes over micro-optimizations.'],
    bridges: ['algorithms_data_structures', 'frontend_engineering', 'observability'],
  },
  {
    id: 'programming_languages',
    label: 'Programming Languages & Compilers',
    expertDomain: 'code',
    keywords: ['compiler', 'parser', 'ast', 'interpreter', 'language', 'type system', 'transpile', 'runtime', 'syntax'],
    directives: ['Represent grammar, AST, and evaluation phases explicitly.', 'Keep parsing, validation, and execution concerns separated.'],
    bridges: ['algorithms_data_structures', 'systems_programming', 'testing_quality'],
  },
  {
    id: 'systems_programming',
    label: 'Systems Programming',
    expertDomain: 'code',
    keywords: ['os', 'kernel', 'thread', 'process', 'memory', 'concurrency', 'lock', 'filesystem', 'rust', 'c++', 'c ', 'native'],
    directives: ['Reason about ownership, synchronization, memory safety, and resource cleanup.', 'Make concurrency assumptions explicit.'],
    bridges: ['performance_engineering', 'security_engineering', 'programming_languages'],
  },
  {
    id: 'networking',
    label: 'Networking',
    expertDomain: 'debug',
    keywords: ['network', 'http', 'websocket', 'tcp', 'udp', 'dns', 'tls', 'cors', 'proxy', 'socket', 'grpc'],
    directives: ['Trace request paths, headers, protocol upgrades, and timeout behavior.', 'Distinguish client, server, proxy, and provider failure domains.'],
    bridges: ['backend_engineering', 'security_engineering', 'observability'],
  },
  {
    id: 'mobile_desktop',
    label: 'Mobile & Desktop Apps',
    expertDomain: 'ui',
    keywords: ['mobile', 'ios', 'android', 'react native', 'electron', 'desktop', 'pwa', 'touch', 'responsive'],
    directives: ['Design for device constraints, offline states, gestures, and platform conventions.', 'Keep shared logic portable and UI platform-specific.'],
    bridges: ['frontend_engineering', 'accessibility', 'performance_engineering'],
  },
  {
    id: 'graphics_games',
    label: 'Graphics, Games & Simulation',
    expertDomain: 'code',
    keywords: ['game', 'graphics', 'webgl', 'canvas', 'shader', 'simulation', 'physics', 'rendering', 'three.js'],
    directives: ['Separate render loop, state update, assets, and input handling.', 'Budget frames and avoid blocking the main thread.'],
    bridges: ['performance_engineering', 'algorithms_data_structures', 'frontend_engineering'],
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    expertDomain: 'ui',
    keywords: ['accessibility', 'a11y', 'aria', 'keyboard', 'screen reader', 'contrast', 'focus', 'semantic'],
    directives: ['Preserve semantic HTML, keyboard reachability, visible focus, and contrast.', 'Treat accessibility as product quality, not an afterthought.'],
    bridges: ['frontend_engineering', 'product_design', 'testing_quality'],
  },
  {
    id: 'product_design',
    label: 'Product & UX Design',
    expertDomain: 'ui',
    keywords: ['product', 'ux', 'user journey', 'onboarding', 'pricing', 'market', 'saas', 'conversion', 'copy', 'design system'],
    directives: ['Connect UI choices to user jobs, trust, conversion, and retention.', 'Prefer clear flows and crisp language over ornamental complexity.'],
    bridges: ['frontend_engineering', 'software_architecture', 'accessibility'],
  },
  {
    id: 'privacy_compliance',
    label: 'Privacy & Compliance',
    expertDomain: 'security',
    keywords: ['privacy', 'gdpr', 'compliance', 'pii', 'hipaa', 'soc2', 'retention', 'consent', 'policy'],
    directives: ['Minimize data collection, define retention, and redact sensitive information.', 'Surface compliance implications when storing user or provider data.'],
    bridges: ['security_engineering', 'databases', 'product_design'],
  },
  {
    id: 'git_delivery',
    label: 'Git, Delivery & Collaboration',
    expertDomain: 'git',
    keywords: ['git', 'github', 'pr', 'pull request', 'commit', 'branch', 'merge', 'release', 'changelog', 'version'],
    directives: ['Protect existing work, isolate branches, and summarize changes with verification evidence.', 'Check conflict and CI state before delivery actions.'],
    bridges: ['devops_cloud', 'testing_quality', 'software_architecture'],
  },
  {
    id: 'documentation_education',
    label: 'Documentation & Technical Writing',
    expertDomain: 'code',
    keywords: ['docs', 'readme', 'explain', 'tutorial', 'guide', 'api docs', 'comment', 'onboarding'],
    directives: ['Write for the next maintainer: concise, accurate, and task-oriented.', 'Keep docs synchronized with actual interfaces and commands.'],
    bridges: ['product_design', 'testing_quality', 'software_architecture'],
  },
];

export const SKILL_NODE_BY_ID = new Map(CS_SKILL_NODES.map(node => [node.id, node]));

export function tokenizePrompt(prompt) {
  return String(prompt || '')
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter(Boolean);
}

function keywordScore(promptLower, tokens, keyword) {
  const k = keyword.toLowerCase();
  if (k.includes(' ')) return promptLower.includes(k) ? 4 : 0;
  if (tokens.includes(k)) return 3;
  return tokens.some(token => token.includes(k) || k.includes(token)) ? 1 : 0;
}

export function scoreSkillNodes(prompt) {
  const promptLower = String(prompt || '').toLowerCase();
  const tokens = tokenizePrompt(prompt);

  return CS_SKILL_NODES.map(node => {
    const score = node.keywords.reduce((sum, keyword) => sum + keywordScore(promptLower, tokens, keyword), 0);
    return { node, score };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.node.label.localeCompare(b.node.label));
}

function inferDomain(scored) {
  const domainScores = new Map();
  for (const { node, score } of scored) {
    domainScores.set(node.expertDomain, (domainScores.get(node.expertDomain) || 0) + score);
  }

  return [...domainScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'code';
}

export function selectSkillProfile(prompt, { maxSkills = 5 } = {}) {
  const scored = scoreSkillNodes(prompt);
  const selected = scored.slice(0, maxSkills).map(item => item.node);
  const selectedIds = new Set(selected.map(node => node.id));
  const bridges = [];

  for (const node of selected) {
    for (const bridgeId of node.bridges || []) {
      if (selectedIds.has(bridgeId)) {
        bridges.push({ from: node.id, to: bridgeId });
      }
    }
  }

  return {
    domain: inferDomain(scored),
    confidence: scored.length ? Math.min(0.99, scored[0].score / Math.max(8, scored.slice(0, 3).reduce((sum, item) => sum + item.score, 0))) : 0,
    selectedSkills: selected,
    bridges,
    scores: scored.slice(0, 10).map(({ node, score }) => ({ id: node.id, label: node.label, domain: node.expertDomain, score })),
  };
}

export function buildSkillBridgePrompt(profile) {
  if (!profile?.selectedSkills?.length) {
    return `# Skill Switcher Bridge\nNo high-confidence CS specialty was detected. Operate as a generalist: clarify intent, inspect context, choose the smallest safe expert path, and escalate to planning/security/debugging when evidence requires it.`;
  }

  const skillLines = profile.selectedSkills.map((node, index) => {
    const directives = node.directives.map(rule => `    - ${rule}`).join('\n');
    return `${index + 1}. ${node.label} (${node.expertDomain})\n${directives}`;
  }).join('\n');

  const bridgeLines = profile.bridges.length
    ? profile.bridges.map(edge => {
        const from = SKILL_NODE_BY_ID.get(edge.from)?.label || edge.from;
        const to = SKILL_NODE_BY_ID.get(edge.to)?.label || edge.to;
        return `- ${from} <-> ${to}`;
      }).join('\n')
    : '- No direct edge among selected skills; use the highest-ranked skill as primary and borrow adjacent directives only when needed.';

  return `# Skill Switcher Bridge (Mixture-of-Experts)\nPrimary expert domain: ${profile.domain}\nConfidence: ${profile.confidence.toFixed(2)}\n\n## Selected CS Skill Neurons\n${skillLines}\n\n## Bridge Edges\n${bridgeLines}\n\n## Switching Protocol\n- Start with the highest-ranked skill, but actively switch when the evidence moves into a bridged domain.\n- When two selected skills conflict, prefer security, correctness, and testability over speed or aesthetics.\n- Before editing, name which skill lens is active in your private reasoning and choose tools accordingly.\n- If the task spans 3+ files or multiple skill neurons, create a concise plan before executing.\n- End with verification evidence tied to the active skills.`;
}

export function listSkillGraph() {
  return CS_SKILL_NODES.map(({ id, label, expertDomain, bridges }) => ({ id, label, expertDomain, bridges }));
}
