import { checkSecurity } from './security-shield.js';
import { runPreFlight } from './static-analyzer.js';
import { triageAndRoute } from './agents/triage-router.js';
import { ContextCompressor } from './agents/context-compressor.js';
import { TheBrain } from './agents/the-brain.js';
import { LeadArchitect } from './agents/lead-architect.js';
import { synthesizeDiffs } from './agents/merge-master.js';
import { validateIntent } from './agents/intent-validator.js';
import { WorkerOrchestrator } from './worker-orchestrator.js';
import { SolutionsLedger } from './solutions-ledger.js';
import { SandboxProviderRouter } from '../sandbox/providers.js';
import { TokenBudgetBroker } from '../memory/token-budget-broker.js';
import { assertPromptSafe } from './prompt-guard.js';

export const BRAIN_SYSTEM_STAGES = Object.freeze([
  'token_budget_governor',
  'triage_security',
  'static_analysis',
  'context_compression',
  'brain_planner',
  'sequential_coder',
  'docker_vfs_sandbox',
  'intent_validator',
  'return_loop_ledger',
  'lead_architect',
  'sync_node_contract',
  'parallel_workers',
  'merge_master',
]);

export class BrainSystemOrchestrator {
  constructor({
    securityCheck = checkSecurity,
    triage = triageAndRoute,
    preFlight = runPreFlight,
    compressor = new ContextCompressor(),
    brain = new TheBrain(),
    sequentialRunner = WorkerOrchestrator.runSequential.bind(WorkerOrchestrator),
    architect = new LeadArchitect(),
    phasedRunner = WorkerOrchestrator.runPhasedExecution.bind(WorkerOrchestrator),
    mergeWorkerOutputs = synthesizeDiffs,
    sandboxRunner = defaultSandboxRunner,
    intentValidator = validateIntent,
    ledger = new SolutionsLedger(),
    tokenBudget = new TokenBudgetBroker(),
  } = {}) {
    this.securityCheck = securityCheck;
    this.triage = triage;
    this.preFlight = preFlight;
    this.compressor = compressor;
    this.brain = brain;
    this.sequentialRunner = sequentialRunner;
    this.architect = architect;
    this.phasedRunner = phasedRunner;
    this.mergeWorkerOutputs = mergeWorkerOutputs;
    this.sandboxRunner = sandboxRunner;
    this.intentValidator = intentValidator;
    this.ledger = ledger;
    this.tokenBudget = tokenBudget;
  }

