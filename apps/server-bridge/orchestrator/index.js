import { Router } from './router.js';
import { 
  CodeExpert, UIExpert, DebuggerExpert, GitExpert, ReviewerExpert, ManagerExpert, SecurityAuditorExpert,
  CreativeDirectorExpert, DesignSystemArchitect, MotionDesignerExpert, VisualAssetGenerator
} from './experts.js';
import { buildSystemPrompt } from './skill-loader.js';
import { buildSystemPromptV6 } from './context-builder.js';
import { loadMemory, appendBrainJournal } from '../memory/loader.js';
import { SharedContext } from './context.js';
import { extractSymbols } from './parser.js';
import { mcpManager } from '../mcp/MCPManager.js';
import { repoManager } from './repository_manager.js';
import { RolloutRecorder } from './rollout_recorder.js';
import { createChildRunIdentity, createRootRunIdentity, withRunExpert } from './run_identity.js';
import { resolveExpertProfile } from './expert-routing.js';
import { persistRun, persistRunStatus } from './run_store.js';
import { modelService } from './models.js';


/**
 * AgentOrchestrator — Brain v5.0 (Task Queue Edition)
 */
export class AgentOrchestrator {
  constructor() {
    this.router = new Router();
    this.context = new SharedContext();
    
    this.experts = {
      code: new CodeExpert(this.context),
      ui: new UIExpert(this.context),
      debug: new DebuggerExpert(this.context),
      git: new GitExpert(this.context),
      reviewer: new ReviewerExpert(this.context),
      manager: new ManagerExpert(this.context),
      security: new SecurityAuditorExpert(this.context),
      creative: new CreativeDirectorExpert(this.context),
      architect: new DesignSystemArchitect(this.context),
      motion: new MotionDesignerExpert(this.context),
      artist: new VisualAssetGenerator(this.context),
    };
    
    this.projectTree = null;
    this.packageJson = null;
    this.userId = null;
    this.projectName = 'default';
  }

  setUser(userId) {
    this.userId = userId;
  }

  /**
   * Flush conversation history between tasks to conserve tokens.
   *
   * WHAT IS FLUSHED:
   *   - context.history (the full multi-turn conversation)
   *   - context.sessionState (goals, completed steps, decisions)
   *
   * WHAT IS PRESERVED:
   *   - context.astCache (symbol index from Sprint 3 — expensive to rebuild)
   *   - context.fileCache (recently read file snippets)
   *   - this.projectTree (directory listing)
   *   - this.packageJson (stack detection)
   *
   * This ensures the next task starts token-light but project-aware.
   */
  flushContext() {
    const preserved = {
      astCache:  this.context.astCache,
      fileCache: this.context.fileCache,
    };

    // Replace context with a fresh instance, then restore the caches.
    this.context = new SharedContext();
    this.context.astCache  = preserved.astCache;
    this.context.fileCache = preserved.fileCache;

    // Re-wire all experts to the new context instance.
    for (const expert of Object.values(this.experts)) {
      expert.context = this.context;
    }
  }

  /**
   * Pre-iteration scan: Understand the project before acting.
   */
  async preScan(onToolCall) {
    try {
      this.projectTree = await onToolCall('list_files', { path: '.' });
      
      const sourceFiles = (this.projectTree.match(/[a-zA-Z0-9_\-\/]+\.(js|jsx|ts|tsx)/g) || [])
        .filter(f => !f.includes('node_modules') && !f.includes('.next') && !f.includes('dist'))
        .slice(0, 50);

      for (const filePath of sourceFiles) {
        try {
          const content = await onToolCall('read_file', { path: filePath, end_line: 500 });
          const symbols = extractSymbols(content);
          this.context.astCache.set(filePath, symbols);
        } catch (err) {
          // Failed to index file
        }
      }

      try {
        const pkgRaw = await onToolCall('read_file', { path: './package.json' });
        this.packageJson = JSON.parse(pkgRaw);
        this.projectName = this.packageJson.name || 'default';
      } catch {
        this.packageJson = null;
      }

      try {
        const userMemoryContent = await onToolCall('read_file', { path: './memory.md' });
        if (userMemoryContent && this.userId) {
          const { saveUserMemory } = await import('../memory/loader.js');
          await saveUserMemory(this.userId, this.projectName, userMemoryContent);
        }
      } catch { /* ignore */ }
    } catch (err) {
      // Pre-scan partial failure
    }
  }

