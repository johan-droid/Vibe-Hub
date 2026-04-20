import { Router } from './router.js';
import { CodeExpert, UIExpert, DebuggerExpert, GitExpert } from './experts.js';
import { buildSystemPrompt } from './skill-loader.js';
import { loadMemory, appendBrainJournal } from '../memory/loader.js';

/**
 * AgentOrchestrator — Brain v3.0
 * 
 * Key improvements:
 * - Pre-iteration project scan (reads tree + package.json for context)
 * - Skills + memory injected into system prompt before every iteration
 * - Clarification and planning tools handled server-side
 * - Memory writing after significant tasks
 */
export class AgentOrchestrator {
  constructor() {
    this.router = new Router();
    this.experts = {
      code: new CodeExpert(),
      ui: new UIExpert(),
      debug: new DebuggerExpert(),
      git: new GitExpert(),
    };
    
    // Project context (populated by pre-scan)
    this.projectTree = null;
    this.packageJson = null;
    this.userId = null;
    this.projectName = 'default';
  }

  setUser(userId) {
    this.userId = userId;
  }

  /**
   * Pre-iteration scan: Understand the project before acting.
   */
  async preScan(onToolCall) {
    try {
      // Get project tree
      this.projectTree = await onToolCall('list_files', { path: '.' });
      
      // Try to read package.json for stack detection
      try {
        const pkgRaw = await onToolCall('read_file', { path: './package.json' });
        this.packageJson = JSON.parse(pkgRaw);
        this.projectName = this.packageJson.name || 'default';
      } catch {
        this.packageJson = null;
      }

      // Try to read user's memory.md if it exists
      try {
        const userMemoryContent = await onToolCall('read_file', { path: './memory.md' });
        if (userMemoryContent && this.userId) {
          // Cache it in DB for cross-session access
          const { saveUserMemory } = await import('../memory/loader.js');
          await saveUserMemory(this.userId, this.projectName, userMemoryContent);
        }
      } catch {
        // No memory.md in project — that's fine
      }
    } catch (err) {
      console.warn('[Orchestrator] Pre-scan partial failure:', err.message);
    }
  }

  /**
   * Handle a user prompt through the Brain v3 pipeline:
   * 1. Pre-scan project (if not done)
   * 2. Load skills + memory
   * 3. Route to expert
   * 4. Execute with full ReAct loop
   * 5. Recurrent integrity verification
   */
  async handlePrompt(prompt, effortLevel, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    // 1. Pre-scan project
    if (!this.projectTree) {
      if (emitState) emitState('reading', 'Scanning project architecture...');
      await this.preScan(onToolCall);
    }

    // 2. Route to expert
    if (emitState) emitState('thinking', 'Identifying target expertise...');
    const domain = await this.router.route(prompt);
    const expert = this.experts[domain] || this.experts.code;

    // 3. Load memory from DB
    let userMemory = null;
    let brainJournal = [];
    if (this.userId) {
      if (emitState) emitState('reading', 'Retrieving project neural memory...');
      try {
        const memory = await loadMemory(this.userId, this.projectName);
        userMemory = memory.userMemory;
        brainJournal = memory.brainJournal;
      } catch {}
    }

    // 4. Build system prompt from skills + memory
    const systemPrompt = buildSystemPrompt({
      domain,
      projectTree: this.projectTree,
      packageJson: this.packageJson,
      userMemory,
      brainJournal,
      effortLevel,
    });

    // 5. Memory update callback
    const onMemoryUpdateInternal = async (entry) => {
      if (this.userId) {
        await appendBrainJournal(this.userId, this.projectName, entry);
      }
    };

    // 6. Neural Loop (Self-Correction)
    const itersMap = { quick: 1, standard: 3, deep: 5 };
    const maxIters = itersMap[effortLevel] || 3;
    let currentIter = 0;
    let lastError = null;
    let finalResult = null;

    while (currentIter < maxIters) {
      currentIter++;

      const iterPrompt = lastError
        ? `The previous build failed. Please analyze the error and fix it:\n${lastError}`
        : prompt;

      finalResult = await expert.execute(
        iterPrompt,
        systemPrompt,
        onToolCall,
        onThought,
        onClarification,
        onPlan,
        onMemoryUpdateInternal,
        emitState
      );

      if (effortLevel === 'quick') break;

      // 7. Verification Phase
      if (emitState) emitState('verifying', 'Validating build integrity...');
      try {
        const buildResult = await onToolCall('run_command', { command: 'npm', args: ['run', 'build'] });
        const exitCode = typeof buildResult === 'object' ? buildResult.exitCode : 1;

        if (exitCode === 0) {
          if (emitState) emitState('idle', 'Task completed successfully.');
          break;
        } else {
          lastError = (buildResult.output || '').slice(-800);
          if (emitState) emitState('debugging', 'Build failure detected. Self-correcting...');
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    // Refresh tree
    try {
      this.projectTree = await onToolCall('list_files', { path: '.' });
    } catch {}

    return finalResult;
  }

    // Refresh project tree after changes
    try {
      this.projectTree = await onToolCall('list_files', { path: '.' });
    } catch {}

    return finalResult;
  }
}