  async run(userPrompt, options = {}) {
    const stages = [];
    const taskId = options.taskId || `brain-system-${Date.now()}`;
    const initialTokenPlan = this.tokenBudget.planBrainRun({
      userPrompt,
      rawCode: options.rawCode || '',
      errorLogs: options.errorLogs || '',
    });
    const budgetRoute = estimatePromptComplexity(userPrompt, initialTokenPlan);
    recordStage(stages, 'token_budget_governor', {
      route: budgetRoute === 'high' ? 'high-feature' : 'low-edit',
      complexity: budgetRoute,
      tokenPlan: summarizeTokenPlan(initialTokenPlan),
    });

    let triage;
    try {
      this.securityCheck(userPrompt);
      await assertPromptSafe(userPrompt);
      triage = normalizeTriage(await this.triage(userPrompt), budgetRoute);
      recordStage(stages, 'triage_security', {
        intent: triage.intent,
        complexity: triage.complexity,
        targetFiles: triage.target_files,
      });
    } catch (error) {
      recordStage(stages, 'triage_security', {
        status: 'rejected',
        reason: error.message,
      });
      return {
        status: 'rejected',
        stage: 'triage_security',
        reason: error.message,
        stages,
      };
    }

    const preFlight = await this.preFlight(triage.target_files);
    recordStage(stages, 'static_analysis', {
      status: preFlight?.errors ? 'warning' : 'completed',
      summary: preFlight?.summary || preFlight?.output || '',
    });

    const budgetedCompressorInput = this.tokenBudget.prepareCompressorInput({
      rawCode: options.rawCode || '',
      errorLogs: options.errorLogs || '',
      preFlightSummary: preFlight?.summary || '',
    });
    const compressedContext = await this.compressor.minifyContext(
      budgetedCompressorInput.rawCode,
      userPrompt,
      budgetedCompressorInput.errorLogs
    );
    recordStage(stages, 'context_compression', {
      pointOfFailure: compressedContext?.pointOfFailure || '',
      tokenBudget: budgetedCompressorInput.report,
    });

    // Heavy-lift detection: if triage found > 5 target files, dispatch to high-feature route
    // (previously done in TheBrain.process() via broken file regex — now done here with real data)
    if (triage.target_files.length > 5) {
      triage = { ...triage, complexity: 'high' };
    }

    if (shouldUseHighFeatureRoute(triage, budgetRoute)) {
      return this.runHighFeatureRoute({
        userPrompt,
        options,
        taskId,
        triage,
        preFlight,
        compressedContext,
        stages,
      });
    }

    const brainContext = this.tokenBudget.fitForLayer(
      'brain_planner',
      serializeContextSummary(compressedContext),
      initialTokenPlan.budgets.brainContextTokens,
      { mode: 'head-tail' }
    );
    const plan = await this.brain.planSequentialFix(
      brainContext.text,
      userPrompt,
      taskId,
      options.userId || null
    );
    recordStage(stages, 'brain_planner', {
      planSteps: Array.isArray(plan) ? plan.length : 0,
      tokenBudget: withoutText(brainContext),
    });

    const coderResult = await this.sequentialRunner(plan, triage.target_files);
    recordStage(stages, 'sequential_coder', {
      targetFiles: triage.target_files,
      outputBytes: outputSize(coderResult?.modelOutput),
    });

    const sandboxResult = await this.runSandbox({
      userPrompt,
      targetFiles: triage.target_files,
      candidateOutput: coderResult,
      options,
    });
    recordStage(stages, 'docker_vfs_sandbox', sandboxStageDetails(sandboxResult));

    const validation = await this.validateCandidate({
      userPrompt,
      sandboxResult,
      candidateOutput: coderResult?.modelOutput,
    });
    recordStage(stages, 'intent_validator', {
      status: validation.satisfied ? 'completed' : 'failed',
      satisfied: Boolean(validation.satisfied),
      reasoning: validation.reasoning || '',
    });

    if (validation.satisfied) {
      return {
        status: 'completed',
        route: 'low-edit',
        stages,
        triage,
        preFlight,
        compressedContext,
        plan,
        finalOutput: coderResult,
        sandboxResult,
        validation,
      };
    }

    await this.recordFailure(taskId, validation.reasoning || 'Intent validation failed', {
      route: 'low-edit',
      sandbox: sandboxResult?.sandbox,
    });
    recordStage(stages, 'return_loop_ledger', {
      reason: validation.reasoning || 'Intent validation failed',
      fallback: 'high-feature',
    });

    return this.runHighFeatureRoute({
      userPrompt,
      options,
      taskId,
      triage,
      preFlight,
      compressedContext,
      stages,
      fallbackReason: validation.reasoning || 'Intent validation failed',
    });
  }