  /**
   * Handle user prompt with ReAct loop and Peer Review (Debate).
   */
  async handlePrompt(prompt, effortLevel, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, runContext = null) {
    if (!this.projectTree) {
      if (emitState) emitState('reading', 'Scanning project architecture...');
      await this.preScan(onToolCall);
    }

    const runIdentity = runContext || createRootRunIdentity({ expert: 'manager' });
    await persistRun(runIdentity, {
      userId: this.userId || 'anonymous',
      projectName: this.projectName,
      prompt,
      status: 'running',
      metadata: { effortLevel },
    });

    // Performance Heartbeat (Gap #12)
    const startTime = Date.now();
    const heartbeat = setInterval(() => {
      const memory = process.memoryUsage();
      const metrics = {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        contextTurns: this.context.history.length,
        duration: Math.round((Date.now() - startTime) / 1000),
      };
      if (emitState) emitState('heartbeat', metrics);
    }, 15000);

    let rollout = null;
    const recordRollout = async (type, payload = {}) => {
      if (!rollout) return;
      try {
        await rollout.record(type, payload);
      } catch {
        // Rollout recording must never block the user-facing agent loop.
      }
    };
    const withRollout = async (operation) => {
      if (!rollout) return;
      try {
        await operation(rollout);
      } catch {
        // Markdown status/plan writes are best-effort durability aids.
      }
    };

    try {
      rollout = await RolloutRecorder.create({
        runId: runIdentity.runId,
        sessionId: runIdentity.rootRunId,
        parentRolloutId: runIdentity.parentRunId,
        userId: this.userId || 'anonymous',
        projectName: this.projectName,
        prompt,
        effortLevel,
      });
      await persistRunStatus(runIdentity, 'running', { rolloutPaths: rollout.getPaths() });
      if (emitState) emitState('planning', `Recording durable run state at ${rollout.getPaths().directory}`);
    } catch (error) {
      if (emitState) emitState('warning', `Durable rollout recorder unavailable: ${error.message}`);
    }

    // Enhanced Tool Wrapper (MCP Support)
    const enhancedToolCall = async (name, args) => {
      await recordRollout('tool_call_started', { name, args });
      try {
        const result = await onToolCall(name, args);
        await recordRollout('tool_call_finished', { name, result });
        if (['edit_file', 'replace_file_content', 'multi_replace_file_content', 'create_file'].includes(name)) {
          await recordRollout('edit_applied', { name, result });
        }
        if (['run_command', 'security_sandbox'].includes(name)) {
          await recordRollout('sandbox_exec', { name, result });
        }
        return result;
      } catch (error) {
        await recordRollout('tool_call_failed', { name, error: error.message });
        throw error;
      }
    };

    try {
      if (emitState) emitState('thinking', 'Identifying target expertise...');
      const { domain, skillProfile, swarm } = await this.router.route(prompt);
      const routedProfile = resolveExpertProfile({
        domain,
        effortLevel,
        modelService,
      });
      Object.assign(runIdentity, withRunExpert(runIdentity, routedProfile));
      await persistRun(runIdentity, {
        userId: this.userId || 'anonymous',
        projectName: this.projectName,
        prompt,
        status: 'running',
        metadata: { effortLevel, routeDomain: domain, swarm: swarm?.map(item => item.domain) || [] },
      });
      this.context.sessionState.skillProfile = skillProfile;
      await recordRollout('route_selected', {
        domain,
        provider: routedProfile.provider,
        model: routedProfile.model,
        swarm: swarm?.map(item => item.domain) || [],
        skillProfile,
      });
      await withRollout(recorder => recorder.writePlan([
        `Route request to ${domain} expertise${swarm?.length > 1 ? ` with swarm domains ${swarm.map(item => item.domain).join(', ')}` : ''}.`,
        'Build the system prompt from org constraints, user preferences, project context, memory, and tools.',
        'Run the expert loop with peer review when effort level requires it.',
        'Verify with the project build command and repair failures before completion.',
        'Persist rollout events, implementation notes, and final status.',
      ]));
      
      const useV6Context = process.env.USE_V6_CONTEXT === 'true';
      
      const runExpertLoop = async (targetDomain) => {
        const expert = this.experts[targetDomain] || this.experts.code;
        const expertProfile = resolveExpertProfile({
          domain: targetDomain,
          effortLevel,
          modelService,
        });
        const expertRunIdentity = targetDomain === domain
          ? withRunExpert(runIdentity, expertProfile)
          : createChildRunIdentity(runIdentity, expertProfile);
        const previousProviderOverride = expert.providerOverride;
        expert.providerOverride = expertProfile.provider;
        expert.effortLevel = effortLevel;
        if (emitState) emitState('thinking', `Projecting expertise to the ${targetDomain}Expert...`);
        await persistRun(expertRunIdentity, {
          userId: this.userId || 'anonymous',
          projectName: this.projectName,
          prompt,
          status: 'running',
          metadata: { effortLevel, targetDomain },
        });
        await recordRollout('expert_loop_started', { targetDomain, effortLevel, expertProfile });
        try {

      let userMemory = null;
      let brainJournal = [];
      if (this.userId) {
        try {
          const memory = await loadMemory(this.userId, this.projectName, prompt);
          userMemory = memory.userMemory;
          brainJournal = memory.brainJournal;
        } catch {}
      }

      let systemPrompt;
      
      if (useV6Context) {
        systemPrompt = await buildSystemPromptV6({
          projectName: this.projectName,
          userId: this.userId,
          domain: targetDomain,
          projectTree: this.projectTree,
          packageJson: this.packageJson,
          userMemory,
          brainJournal,
          skillProfile,
          mcpTools: mcpManager.getToolsForLLM(),
          linkedProjects: Array.from(repoManager.indexes.entries()).map(([key, graph]) => {
            const [uid, name] = key.split(':');
            return { name, type: 'repo', indexedSymbols: Object.keys(graph).length, path: `/data/repos/${uid}/${name}` };
          })
        });
      } else {
        systemPrompt = buildSystemPrompt({
          domain: targetDomain,
          projectTree: this.projectTree,
          packageJson: this.packageJson,
          userMemory,
          brainJournal,
          effortLevel,
          skillProfile,
        });
      }

      const rolloutPaths = rollout?.getPaths();
      if (rolloutPaths) {
        systemPrompt += `\n\n=== DURABLE ROLLOUT STATE ===\nUse these local artifacts as the persistent source of truth for this run:\n- Plan: ${rolloutPaths.plan}\n- Implementation log: ${rolloutPaths.implementation}\n- Status: ${rolloutPaths.status}\n- Event stream: ${rolloutPaths.events}\n`;
      }

      const onMemoryUpdateInternal = async (entry) => {
        if (this.userId) await appendBrainJournal(this.userId, this.projectName, entry);
      };

      const itersMap = { quick: 1, standard: 3, deep: 5 };
      const maxIters = itersMap[effortLevel] || 3;
      let currentIter = 0;
      let lastError = null;
      let finalResult = null;

      while (currentIter < maxIters) {
        currentIter++;
        await recordRollout('iteration_started', { targetDomain, iteration: currentIter, maxIters });
        if (lastError) {
          await recordRollout('retry', { targetDomain, iteration: currentIter, error: lastError });
        }
        const iterPrompt = lastError
          ? `The previous iteration failed. Critique/Error:\n${lastError}`
          : prompt;

        finalResult = await expert.execute(
          iterPrompt,
          systemPrompt,
          enhancedToolCall,
          onThought,
          onClarification,
          onPlan,
          onMemoryUpdateInternal,
          emitState,
          onStream,
          mcpManager.getToolsForLLM()
        );
        await recordRollout('iteration_completed', {
          targetDomain,
          iteration: currentIter,
          toolCalls: finalResult?.toolCalls?.map(call => call.name || call.tool || call) || [],
          contentPreview: finalResult?.content || '',
        });

        if (effortLevel === 'quick') break;

        // Debate Phase (Peer Review)
        const hasExecutedTools = finalResult.toolCalls && finalResult.toolCalls.length > 0;
        if (hasExecutedTools && (effortLevel === 'standard' || effortLevel === 'deep')) {
          if (emitState) emitState('debating', 'Peer review in progress...');
          
          const reviewPrompt = `PRIME PROMPT: ${prompt}\nACTIONS: ${JSON.stringify(finalResult.toolCalls)}\nTHOUGHTS: ${finalResult.thoughts}\nAudit these actions. If logic flaws exist, return REVIEW_FAILED. If perfect, return REVIEW_PASSED.`;
          this.experts.reviewer.effortLevel = effortLevel;
          const reviewResult = await this.experts.reviewer.execute(reviewPrompt, "Pedantic Auditor", async () => {}, (t) => onThought(`[Reviewer] ${t}`), () => {}, () => {}, onMemoryUpdateInternal, emitState, onStream);
          await recordRollout('peer_review_completed', {
            targetDomain,
            iteration: currentIter,
            result: reviewResult.content,
          });

          if (reviewResult.content.includes('REVIEW_FAILED')) {
            lastError = reviewResult.content;
            if (emitState) emitState('debugging', 'Review failed. Self-correcting...');
            await recordRollout('peer_review_failed', { targetDomain, iteration: currentIter, lastError });
            continue;
          }
        }

        // Verification Phase
        if (emitState) emitState('verifying', 'Validating build integrity...');
        try {
          const buildResultRaw = await onToolCall('run_command', { command: 'npm', args: ['run', 'build'] });
          const buildResult = typeof buildResultRaw === 'string' ? JSON.parse(buildResultRaw) : buildResultRaw;
          await recordRollout('verification_completed', {
            targetDomain,
            iteration: currentIter,
            exitCode: buildResult.exitCode,
            stdout: buildResult.stdout,
            stderr: buildResult.stderr,
          });
          await recordRollout('sandbox_exec', {
            name: 'run_command',
            targetDomain,
            iteration: currentIter,
            exitCode: buildResult.exitCode,
          });
          if (buildResult.exitCode === 0) break;
          lastError = (buildResult.stdout || buildResult.stderr || 'Build failed').slice(-500);
        } catch (err) {
          lastError = err.message;
          await recordRollout('verification_failed', { targetDomain, iteration: currentIter, error: err.message });
        }
      }
        await persistRunStatus(expertRunIdentity, 'completed', {
          toolCalls: finalResult?.toolCalls?.length || 0,
        });
        return finalResult;
        } catch (error) {
          await persistRunStatus(expertRunIdentity, 'failed', { error: error.message });
          throw error;
        } finally {
          expert.providerOverride = previousProviderOverride;
        }
    };

    let finalResult;
    if (swarm && swarm.length > 1) {
      if (emitState) emitState('thinking', `Initiating Swarm Orchestration across domains: ${swarm.map(c => c.domain).join(', ')}...`);
      const results = await Promise.all(swarm.map(c => runExpertLoop(c.domain)));
      
      if (emitState) emitState('debating', 'Merging Swarm results...');
      finalResult = {
         content: results.map((r, i) => `=== ${swarm[i].domain} ===\n${r?.content || ''}`).join('\n\n'),
         toolCalls: results.flatMap(r => r?.toolCalls || []),
         thoughts: results.map((r, i) => `[${swarm[i].domain}] ${r?.thoughts || ''}`).join('\n')
      };
    } else {
      finalResult = await runExpertLoop(domain);
    }

    try { this.projectTree = await onToolCall('list_files', { path: '.' }); } catch {}
      await recordRollout('rollout_completed', {
        domain,
        toolCalls: finalResult?.toolCalls?.length || 0,
        durationMs: Date.now() - startTime,
      });
      await recordRollout('success', {
        domain,
        durationMs: Date.now() - startTime,
      });
      await withRollout(recorder => recorder.appendImplementation(finalResult?.content || 'Agent loop completed.', {
        domain,
        toolCalls: finalResult?.toolCalls?.length || 0,
      }));
      await withRollout(recorder => recorder.updateStatus('completed', `Completed in ${Math.round((Date.now() - startTime) / 1000)} seconds.`));
      await persistRunStatus(runIdentity, 'completed', {
        durationMs: Date.now() - startTime,
        toolCalls: finalResult?.toolCalls?.length || 0,
      });
      return finalResult;

    } catch (error) {
      await recordRollout('rollout_failed', {
        error: error.message,
        durationMs: Date.now() - startTime,
      });
      await withRollout(recorder => recorder.updateStatus('failed', error.message));
      await persistRunStatus(runIdentity, 'failed', {
        durationMs: Date.now() - startTime,
        error: error.message,
      });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }
}
