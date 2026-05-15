import { TokenGovernor, callRoutedTextModel } from '../token-governor.js';

export class LeadArchitect {
  async buildParallelMatrix(featureRequest) {
    const governor = new TokenGovernor();
    const systemPrompt = "You are the Lead Architect. Break this feature into 3 non-overlapping sub-tasks (UI, API, DB). Output strict JSON. You MUST include a 'contract_schema' object defining shared types and API endpoints for the parallel workers.";
    const plannerOutput = await governor.getCompute('high', 'planner', (key, model, provider) => (
      callRoutedTextModel(key, model, systemPrompt, featureRequest, { provider, maxOutputTokens: 2048, jsonMode: true })
    ));

    try {
      return JSON.parse(plannerOutput);
    } catch {
      return {
        tasks: [
          { type: "UI", description: "UI implementation" },
          { type: "API", description: "API implementation" },
          { type: "DB", description: "DB schema changes" }
        ],
        contract_schema: {}
      };
    }
  }
}
