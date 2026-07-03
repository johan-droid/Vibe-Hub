import { describe, it, expect } from 'vitest';
import { SharedContext } from '../orchestrator/context.js';

describe('SharedContext Gemini Slice Fix', () => {
  it('should ensure history starts with user role when truncated', () => {
    const context = new SharedContext();

    // Fill with 21 messages.
    // If we just slice(-10), it might start with 'model'.
    // We want it to start with 'user'.
    for (let i = 0; i < 10; i++) {
      context.addMessage('user', `User message ${i}`);
      context.addMessage('model', `Model message ${i}`);
    }
    // Length is 20 now. Add one more.
    context.addMessage('user', 'Final user message');

    // Total length should be truncated.
    // slice(-10) of 21 messages would be index 11 to 20.
    // history[11] would be 'model' (message 5).
    // Our fix should find index 12 which is 'user' (message 6).

    expect(context.history.length).toBeLessThanOrEqual(10);
    expect(context.history[0].role).toBe('user');
  });

  it('should handle cases where naive slice contains no user message', () => {
    const context = new SharedContext();

    // Add 15 user messages, then 10 model messages.
    // Total 25. slice(-10) would be only model messages.
    for (let i = 0; i < 15; i++) {
      context.history.push({ role: 'user', parts: [{ text: `User ${i}` }] });
    }
    for (let i = 0; i < 5; i++) {
      context.history.push({ role: 'model', parts: [{ text: `Model ${i}` }] });
    }

    // Now trigger addMessage which triggers truncation.
    context.addMessage('model', 'Trigger message');

    expect(context.history.length).toBeGreaterThan(0);
    expect(context.history[0].role).toBe('user');
  });

  it('should not truncate if history is short', () => {
    const context = new SharedContext();
    context.addMessage('user', 'Hello');
    context.addMessage('model', 'Hi');

    expect(context.history.length).toBe(2);
    expect(context.history[0].role).toBe('user');
  });
});
