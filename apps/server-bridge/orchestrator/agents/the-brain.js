import TokenGovernor from '../token-governor.js';
import { SolutionsLedger } from '../solutions-ledger.js';
import { mcpManager } from '../../mcp/MCPManager.js';
import { OrgConstraintsLoader, UserPreferencesLoader } from '../context-builder.js';
import { GithubBridge } from '../github-bridge.js';
export class TheBrain {
  constructor(ledger) {
    this.ledger = ledger || new SolutionsLedger();
  }

  async planSequentialFix(minifiedContext, taskGoal, taskId, userId = 'default', projectName = 'default', owner = 'owner', repo = 'repo') {
    const pastFailures = this.ledger.getHistory(taskId);

    // TASK 1: Wire the MCP Nervous System
    // Fetch external context BEFORE parsing AST state
    await mcpManager.refreshTools();
    const mcpTools = mcpManager.tools;

    // TASK 2: Enforce V6 Architectural Isolation
    // Fetch org_core constraints and immutably override user_env
    const orgConstraints = await OrgConstraintsLoader.load(projectName);
    const userPrefs = await UserPreferencesLoader.load(userId);

    const isolatedContext = {
      mcpTools,
      user_env: userPrefs,
      org_core: orgConstraints, // Highest priority
      filePaths: minifiedContext?.files || []
    };

    // TASK 3: Activate the Heavy-Lift Async Workflow
    // If task spans more than 5 files, dispatch to heavy-lift.yml Action
    if (isolatedContext.filePaths.length > 5) {
      console.log(`[The Brain] Massive refactor detected (${isolatedContext.filePaths.length} files). Dispatching heavy-lift workflow...`);
      const bridge = new GithubBridge(process.env.GITHUB_TOKEN);
      try {
        await bridge.dispatchHeavyLift(owner, repo, { taskId, taskGoal });
        return [{ action: 'dispatched_to_heavy_lift', status: 'async_queued' }];
      } catch (err) {
        console.error('Failed to dispatch heavy-lift workflow:', err);
      }
    }

    const governor = new TokenGovernor();
    const planner = await governor.requestModel('high', 'planner', 'NVIDIA Nemotron 70B / Gemini Pro');

    const systemPrompt = "You are The Brain. Fixing a bug. Read the Minified Context and the Ledger of Past Failures. Output a strict JSON array of 'search_and_replace' steps. Do not output full files.";

    // Placeholder for actual logic calling the model
    return [];
  }

  process(taskId, context) {
    console.log(`TheBrain processing task ${taskId} with context:`, context);
  }
}
