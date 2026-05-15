import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';
import { SolutionsLedger } from '../solutions-ledger.js';
import { mcpManager } from '../../mcp/MCPManager.js';
import OrgContextBuilder from '../../org_core/context_builder.js';
import UserContextBuilder from '../../user_env/context_builder.js';
import { githubService } from '../../github/index.js';
import { Octokit } from '@octokit/rest';

export class TheBrain {
  constructor(ledger) {
    this.ledger = ledger || new SolutionsLedger();
  }

  async planSequentialFix(minifiedContext, taskGoal, taskId, userId = null) {
    const pastFailures = await this.ledger.getHistory(taskId);
    const governor = new TokenGovernor();

    // V6 Architecture: Separate constraints and preferences

    const { getOrgConstraints, getUserPreferences } = await import('../../db.js');
    const orgConstraintsRaw = await getOrgConstraints('default');
    const userPrefsRaw = userId ? await getUserPreferences(userId) : [];

    // Conflict resolution logic: org_core constraints immutably win
    const orgRules = orgConstraintsRaw.reduce((acc, c) => ({ ...acc, [c.constraint_type]: c.content }), {});
    let userRules = userPrefsRaw.reduce((acc, p) => ({ ...acc, [p.preference_type]: p.content }), {});

    for (const key of Object.keys(orgRules)) {
      if (userRules[key]) {
        console.log(`Overriding user preference for ${key} with org constraint.`);
        delete userRules[key];
      }
    }

    const orgConstraints = orgRules;
    const userPreferences = { ...userRules, language: userRules.language || { code: 'en' } };

    // Use fallback to 'en' per Language Lock if no userId


    // Layer 2 MCP Integration
    await mcpManager.refreshTools();
    const mcpTools = mcpManager.getToolsForLLM();

    const systemPrompt = `You are The Brain. Fixing a bug. Read the Minified Context and the Ledger of Past Failures. Output a strict JSON array of 'search_and_replace' steps. Do not output full files.

=== V6 STRICT ARCHITECTURAL ISOLATION ===
ORG_CORE CONSTRAINTS (MUST OVERRIDE ALL OTHERS):
${JSON.stringify(orgConstraints, null, 2)}

USER_ENV PREFERENCES (SUBORDINATE):
${JSON.stringify(userPreferences, null, 2)}

=== MCP NERVOUS SYSTEM ===
AVAILABLE TOOLS:
${JSON.stringify(mcpTools, null, 2)}`;

    const userPrompt = `Task Goal: ${taskGoal}

Minified Context:
${minifiedContext}

Ledger of Past Failures:
${JSON.stringify(pastFailures, null, 2)}`;

    const model = await governor.requestModel('high', 'planner');
    const plannerOutput = await model(systemPrompt, userPrompt, { maxOutputTokens: 4096 });

    try {
      const parsed = JSON.parse(plannerOutput);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async process(taskId, context) {
    console.log(`TheBrain processing task ${taskId} with strict V6 isolated contexts (Org overrides User) and MCP tools.`);

    // Simple heuristic: count distinct file definitions in the context if present
    let uniqueFiles = new Set();
    if (context && typeof context === 'string') {
      const fileMatches = context.match(/file:\s*([\w.-/]+)/g);
      if (fileMatches) {
        fileMatches.forEach(match => uniqueFiles.add(match));
      }
    } else if (context && Array.isArray(context.files)) {
      context.files.forEach(f => uniqueFiles.add(f));
    }

    const fileCount = uniqueFiles.size;

    // Bypass standard queue if file count exceeds 5
    if (fileCount > 5) {
      console.log(`Massive refactor detected (${fileCount} files). Dispatching to Heavy-Lift workflow...`);
      try {
        const repoFull = process.env.GITHUB_REPOSITORY || 'default/repo';
        const [owner, repo] = repoFull.split('/');

        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: 'heavy-lift.yml',
          ref: 'main',
          inputs: { taskId: String(taskId), prompt: String(context) }
        });
        return { isHeavyLift: true, dispatched: true };
      } catch (err) {
        console.error(`Failed to dispatch heavy-lift workflow: ${err.message}`);
      }
    }

    return { isHeavyLift: false };
  }
}
