import { Router } from './router.js';
import { 
  CodeExpert, UIExpert, DebuggerExpert, GitExpert, ReviewerExpert, ManagerExpert, SecurityAuditorExpert,
  CreativeDirectorExpert, DesignSystemArchitect, MotionDesignerExpert, VisualAssetGenerator
} from './experts.js';
import { buildSystemPrompt } from './skill-loader.js';
import { loadMemory, appendBrainJournal } from '../memory/loader.js';
import { SharedContext } from './context.js';
import { extractSymbols } from './parser.js';

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

    console.log(
      `[Orchestrator] Context flushed. ` +
      `AST cache preserved (${preserved.astCache.size} files).`
    );
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

      console.log(`[Orchestrator] Indexing symbols for ${sourceFiles.length} files...`);
      
      for (const filePath of sourceFiles) {
        try {
          const content = await onToolCall('read_file', { path: filePath, end_line: 500 });
          const symbols = extractSymbols(content);
          this.context.astCache.set(filePath, symbols);
        } catch (err) {
          console.warn(`[Orchestrator] Failed to index ${filePath}:`, err.message);
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
      console.warn('[Orchestrator] Pre-scan partial failure:', err.message);
    }
  }

  /**
   * Handle user prompt with ReAct loop and Peer Review (Debate).
   */
  async handlePrompt(prompt, effortLevel, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream) {
    if (!this.projectTree) {
      if (emitState) emitState('reading', 'Scanning project architecture...');
      await this.preScan(onToolCall);
    }

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

    try {
      if (emitState) emitState('thinking', 'Identifying target expertise...');
      const { domain } = await this.router.route(prompt);
      const expert = this.experts[domain] || this.experts.code;
      
      if (emitState) emitState('thinking', `Projecting expertise to the ${domain}Expert...`);

      let userMemory = null;
      let brainJournal = [];
      if (this.userId) {
        try {
          const memory = await loadMemory(this.userId, this.projectName, prompt);
          userMemory = memory.userMemory;
          brainJournal = memory.brainJournal;
        } catch {}
      }

      const systemPrompt = buildSystemPrompt({
        domain,
        projectTree: this.projectTree,
        packageJson: this.packageJson,
        userMemory,
        brainJournal,
        effortLevel,
      });

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
        const iterPrompt = lastError
          ? `The previous iteration failed. Critique/Error:\n${lastError}`
          : prompt;

        finalResult = await expert.execute(
          iterPrompt,
          systemPrompt,
          onToolCall,
          onThought,
          onClarification,
          onPlan,
          onMemoryUpdateInternal,
          emitState,
          onStream
        );

        if (effortLevel === 'quick') break;

        // Debate Phase (Peer Review)
        const hasExecutedTools = finalResult.toolCalls && finalResult.toolCalls.length > 0;
        if (hasExecutedTools && (effortLevel === 'standard' || effortLevel === 'deep')) {
          if (emitState) emitState('debating', 'Peer review in progress...');
          
          const reviewPrompt = `PRIME PROMPT: ${prompt}\nACTIONS: ${JSON.stringify(finalResult.toolCalls)}\nTHOUGHTS: ${finalResult.thoughts}\nAudit these actions. If logic flaws exist, return REVIEW_FAILED. If perfect, return REVIEW_PASSED.`;
          const reviewResult = await this.experts.reviewer.execute(reviewPrompt, "Pedantic Auditor", async () => {}, (t) => onThought(`[Reviewer] ${t}`), () => {}, () => {}, onMemoryUpdateInternal, emitState, onStream);

          if (reviewResult.content.includes('REVIEW_FAILED')) {
            lastError = reviewResult.content;
            if (emitState) emitState('debugging', 'Review failed. Self-correcting...');
            continue;
          }
        }

        // Verification Phase
        if (emitState) emitState('verifying', 'Validating build integrity...');
        try {
          const buildResultRaw = await onToolCall('run_command', { command: 'npm', args: ['run', 'build'] });
          const buildResult = typeof buildResultRaw === 'string' ? JSON.parse(buildResultRaw) : buildResultRaw;
          if (buildResult.exitCode === 0) break;
          lastError = (buildResult.stdout || buildResult.stderr || 'Build failed').slice(-500);
        } catch (err) {
          lastError = err.message;
        }
      }

      try { this.projectTree = await onToolCall('list_files', { path: '.' }); } catch {}
      return finalResult;

    } finally {
      clearInterval(heartbeat);
    }
  }
}
