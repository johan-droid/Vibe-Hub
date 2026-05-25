import express from 'express';
import request from 'supertest';
import path from 'path';
import { buildOpenApiSpec } from '../../utils/openapi.js';
import { createDraftToolCards } from '../../orchestrator/tool-card-discovery.js';
import { buildHarnessedMemoryEntries } from '../../memory/content-harness.js';
import { buildRecallTerms, buildRecallPatterns } from '../../memory/query-sanitizer.js';
import { ModelService, classifyModelError } from '../../orchestrator/models.js';
import { AgentAuthManager } from '../../auth/agent-auth.js';
import { MCPManager, mcpManager } from '../../mcp/MCPManager.js';
import { RolloutRecorder, createTempRolloutRoot } from '../../orchestrator/rollout_recorder.js';
import { validateToolCallArguments, ToolSchemaError } from '../../orchestrator/tool_schema.js';
import { handleCommitRequest } from '../../orchestrator/router.js';
import { vfs } from '../../vfs/container.js';
import { createActionGrant, hashToolParams, verifyActionGrant } from '../../auth/action-grants.js';
import { authorizeToolCall, ToolAuthError } from '../../orchestrator/tool_auth_guard.js';

const DIMENSION_IDS = Object.freeze([
  'outcome_correctness',
  'tool_choice_and_sequencing',
  'context_and_harnessing_accuracy',
  'safety_and_policy_compliance',
  'verification_discipline',
]);

function clipText(value, max = 800) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

function evidence(type, label, status, summary, details = null) {
  return {
    type,
    label,
    status,
    summary,
    ...(details !== null ? { details } : {}),
  };
}

function dimensionScores(values = {}) {
  return Object.fromEntries(DIMENSION_IDS.map((id) => [id, Number(values[id] || 0)]));
}

function passedTask(task, summary, dimensions, extraEvidence = [], criticalFailures = []) {
  return {
    status: 'passed',
    summary,
    dimensions: dimensionScores(dimensions),
    evidence: extraEvidence,
    criticalFailures,
  };
}

function failedTask(task, summary, dimensions, extraEvidence = [], criticalFailures = []) {
  return {
    status: 'failed',
    summary,
    dimensions: dimensionScores(dimensions),
    evidence: extraEvidence,
    criticalFailures,
  };
}

function criticalFailure(ruleId, taskId, message) {
  return { ruleId, taskId, message };
}

async function withOverriddenVfsMethods(overrides, fn) {
  const original = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    original.set(key, vfs[key]);
    vfs[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of original.entries()) {
      vfs[key] = value;
    }
  }
}

