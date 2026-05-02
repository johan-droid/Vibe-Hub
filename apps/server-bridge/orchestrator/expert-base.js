import { GoogleGenerativeAI } from '@google/generative-ai';
import { AGENT_TOOLS } from './tools.js';

// ─── SDK Singleton ─────────────────────────────────────────────────────────────
// BUG #1 FIX: Creating `new GoogleGenerativeAI()` inside execute() spawns a new
// undici HTTP connection pool on every tool iteration. A 25-iteration deep task
// across 3 concurrent sessions = 75 open pools. We use a module-level singleton
// so the entire process shares a single pool.
let _geminiClient = null;
function getGeminiClient() {
  if (!_geminiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('[Agent] GEMINI_API_KEY is not set. Cannot initialise Gemini SDK.');
    }
    _geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _geminiClient;
}

/**
 * EmployeeBase — Server-Side Expert (Brain v3.1)
 *
 * Key improvements over v3.0:
 * - SDK client is a module-level singleton (no HTTP pool leak per iteration)
 * - summarizeHistory() is guarded by an instance-level lock (no concurrent double-summarize)
 * - execute() returns { content, toolCalls } so orchestrator debate/review phase works correctly
 */
export class EmployeeBase {
  constructor(modelName = 'gemini-2.0-flash', sharedContext = null) {
    this.modelName      = modelName;
    this.sharedContext  = sharedContext;
    this.history        = sharedContext ? sharedContext.history : [];
    this.historyLimit   = 12;
    this.domainInstruction = ''; // Set by subclass

    // BUG #2 FIX: Summarization lock prevents concurrent sub-agents (e.g. from
    // delegate_task) from both entering summarizeHistory() simultaneously and
    // overwriting each other's compressed snapshot.
    this._summarizing = false;
  }

  /**
   * Execute the full ReAct loop.
   *
   * @returns {{ content: string, toolCalls: Array }}
   *   BUG #3 FIX: Previously returned a plain string. orchestrator/index.js reads
   *   `finalResult.toolCalls` to decide whether to run the peer-review phase.
   *   A string return means `.toolCalls` is always undefined → debate phase is
   *   always skipped → the reviewer expert is never consulted.
   */
  async execute(prompt, systemPrompt, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    // Neural Context Management
    if (this.history.length > this.historyLimit * 2 && !this._summarizing) {
      this._summarizing = true;
      if (emitState) emitState('thinking', 'Compressing neural context...');
      try {
        await this.summarizeHistory(systemPrompt);
      } finally {
        this._summarizing = false;
      }
    }

    const fullSystemPrompt = systemPrompt + '\n\n---\n\n' + this.domainInstruction;

    // Use the module-level singleton — not a new instance per call
    const model = getGeminiClient().getGenerativeModel({
      model: this.modelName,
      tools: [{ functionDeclarations: AGENT_TOOLS }],
      systemInstruction: fullSystemPrompt,
    });

    const chat = model.startChat({ history: this.history });

    // Neural Phase: Initial Thought
    if (emitState) emitState('thinking', 'Reasoning about prompt...');
    let result   = await chat.sendMessage(prompt);
    let response = result.response;

    const maxIterations = 25;
    let iteration = 0;

    // BUG #3 FIX: Track all tool calls made across iterations so the caller
    // (orchestrator) can inspect them for the peer-review phase.
    const allToolCalls = [];
    let calls = []; // calls from the most recent iteration

    while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iteration < maxIterations) {
      iteration++;

      calls = response.candidates[0].content.parts
        .filter(p => p.functionCall)
        .map(p => p.functionCall);

      allToolCalls.push(...calls);

      const toolResponses = [];

      for (const call of calls) {
        // Map tool calls to logical UI states
        if (call.name === 'read_file' || call.name === 'list_files') {
          if (emitState) emitState('reading', `Analyzing ${call.args.path || 'project structure'}...`);
        } else if (['edit_file', 'write_file', 'create_file'].includes(call.name)) {
          if (emitState) emitState('writing', `Surgically editing ${call.args.path || 'file'}...`);
        } else if (call.name === 'run_command') {
          if (emitState) emitState('debugging', `Executing ${call.args.command || 'terminal command'}...`);
        } else if (call.name === 'search_symbols') {
          if (emitState) emitState('reading', `Searching for symbol "${call.args.query}"...`);
        }

        console.log(`[${this.constructor.name}] Tool: ${call.name}`, JSON.stringify(call.args).slice(0, 200));

        let observation;

        switch (call.name) {
          case 'ask_clarification': {
            if (emitState) emitState('thinking', 'Clarification required.');
            observation = await onClarification(call.args.questions, call.args.context);
            break;
          }
          case 'create_plan': {
            if (emitState) emitState('thinking', 'Drafting execution plan...');
            const approved = await onPlan(call.args.steps, call.args.risks);
            observation = approved
              ? 'Plan approved by user. Proceed with execution.'
              : 'Plan rejected by user. Ask what they would like changed.';
            break;
          }
          case 'update_memory': {
            await onMemoryUpdate(call.args);
            observation = 'Memory entry saved successfully.';
            break;
          }
          default: {
            observation = await onToolCall(call.name, call.args);
          }
        }

        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: observation },
          },
        });
      }

      // Thinking Phase: Process observations
      if (emitState) emitState('thinking', 'Processing observations...');
      result   = await chat.sendMessage(toolResponses);
      response = result.response;
    }

    const finalText = response.text();

    this.history.push({ role: 'user',  parts: [{ text: prompt }] });
    this.history.push({ role: 'model', parts: [{ text: finalText }] });

    if (this.sharedContext) {
      this.sharedContext.history = this.history;
    }

    // BUG #3 FIX: Return structured object so orchestrator.index.js can check
    // finalResult.toolCalls.length > 0 for the debate/peer-review gate.
    return {
      content:   finalText,
      toolCalls: allToolCalls,
    };
  }

  /**
   * Summarize history to stay within token limits while preserving state.
   * Protected by this._summarizing lock (set by caller before invoking).
   */
  async summarizeHistory(systemPrompt) {
    // Use the module-level singleton for the summarizer call as well
    const summarizer = getGeminiClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

    const messagesToSummarize = this.history.slice(0, -4); // Keep last 2 turns intact
    const summaryPrompt = `
      You are a context manager for a coding agent.
      Summarize the following conversation history into a concise "Neural Context Snapshot".
      Preserve:
      - Decisions made by the user.
      - Learnings about the codebase.
      - Progress on current tasks.
      - Pending actions.
      
      HISTORY:
      ${JSON.stringify(messagesToSummarize)}
    `;

    const result   = await summarizer.generateContent(summaryPrompt);
    const snapshot = result.response.text();

    this.history = [
      { role: 'user',  parts: [{ text: `Neural Context Snapshot:\n${snapshot}` }] },
      { role: 'model', parts: [{ text: 'Acknowledged. I have absorbed the context snapshot and am ready to continue.' }] },
      ...this.history.slice(-4),
    ];
    console.log('[Orchestrator] History summarized into context snapshot.');
  }
}