  async runHighFeatureRoute({
    userPrompt,
    options,
    taskId,
    triage,
    preFlight,
    compressedContext,
    stages,
    fallbackReason = null,
  }) {
    const phasedPlan = await this.architect.buildParallelMatrix(userPrompt);
    recordStage(stages, 'lead_architect', {
      phases: Array.isArray(phasedPlan?.phases) ? phasedPlan.phases.map(phase => phase.name) : [],
      fallbackReason,
    });

    let recordedSyncContract = false;
    let recordedParallelWorkers = false;
    let groundTruthContract = null;

    const { results, groundTruth } = await this.phasedRunner(phasedPlan, {
      executeTask: options.executeParallelTask,
      returnGroundTruth: true,
      onSyncComplete: async ({ groundTruth: syncedGroundTruth }) => {
        groundTruthContract = buildGroundTruthContract(syncedGroundTruth);
        recordedSyncContract = true;
        recordStage(stages, 'sync_node_contract', {
          source: groundTruthContract.source,
          exportedTypes: Object.keys(groundTruthContract.generatedTypes || {}),
          exports: groundTruthContract.exports || [],
        });
      },
      onParallelComplete: async ({ results: phaseResults }) => {
        recordedParallelWorkers = true;
        recordStage(stages, 'parallel_workers', {
          workerOutputs: Array.isArray(phaseResults) ? phaseResults.length : 0,
        });
      },
    });
    groundTruthContract = groundTruthContract || buildGroundTruthContract(groundTruth);
    if (!recordedSyncContract) {
      recordStage(stages, 'sync_node_contract', {
        source: groundTruthContract.source,
        exportedTypes: Object.keys(groundTruthContract.generatedTypes || {}),
        exports: groundTruthContract.exports || [],
      });
    }
    if (!recordedParallelWorkers) {
      recordStage(stages, 'parallel_workers', {
        workerOutputs: Array.isArray(results) ? results.length : 0,
      });
    }

    const mergedOutput = await this.mergeWorkerOutputs(results, groundTruthContract);
    recordStage(stages, 'merge_master', { outputBytes: outputSize(mergedOutput) });

    const sandboxResult = await this.runSandbox({
      userPrompt,
      targetFiles: triage.target_files,
      candidateOutput: mergedOutput,
      options,
    });
    recordStage(stages, 'docker_vfs_sandbox', sandboxStageDetails(sandboxResult));

    const validation = await this.validateCandidate({
      userPrompt,
      sandboxResult,
      candidateOutput: mergedOutput,
    });
    recordStage(stages, 'intent_validator', {
      status: validation.satisfied ? 'completed' : 'failed',
      satisfied: Boolean(validation.satisfied),
      reasoning: validation.reasoning || '',
    });

    if (!validation.satisfied) {
      await this.recordFailure(taskId, validation.reasoning || 'Architected route failed validation', {
        route: 'high-feature',
        sandbox: sandboxResult?.sandbox,
      });
      recordStage(stages, 'return_loop_ledger', {
        reason: validation.reasoning || 'Architected route failed validation',
        fallback: 'exhausted',
      });
    }

    return {
      status: validation.satisfied ? 'completed' : 'failed',
      route: 'high-feature',
      stages,
      triage,
      preFlight,
      compressedContext,
      phasedPlan,
      workerOutputs: results,
      groundTruth,
      groundTruthContract,
      finalOutput: mergedOutput,
      sandboxResult,
      validation,
      fallbackReason,
    };
  }

  async runSandbox({ userPrompt, targetFiles, candidateOutput, options }) {
    return this.sandboxRunner({
      userPrompt,
      targetFiles,
      candidateOutput,
      workspacePath: options.workspacePath,
      sandboxScriptPath: options.sandboxScriptPath,
      sandboxCommand: options.sandboxCommand,
      sandboxArgs: options.sandboxArgs,
      includePaths: options.includePaths,
      timeoutMs: options.timeoutMs,
      sandboxProvider: options.sandboxProvider,
    });
  }

  async validateCandidate({ userPrompt, sandboxResult, candidateOutput }) {
    const sandboxLogs = [
      sandboxResult?.stdout || '',
      sandboxResult?.stderr || '',
      sandboxResult?.error || '',
    ].filter(Boolean).join('\n');
    return this.intentValidator(userPrompt, sandboxLogs, serializeCandidate(candidateOutput));
  }

  async recordFailure(taskId, message, metadata) {
    if (this.ledger && typeof this.ledger.recordFailure === 'function') {
      await this.ledger.recordFailure(taskId, message, metadata);
    }
  }
}