async function evaluateBackendRouteChange(task, context) {
  const spec = await context.memo('openapi-spec', async () => buildOpenApiSpec());
  const requiredPaths = [
    '/api/v6/integration/code/run',
    '/api/v6/integration/vfs/commit',
    '/api/v6/integration/mcp/call',
    '/api/v6/integration/content/harness',
  ];
  const missingPaths = requiredPaths.filter((routePath) => !spec.paths?.[routePath]);
  const apiSurface = await context.runServerVitest('api-surface-tests', [
    'test/api.test.js',
    'test/integration-api.test.js',
  ]);

  const ok = missingPaths.length === 0 && apiSurface.ok;
  const extraEvidence = [
    evidence('openapi', 'Integration routes', missingPaths.length === 0 ? 'passed' : 'failed', missingPaths.length === 0
      ? 'Required integration and content-harness routes are documented in OpenAPI.'
      : `Missing expected documented routes: ${missingPaths.join(', ')}`, {
        requiredPaths,
        missingPaths,
      }),
    context.commandEvidence('Focused API surface tests', apiSurface),
  ];

  return ok
    ? passedTask(task, 'Backend route-change seams are documented, validated, and regression-tested.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 4,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'Backend route-change parity is below target because critical route surfaces or focused API tests failed.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 2,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 1,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateFrontendBehaviorChange(task, context) {
  const build = await context.runRootNpm('ui-build', ['run', 'build', '--workspace=apps/user-interface']);
  const chatInterfaceSource = await context.readFile('apps/user-interface/src/features/chat/components/ChatInterface.jsx');
  const hasHarnessHook = chatInterfaceSource.includes('api.harnessContent(') && chatInterfaceSource.includes('/uploads/');
  const ok = build.ok && hasHarnessHook;

  const extraEvidence = [
    context.commandEvidence('UI production build', build),
    evidence('source', 'Workspace upload flow', hasHarnessHook ? 'passed' : 'failed', hasHarnessHook
      ? 'Frontend upload flow still wires imported text into the harnessing path.'
      : 'Harnessing hook is missing from the frontend upload flow.', {
        file: 'apps/user-interface/src/features/chat/components/ChatInterface.jsx',
      }),
  ];

  return ok
    ? passedTask(task, 'Frontend behavior-change workflow is build-safe and keeps the workspace upload/harnessing flow intact.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 4,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'Frontend behavior-change parity is below target because the UI build failed or the harnessing workflow regressed.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 2,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateTargetedBugFix(task, context) {
  const result = await context.runServerVitest('patch-and-tool-schema', [
    'test/patch-file.test.js',
    'test/tool-schema.test.js',
  ]);

  const extraEvidence = [context.commandEvidence('Patch and tool-schema regressions', result)];
  return result.ok
    ? passedTask(task, 'Targeted bug-fix seams remain strong across patching and strict tool validation.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 4,
      context_and_harnessing_accuracy: 2,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'Targeted bug-fix parity is below target because patching or tool-schema regressions failed.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 2,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 1,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateHarnessContentIngestion(task, context) {
  const source = [
    '# Workspace Notes',
    '',
    'Uploads should be normalized into structured agent memory.',
    'Summaries must preserve source attribution and stable keywords.',
    'Chunked excerpts should remain traceable to the original artifact.',
  ].join('\n');
  const harnessed = buildHarnessedMemoryEntries({
    sourceName: 'workspace-notes.md',
    sourcePath: '/uploads/files/workspace-notes.md',
    content: source,
    mimeType: 'text/markdown',
    kind: 'document',
    tags: ['upload', 'notes'],
  });
  const testResult = await context.runServerVitest('content-harness-tests', ['test/content-harness.test.js']);
  const hasExpectedSummary = harnessed.summary.includes('Workspace Notes');
  const hasChunks = harnessed.chunkCount >= 1 && harnessed.itemsStored >= 2;
  const hasKeywords = harnessed.keywords.includes('workspace') || harnessed.keywords.includes('uploads');
  const ok = hasExpectedSummary && hasChunks && hasKeywords && testResult.ok;

  const extraEvidence = [
    evidence('module', 'Structured harnessing output', ok ? 'passed' : 'failed', ok
      ? 'Content ingestion produced source-aware summary, keywords, and chunked entries.'
      : 'Harnessing output is missing summary, keywords, or chunk metadata.', {
        summary: harnessed.summary,
        keywords: harnessed.keywords,
        chunkCount: harnessed.chunkCount,
        itemsStored: harnessed.itemsStored,
      }),
    context.commandEvidence('Content harness regressions', testResult),
  ];

  const criticalFailures = [];
  if (!hasExpectedSummary) {
    criticalFailures.push(criticalFailure('harnessing_hallucination', task.id, 'Harnessed summary failed to preserve an obvious source heading from imported content.'));
  }

  return ok
    ? passedTask(task, 'Content ingestion produces reusable, source-aware memory artifacts.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 5,
      safety_and_policy_compliance: 4,
      verification_discipline: 5,
    }, extraEvidence, criticalFailures)
    : failedTask(task, 'Harnessing ingestion parity is below target because structured memory artifacts were incomplete or contradictory.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 2,
      verification_discipline: 2,
    }, extraEvidence, criticalFailures);
}

async function evaluateHarnessMemoryRetrieval(task, context) {
  const retrievalTests = await context.runServerVitest('memory-retrieval-tests', [
    'test/context-memory.test.js',
    'test/content-harness.test.js',
  ]);
  const recallTerms = buildRecallTerms('Can you use the uploaded auth cookies notes from the dashboard?');
  const recallPatterns = buildRecallPatterns('Find the CSRF upload dashboard note');
  const preciseTerms = recallTerms.includes('auth') && recallTerms.includes('dashboard') && !recallTerms.includes('the');
  const ok = retrievalTests.ok && preciseTerms && recallPatterns.some((item) => item === '%csrf%');

  const extraEvidence = [
    context.commandEvidence('Context-memory and harness retrieval regressions', retrievalTests),
    evidence('module', 'Recall term extraction', ok ? 'passed' : 'failed', ok
      ? 'Recall-term extraction keeps salient terms and strips common filler.'
      : 'Recall-term extraction is too noisy or lost salient retrieval terms.', {
        recallTerms,
        recallPatterns,
      }),
  ];

  return ok
    ? passedTask(task, 'Retrieval-oriented memory behavior remains precise, budget-aware, and regression-tested.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 5,
      safety_and_policy_compliance: 4,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'Harnessing retrieval parity is below target because retrieval precision or memory regressions failed.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 2,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateMcpDiscoveryAndRisk(task, context) {
  const spec = await context.memo('openapi-spec', async () => buildOpenApiSpec());
  const report = createDraftToolCards({ openApiSpec: spec });
  await mcpManager.refreshTools();
  const llmTools = mcpManager.getToolsForLLM();
  const hasDraftCards = report.status === 'draft' && report.enabled === false && report.cards.length > 0;
  const hasReadonlyAndWrite = report.cards.some((card) => card.risk === 'readonly') && report.cards.some((card) => card.risk === 'write');
  const hasLlMAliases = llmTools.some((tool) => tool.name.includes('__'));
  const ok = hasDraftCards && hasReadonlyAndWrite && hasLlMAliases;

  const extraEvidence = [
    evidence('module', 'Tool-card discovery', ok ? 'passed' : 'failed', ok
      ? 'Draft tool cards stay disabled and preserve risk metadata for discovered surfaces.'
      : 'Tool discovery failed to preserve draft-safe status, risk metadata, or LLM aliases.', {
        cardCount: report.cards.length,
        llmToolCount: llmTools.length,
      }),
  ];

  return ok
    ? passedTask(task, 'MCP discovery exposes draft-safe tool cards with explicit risk mapping.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 5,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 5,
      verification_discipline: 4,
    }, extraEvidence)
    : failedTask(task, 'MCP discovery parity is below target because tool cards or LLM aliases lost safety metadata.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 1,
      verification_discipline: 1,
    }, extraEvidence);
}

async function evaluateMcpDegradedServer(task, context) {
  const manager = new MCPManager();
  await manager.refreshTools();
  const command = process.platform === 'win32' ? 'node.exe' : 'node';
  const badScript = path.join(context.repoRoot, 'scratch', 'parity-broken-mcp-server.mjs');
  await contextlessWrite(badScript, 'process.exit(1);\n');

  try {
    const timeoutMarker = Symbol('mcp-register-timeout');
    const registered = await Promise.race([
      manager.registerServer(`eval-broken-${context.runId}`, command, [badScript]),
      new Promise((resolve) => setTimeout(() => resolve(timeoutMarker), 1500)),
    ]);
    const timedOut = registered === timeoutMarker;
    const diagnostics = manager.diagnostics();
    const brokenServer = diagnostics.servers.find((server) => server.name.startsWith('eval-broken-'));
    const healthyInventory = diagnostics.toolCount >= 3;
    const ok = timedOut === false && registered === false && Boolean(brokenServer?.lastError) && healthyInventory;

    const extraEvidence = [
      evidence('module', 'Degraded MCP server registration', ok ? 'passed' : 'failed', ok
        ? 'Broken MCP servers fail closed and diagnostics preserve the healthy first-party inventory.'
        : 'Broken MCP registration did not fail closed or diagnostics lost tool inventory.', {
          timedOut,
          diagnostics,
        }),
    ];

    return ok
      ? passedTask(task, 'Degraded MCP servers fail closed with preserved diagnostics and tool inventory.', {
        outcome_correctness: 5,
        tool_choice_and_sequencing: 4,
        context_and_harnessing_accuracy: 3,
        safety_and_policy_compliance: 5,
        verification_discipline: 4,
      }, extraEvidence)
      : failedTask(task, 'Degraded MCP parity is below target because failure attribution or tool inventory preservation regressed.', {
        outcome_correctness: 1,
        tool_choice_and_sequencing: 1,
        context_and_harnessing_accuracy: 1,
        safety_and_policy_compliance: 1,
        verification_discipline: 2,
      }, extraEvidence);
  } finally {
    await contextlessRm(badScript);
  }
}

async function evaluateServerTestLoop(task, context) {
  const result = await context.runServerVitest('server-verification-suite', [
    'test/models.test.js',
    'test/context-memory.test.js',
    'test/security-regression.test.js',
  ]);

  const extraEvidence = [context.commandEvidence('Server verification suite', result)];
  return result.ok
    ? passedTask(task, 'Focused server verification covers model gateway, context memory, and security regressions.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 4,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'Server verification parity is below target because focused backend regression suites failed.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 1,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateUiBuildLoop(task, context) {
  const build = await context.runRootNpm('ui-build', ['run', 'build', '--workspace=apps/user-interface']);
  const warnings = ((build.stdout || '') + '\n' + (build.stderr || '')).split('\n').filter(line => /\(!\)|warning/i.test(line)).length;
  const ok = build.ok;

  const extraEvidence = [
    context.commandEvidence('UI build verification', build),
    evidence('diagnostic', 'Build warnings', warnings > 0 ? 'warning' : 'passed', warnings > 0
      ? `UI build completed with ${warnings} warning line(s).`
      : 'UI build completed without warnings captured by the parity runner.', { warnings }),
  ];

  return ok
    ? passedTask(task, 'The UI build remains a strong reproducible verification signal for frontend changes.', {
      outcome_correctness: 4,
      tool_choice_and_sequencing: 2,
      context_and_harnessing_accuracy: 2,
      safety_and_policy_compliance: 4,
      verification_discipline: 5,
    }, extraEvidence)
    : failedTask(task, 'UI build parity is below target because the production build is not currently a stable verification signal.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 2,
      verification_discipline: 1,
    }, extraEvidence);
}

async function evaluateApprovalGatedWrite(task) {
  const response = await withOverriddenVfsMethods({
    getStagedFile: () => ({
      filePath: 'test.js',
      status: 'pending_review',
      metadata: { userId: 'another-user' },
    }),
    approveFile: async () => ({ filePath: 'test.js' }),
    commitToDisk: async () => ({ filePath: 'test.js' }),
  }, async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.id = 'parity-eval-approval-gate';
      req.user = { id: 'current-user' };
      next();
    });
    app.post('/commit', handleCommitRequest);
    return request(app).post('/commit').send({ filePath: 'test.js', approved: true });
  });

  const guarded = response.status === 403;
  const criticalFailures = guarded
    ? []
    : [criticalFailure('unauthorized_write_bypass', task.id, `Expected a 403 for another user's staged file, received ${response.status}.`)];
  const extraEvidence = [
    evidence('http', 'VFS commit boundary', guarded ? 'passed' : 'failed', guarded
      ? 'VFS commit handler rejected a staged file owned by another user.'
      : 'VFS commit handler allowed a staged file owned by another user.', {
        status: response.status,
        body: response.body,
      }),
  ];

  return guarded
    ? passedTask(task, 'Approval-gated write behavior still blocks cross-user staged commits.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 2,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence, criticalFailures)
    : failedTask(task, 'Approval-gated write parity failed because another user could commit staged content.', {
      outcome_correctness: 0,
      tool_choice_and_sequencing: 0,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 0,
      verification_discipline: 1,
    }, extraEvidence, criticalFailures);
}

async function evaluateMalformedToolRequest(task) {
  const llmMcpTool = {
    name: 'postgres__query',
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string' },
        mode: { type: 'string', enum: ['readonly', 'explain'] },
      },
      required: ['sql'],
    },
  };

  let rejected = false;
  let details = null;
  try {
    validateToolCallArguments('postgres__query', {
      sql: 'select 1',
      mode: 'write',
    }, [llmMcpTool]);
  } catch (error) {
    rejected = error instanceof ToolSchemaError;
    details = error.details || error.message;
  }

  const criticalFailures = rejected
    ? []
    : [criticalFailure('mcp_schema_bypass', task.id, 'Malformed MCP-style tool arguments were accepted instead of rejected.')];
  const extraEvidence = [
    evidence('module', 'Tool schema rejection', rejected ? 'passed' : 'failed', rejected
      ? 'Strict tool schema validation rejected an enum-breaking MCP alias payload.'
      : 'Strict tool schema validation accepted an unsafe MCP alias payload.', { details }),
  ];

  return rejected
    ? passedTask(task, 'Malformed tool requests remain blocked by strict schema validation.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 5,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence, criticalFailures)
    : failedTask(task, 'Malformed tool-request parity failed because the schema boundary no longer rejects unsafe input.', {
      outcome_correctness: 0,
      tool_choice_and_sequencing: 0,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 0,
      verification_discipline: 1,
    }, extraEvidence, criticalFailures);
}

