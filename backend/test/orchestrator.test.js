import { describe, it, expect, vi } from 'vitest';
import { AgentOrchestrator } from '../orchestrator/index.js';

describe('AgentOrchestrator', () => {
  it('should instantiate with all experts', () => {
    const orchestrator = new AgentOrchestrator();
    expect(orchestrator.experts).toHaveProperty('code');
    expect(orchestrator.experts).toHaveProperty('ui');
    expect(orchestrator.experts).toHaveProperty('reviewer');
  });

  it('should correctly initialize project context in constructor', () => {
    const orchestrator = new AgentOrchestrator();
    expect(orchestrator.context).toBeDefined();
    expect(Array.isArray(orchestrator.context.history)).toBe(true);
    expect(orchestrator.brainSystem).toBeDefined();
    expect(typeof orchestrator.handleBrainSystemPrompt).toBe('function');
  });
});