export function buildGroundTruthContract(groundTruth = {}) {
  return {
    source: 'sync-node-ground-truth',
    generatedTypes: groundTruth.generatedTypes || {},
    ast: groundTruth.ast || {},
    files: groundTruth.files || {},
    exports: groundTruth.exports || [],
    syncOutputs: groundTruth.syncOutputs || [],
  };
}

async function defaultSandboxRunner({
  workspacePath = process.cwd(),
  sandboxScriptPath,
  sandboxCommand,
  sandboxArgs = [],
  includePaths = [],
  targetFiles = [],
  timeoutMs,
  sandboxProvider,
} = {}) {
  const requestedIncludes = [...new Set([...(targetFiles || []), ...(includePaths || [])].filter(Boolean))];
  const providers = new SandboxProviderRouter();

  if (sandboxScriptPath) {
    return providers.executeScript({
      provider: sandboxProvider,
      workspacePath,
      scriptPath: sandboxScriptPath,
      includePaths: requestedIncludes,
      timeoutMs,
    });
  }

  if (sandboxCommand) {
    return providers.executeCommand({
      provider: sandboxProvider,
      workspacePath,
      command: sandboxCommand,
      args: sandboxArgs,
      includePaths: requestedIncludes,
      timeoutMs,
    });
  }

  return {
    success: true,
    skipped: true,
    stdout: 'Docker VFS sandbox skipped because no sandbox command was supplied.',
    stderr: '',
    sandbox: {
      type: 'local_docker',
      workspace: 'isolated_tmp',
      mount: 'rw',
      copiedFiles: requestedIncludes,
      skipped: true,
    },
  };
}

function recordStage(stages, name, details = {}) {
  stages.push({
    name,
    status: details.status || 'completed',
    ...details,
  });
}

function normalizeTriage(triage, fallbackComplexity) {
  const intent = typeof triage?.intent === 'string' ? triage.intent : 'unknown';
  const complexity = triage?.complexity === 'low' || triage?.complexity === 'high'
    ? triage.complexity
    : fallbackComplexity;
  const targetFiles = Array.isArray(triage?.target_files)
    ? triage.target_files.filter(file => typeof file === 'string')
    : [];

  return {
    ...triage,
    intent,
    complexity,
    target_files: targetFiles,
  };
}

function shouldUseHighFeatureRoute(triage, budgetRoute) {
  return (
    budgetRoute === 'high' ||
    triage.complexity === 'high' ||
    triage.intent === 'feature_request'
  );
}

function estimatePromptComplexity(prompt, tokenPlan = null) {
  if (tokenPlan?.complexityHint === 'high') {
    return 'high';
  }

  const text = String(prompt || '').toLowerCase();
  if (/\b(feature|build|create|implement|end[- ]?to[- ]?end|multi[- ]?file|database|schema|api|ui|refactor|architect|workflow)\b/.test(text)) {
    return 'high';
  }
  return 'low';
}

function serializeContextSummary(summary) {
  return typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2);
}

function serializeCandidate(candidate) {
  return typeof candidate === 'string' ? candidate : JSON.stringify(candidate ?? '', null, 2);
}

function outputSize(output) {
  return serializeCandidate(output).length;
}

function sandboxStageDetails(sandboxResult = {}) {
  return {
    status: sandboxResult.success ? 'completed' : 'failed',
    success: Boolean(sandboxResult.success),
    skipped: Boolean(sandboxResult.skipped || sandboxResult.sandbox?.skipped),
    sandbox: sandboxResult.sandbox || null,
  };
}

function summarizeTokenPlan(tokenPlan) {
  return {
    complexityHint: tokenPlan.complexityHint,
    totalInputTokens: tokenPlan.totalInputTokens,
    measurements: tokenPlan.measurements,
    budgets: tokenPlan.budgets,
  };
}

function withoutText(result) {
  const { text: _text, ...rest } = result;
  return rest;
}