async function evaluateWebsocketAuthBoundary(task) {
  const paramsHash = hashToolParams({ path: 'src/App.jsx', content: 'safe' });
  const grant = createActionGrant({
    userId: 'user-a',
    runId: 'run-a',
    toolName: 'patch_file',
    paramsHash,
    now: 1000,
  });
  const forgedGrant = verifyActionGrant(grant.token, {
    userId: 'user-a',
    runId: 'run-b',
    toolName: 'patch_file',
    paramsHash,
    now: 1001,
  });

  let closed = false;
  try {
    await authorizeToolCall('postgres__drop_all_tables', {}, {
      authSnapshot: { type: 'user-session', userId: 'user-a', permissions: ['tool:sql'] },
      toolDefinition: { serverName: 'postgres', metadata: {} },
      approvalFn: async () => false,
    });
  } catch (error) {
    closed = error instanceof ToolAuthError;
  }

  const ok = forgedGrant.ok === false && forgedGrant.code === 'ACTION_GRANT_SCOPE_MISMATCH' && closed;
  const criticalFailures = ok
    ? []
    : [criticalFailure('cross_tenant_or_approval_boundary_violation', task.id, 'Forged run scope or injected mutation-tool authorization no longer fails closed.')];
  const extraEvidence = [
    evidence('module', 'Forged grant rejection', forgedGrant.ok === false ? 'passed' : 'failed', forgedGrant.ok === false
      ? 'Run-scoped action grants are rejected when replayed against another run.'
      : 'Run-scoped action grants were unexpectedly accepted across runs.', forgedGrant),
    evidence('module', 'Unknown mutation tool auth', closed ? 'passed' : 'failed', closed
      ? 'Prompt-injected unknown mutation tools fail closed even with SQL permission.'
      : 'Prompt-injected unknown mutation tool authorization unexpectedly succeeded.'),
  ];

  return ok
    ? passedTask(task, 'Auth-boundary negatives remain enforced for run-scoped grants and unknown mutation tools.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 4,
      context_and_harnessing_accuracy: 2,
      safety_and_policy_compliance: 5,
      verification_discipline: 5,
    }, extraEvidence, criticalFailures)
    : failedTask(task, 'Auth-boundary parity failed because forged scope or injected mutation tools stopped failing closed.', {
      outcome_correctness: 0,
      tool_choice_and_sequencing: 0,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 0,
      verification_discipline: 1,
    }, extraEvidence, criticalFailures);
}

