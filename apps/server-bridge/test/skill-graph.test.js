import { describe, it, expect } from 'vitest';
import { buildSkillBridgePrompt, listSkillGraph, selectSkillProfile } from '../orchestrator/skill-graph.js';
import { buildSystemPrompt } from '../orchestrator/skill-loader.js';
import { Router } from '../orchestrator/router.js';

describe('CS skill graph switcher', () => {
  it('selects AI/ML, backend, security, and observability for agent hardening prompts', () => {
    const profile = selectSkillProfile('Build an MOE agent with token efficient model routing, backend auth hardening, audit logs, and diagnostics');
    const ids = profile.selectedSkills.map(skill => skill.id);

    expect(ids).toContain('ai_ml');
    expect(ids.some(id => ['backend_engineering', 'security_engineering', 'observability'].includes(id))).toBe(true);
    expect(profile.domain).toMatch(/code|security|debug/);
  });

  it('creates bridge prompt with selected neurons and switching protocol', () => {
    const profile = selectSkillProfile('Optimize React dashboard bundle performance and accessibility');
    const prompt = buildSkillBridgePrompt(profile);

    expect(prompt).toContain('Skill Switcher Bridge');
    expect(prompt).toContain('Selected CS Skill Neurons');
    expect(prompt).toContain('Switching Protocol');
    expect(prompt).toMatch(/Frontend Engineering|Performance Engineering|Accessibility/);
  });

  it('lists a broad computer-science skill graph', () => {
    const graph = listSkillGraph();
    expect(graph.length).toBeGreaterThanOrEqual(20);
    expect(graph.map(node => node.id)).toContain('distributed_systems');
    expect(graph.map(node => node.id)).toContain('programming_languages');
    expect(graph.map(node => node.id)).toContain('privacy_compliance');
  });

  it('injects the bridge into system prompts under standard budget', () => {
    const profile = selectSkillProfile('Design a secure distributed API with database migrations and monitoring');
    const systemPrompt = buildSystemPrompt({ domain: profile.domain, effortLevel: 'standard', skillProfile: profile });

    expect(systemPrompt).toContain('Skill Switcher Bridge');
    expect(systemPrompt).toContain('Selected CS Skill Neurons');
  });

  it('router returns skill profile metadata for MOE handoff', async () => {
    const router = new Router();
    const result = await router.route('Fix websocket debugging, runtime logs, and retry observability');

    expect(result.skillProfile).toBeDefined();
    expect(result.skillProfile.selectedSkills.length).toBeGreaterThan(0);
    expect(result.domain).toBe(result.skillProfile.domain);
  });
});
