import { AgentOrchestrator } from '../orchestrator/index.js';

async function run() {
  process.env.SELINA_AUDIT_MODE_DEFAULT = 'full';
  
  const orchestrator = new AgentOrchestrator({
    userId: 'test-user',
    projectName: 'test-project',
  });

  console.log('Testing full audit mode...');
  try {
    await orchestrator.handlePrompt(
      'Write a Python script that adds two numbers.',
      'quick',
      async (name, args) => { console.log(`[Tool] ${name}`, args); return 'OK'; },
      (thought) => { console.log(`[Thought] ${thought}`); },
      (clarification) => {},
      (plan) => {},
      (memUpdate) => {},
      (state, msg) => { console.log(`[State] ${state}: ${msg}`); },
      (token) => {},
      null,
      { auditMode: 'full' }
    );
    console.log('Test completed.');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

run();