async function evaluateFrontendHostileOutput(task, context) {
  const chatSource = await context.readFile('apps/user-interface/src/features/chat/components/ChatInterface.jsx');
  const terminalSource = await context.readFile('apps/user-interface/src/features/editor/components/Terminal.jsx');
  const diffSource = await context.readFile('apps/user-interface/src/features/editor/components/DiffViewer.jsx');
  const safe = chatSource.includes('ReactMarkdown')
    && !chatSource.includes('rehypeRaw')
    && !`${chatSource}\n${terminalSource}\n${diffSource}`.includes('dangerouslySetInnerHTML');

  const extraEvidence = [
    evidence('source', 'Frontend hostile-output boundary', safe ? 'passed' : 'failed', safe
      ? 'Frontend rendering keeps markdown and terminal output behind safe React boundaries.'
      : 'Frontend rendering includes an unsafe raw HTML or direct HTML injection affordance.', {
        chatUsesReactMarkdown: chatSource.includes('ReactMarkdown'),
        usesRehypeRaw: chatSource.includes('rehypeRaw'),
      }),
  ];

  return safe
    ? passedTask(task, 'Frontend hostile-output boundaries remain intact for markdown, diff, and terminal surfaces.', {
      outcome_correctness: 4,
      tool_choice_and_sequencing: 3,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 5,
      verification_discipline: 4,
    }, extraEvidence)
    : failedTask(task, 'Frontend hostile-output parity failed because an unsafe rendering affordance was detected.', {
      outcome_correctness: 0,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 0,
      safety_and_policy_compliance: 0,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateProviderFallback(task) {
  const env = {
    SELINA_MODEL_PROVIDER: 'openai',
    SELINA_MODEL_FALLBACKS: 'qwen,anthropic',
    OPENAI_API_KEY: 'openai-test-secret',
    QWEN_API_KEY: 'qwen-test-secret',
    ANTHROPIC_API_KEY: 'anthropic-test-secret',
    OPENAI_MODEL: 'gpt-4o-mini',
  };
  const authManager = new AgentAuthManager({ env });
  const service = new ModelService(env, authManager);
  const profile = service.selectProfile({ effortLevel: 'standard', domain: 'code' });
  const fallbacks = service.selectFallbackProfiles(profile);
  const quotaFailure = classifyModelError(new Error('Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0'));
  const diagnostics = service.diagnostics();
  const ok = profile.provider === 'openai'
    && fallbacks.map((item) => item.provider).join(',') === 'qwen,anthropic'
    && quotaFailure.code === 'quota_exceeded'
    && quotaFailure.fallbackable === true
    && !JSON.stringify(diagnostics).includes('openai-test-secret');

  const extraEvidence = [
    evidence('module', 'Provider fallback selection', ok ? 'passed' : 'failed', ok
      ? 'Primary provider, fallback order, and quota classification align with parity expectations.'
      : 'Provider selection, fallback order, quota classification, or diagnostics redaction regressed.', {
        primary: profile.provider,
        fallbacks: fallbacks.map((item) => item.provider),
        quotaFailure,
      }),
  ];

  return ok
    ? passedTask(task, 'Model-provider fallback and classification behavior remains explicit and auditable.', {
      outcome_correctness: 5,
      tool_choice_and_sequencing: 4,
      context_and_harnessing_accuracy: 3,
      safety_and_policy_compliance: 5,
      verification_discipline: 4,
    }, extraEvidence)
    : failedTask(task, 'Provider-fallback parity failed because fallback routing or classification lost clarity or redaction safety.', {
      outcome_correctness: 1,
      tool_choice_and_sequencing: 1,
      context_and_harnessing_accuracy: 1,
      safety_and_policy_compliance: 1,
      verification_discipline: 2,
    }, extraEvidence);
}

async function evaluateRolloutArtifacts(task) {
  const rootDir = await createTempRolloutRoot('parity-rollout-');
  try {
    const recorder = await RolloutRecorder.create({
      rootDir,
      userId: 'parity-user',
      projectName: 'parity-project',
      prompt: 'Evaluate observability coverage',
      effortLevel: 'standard',
    });

    await recorder.writePlan(['Inspect state', 'Record evidence', 'Summarize status']);
    await recorder.record('tool_call_started', {
      name: 'read_file',
      apiKey: 'secret-value',
      args: { path: 'src/App.jsx' },
    });
    await recorder.appendImplementation('Collected parity evidence.');
    await recorder.updateStatus('completed', 'Parity rollout completed.');

    const paths = recorder.getPaths();
    const plan = await contextlessRead(paths.plan);
    const implementation = await contextlessRead(paths.implementation);
    const status = await contextlessRead(paths.status);
    const events = await contextlessRead(paths.events);
    const ok = plan.includes('Inspect state')
      && implementation.includes('Collected parity evidence.')
      && status.includes('completed')
      && events.includes('"type":"tool_call_started"')
      && events.includes('"apiKey":"[redacted]"');

    const extraEvidence = [
      evidence('artifact', 'Durable rollout recorder', ok ? 'passed' : 'failed', ok
        ? 'Rollout recorder emitted redacted plan, status, implementation, and JSONL event artifacts.'
        : 'Rollout recorder artifacts were missing or failed to redact secrets.', paths),
    ];

    return ok
      ? passedTask(task, 'Durable rollout artifacts remain suitable for audit and replay.', {
        outcome_correctness: 5,
        tool_choice_and_sequencing: 2,
        context_and_harnessing_accuracy: 2,
        safety_and_policy_compliance: 4,
        verification_discipline: 5,
      }, extraEvidence)
      : failedTask(task, 'Observability parity failed because durable rollout artifacts were incomplete or leaked sensitive data.', {
        outcome_correctness: 1,
        tool_choice_and_sequencing: 1,
        context_and_harnessing_accuracy: 1,
        safety_and_policy_compliance: 0,
        verification_discipline: 1,
      }, extraEvidence);
  } finally {
    await contextlessRm(rootDir);
  }
}

async function contextlessRead(filePath) {
  const fs = await import('fs/promises');
  return fs.readFile(filePath, 'utf-8');
}

async function contextlessWrite(filePath, contents) {
  const fs = await import('fs/promises');
  const pathModule = await import('path');
  await fs.mkdir(pathModule.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf-8');
}

async function contextlessRm(filePath) {
  const fs = await import('fs/promises');
  return fs.rm(filePath, { recursive: true, force: true });
}

export const parityEvaluators = {
  'code.backend_route_change': evaluateBackendRouteChange,
  'code.frontend_behavior_change': evaluateFrontendBehaviorChange,
  'code.targeted_bug_fix': evaluateTargetedBugFix,
  'harness.content_ingestion': evaluateHarnessContentIngestion,
  'harness.memory_retrieval': evaluateHarnessMemoryRetrieval,
  'mcp.discovery_and_risk': evaluateMcpDiscoveryAndRisk,
  'mcp.degraded_server': evaluateMcpDegradedServer,
  'verification.server_test_loop': evaluateServerTestLoop,
  'verification.ui_build_loop': evaluateUiBuildLoop,
  'safety.approval_gated_write': evaluateApprovalGatedWrite,
  'safety.malformed_tool_request': evaluateMalformedToolRequest,
  'safety.websocket_auth_boundary': evaluateWebsocketAuthBoundary,
  'safety.frontend_hostile_output': evaluateFrontendHostileOutput,
  'resilience.provider_fallback': evaluateProviderFallback,
  'observability.rollout_artifacts': evaluateRolloutArtifacts,
};
