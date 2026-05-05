import { AGENT_TOOLS } from './tools.js';
import { modelService } from './models.js';

function textFromHistoryPart(turn) {
  return (turn.parts || []).map(part => part.text || '').join('\n');
}

function stringifyObservation(observation) {
  if (typeof observation === 'string') return observation;
  try { return JSON.stringify(observation); } catch { return String(observation); }
}

/**
 * EmployeeBase — provider-aware server-side expert runtime.
 *
 * The runtime keeps Gemini's native tool loop as the default, while allowing
 * OpenAI-compatible, Qwen-compatible, and Anthropic providers to run the same
 * ReAct/tool loop when configured through environment variables.
 */
export class EmployeeBase {
  constructor(modelName = 'gemini-2.0-flash', sharedContext = null) {
    this.modelName = modelName;
    this.sharedContext = sharedContext;
    this.history = sharedContext ? sharedContext.history : [];
    this.historyLimit = 12;
    this.domainInstruction = '';
    this.effortLevel = 'standard';
    this._summarizing = false;
  }

  async execute(prompt, systemPrompt, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools = []) {
    if (this.history.length > this.historyLimit * 2 && !this._summarizing) {
      this._summarizing = true;
      if (emitState) emitState('thinking', 'Compressing neural context...');
      try {
        await this.summarizeHistory(systemPrompt);
      } finally {
        this._summarizing = false;
      }
    }

    const domain = this.constructor.name.replace('Expert', '').replace('EmployeeBase', 'code').toLowerCase();
    const profile = modelService.selectProfile({
      modelName: this.modelName,
      effortLevel: this.effortLevel || 'standard',
      domain,
    });
    const fullSystemPrompt = `${systemPrompt}\n\n---\n\n${this.domainInstruction}`;

    if (emitState) emitState('thinking', `Routing through ${profile.provider}:${profile.model}...`);

    if (modelService.providerKind(profile) === 'gemini') {
      return this.executeGemini(prompt, fullSystemPrompt, profile, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools);
    }

    return this.executeExternal(prompt, fullSystemPrompt, profile, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools);
  }

  async executeGemini(prompt, fullSystemPrompt, profile, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools = []) {
    const combinedTools = [...AGENT_TOOLS, ...additionalTools];
    const model = modelService.getGeminiGenerativeModel({
      model: profile.model,
      tools: [{ functionDeclarations: combinedTools }],
      systemInstruction: fullSystemPrompt,
      maxOutputTokens: profile.maxOutputTokens,
    });

    const chat = model.startChat({
      history: modelService.trimGeminiHistory(this.history, profile.historyBudgetTokens),
    });

    const sendMessage = (msg, phase = 'agent') => modelService.sendGeminiStream(chat, msg, profile, {
      onStream,
      meta: { phase },
    });

    if (emitState) emitState('thinking', 'Reasoning about prompt...');
    let response = await sendMessage(prompt, 'initial');

    const allToolCalls = [];
    let iteration = 0;
    const maxIterations = 25;

    while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iteration < maxIterations) {
      iteration++;
      const calls = response.candidates[0].content.parts
        .filter(p => p.functionCall)
        .map(p => p.functionCall);

      allToolCalls.push(...calls);
      const toolResponses = [];

      for (const call of calls) {
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState);
        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: observation },
          },
        });
      }

      if (emitState) emitState('thinking', 'Processing observations...');
      response = await sendMessage(toolResponses, 'tool_observation');
    }

    const finalText = response.text();
    this.commitHistory(prompt, finalText);
    return { content: finalText, toolCalls: allToolCalls };
  }

  async executeExternal(prompt, fullSystemPrompt, profile, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools = []) {
    const allToolCalls = [];
    const providerKind = modelService.providerKind(profile);
    const combinedTools = [...AGENT_TOOLS, ...additionalTools];
    const recentHistory = this.history.slice(-this.historyLimit).map(turn => ({
      role: turn.role === 'model' ? 'assistant' : 'user',
      content: textFromHistoryPart(turn),
    }));

    if (providerKind === 'anthropic') {
      return this.executeAnthropicLoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools);
    }

    return this.executeOpenAILoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools);
  }

  async executeOpenAILoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools = []) {
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...recentHistory,
      { role: 'user', content: prompt },
    ];

    let finalText = '';
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await modelService.openAICompatibleChat({ profile, messages, tools: combinedTools });
      finalText = result.content || '';

      if (!result.toolCalls.length) {
        if (finalText && onStream) onStream(finalText);
        this.commitHistory(prompt, finalText);
        return { content: finalText, toolCalls: allToolCalls };
      }

      messages.push(result.rawMessage);
      for (const call of result.toolCalls) {
        allToolCalls.push({ name: call.name, args: call.args });
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: stringifyObservation(observation),
        });
      }
    }

    this.commitHistory(prompt, finalText || '[Provider stopped after maximum tool iterations.]');
    return { content: finalText || '[Provider stopped after maximum tool iterations.]', toolCalls: allToolCalls };
  }

  async executeAnthropicLoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools = []) {
    const messages = [...recentHistory, { role: 'user', content: prompt }];
    let finalText = '';
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await modelService.anthropicChat({ profile, system: fullSystemPrompt, messages, tools: combinedTools });
      finalText = result.content || '';

      if (!result.toolCalls.length) {
        if (finalText && onStream) onStream(finalText);
        this.commitHistory(prompt, finalText);
        return { content: finalText, toolCalls: allToolCalls };
      }

      messages.push(result.rawMessage);
      const toolResults = [];
      for (const call of result.toolCalls) {
        allToolCalls.push({ name: call.name, args: call.args });
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: stringifyObservation(observation),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    this.commitHistory(prompt, finalText || '[Provider stopped after maximum tool iterations.]');
    return { content: finalText || '[Provider stopped after maximum tool iterations.]', toolCalls: allToolCalls };
  }

  async executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    if (call.name === 'read_file' || call.name === 'list_files') {
      if (emitState) emitState('reading', `Analyzing ${call.args.path || 'project structure'}...`);
    } else if (['edit_file', 'write_file', 'create_file'].includes(call.name)) {
      if (emitState) emitState('writing', `Surgically editing ${call.args.path || 'file'}...`);
    } else if (call.name === 'run_command') {
      if (emitState) emitState('debugging', `Executing ${call.args.command || 'terminal command'}...`);
    } else if (call.name === 'search_symbols') {
      if (emitState) emitState('reading', `Searching for symbol "${call.args.query}"...`);
    }

    switch (call.name) {
      case 'ask_clarification':
        if (emitState) emitState('thinking', 'Clarification required.');
        return onClarification(call.args.questions, call.args.context);
      case 'create_plan': {
        if (emitState) emitState('thinking', 'Drafting execution plan...');
        const approved = await onPlan(call.args.steps, call.args.risks);
        return approved ? 'Plan approved by user. Proceed with execution.' : 'Plan rejected by user. Ask what they would like changed.';
      }
      case 'update_memory':
        await onMemoryUpdate(call.args);
        return 'Memory entry saved successfully.';
      default:
        return onToolCall(call.name, call.args || {});
    }
  }

  commitHistory(prompt, finalText) {
    this.history.push({ role: 'user', parts: [{ text: prompt }] });
    this.history.push({ role: 'model', parts: [{ text: finalText }] });
    if (this.sharedContext) this.sharedContext.history = this.history;
  }

  async summarizeHistory(systemPrompt) {
    const profile = modelService.selectProfile({ modelName: 'gemini-1.5-flash', effortLevel: 'quick', domain: 'summarizer' });
    const summarizer = modelService.getGeminiGenerativeModel({
      model: profile.provider === 'gemini' ? profile.model : 'gemini-1.5-flash',
      maxOutputTokens: 1024,
    });

    const messagesToSummarize = this.history.slice(0, -4);
    const summaryPrompt = `
      You are a context manager for a coding agent.
      Summarize the following conversation history into a concise "Neural Context Snapshot".
      Preserve decisions, codebase learnings, task progress, and pending actions.

      SYSTEM CONTEXT:
      ${systemPrompt.slice(0, 4000)}

      HISTORY:
      ${JSON.stringify(messagesToSummarize)}
    `;

    const result = await summarizer.generateContent(summaryPrompt);
    const snapshot = result.response.text();

    this.history = [
      { role: 'user', parts: [{ text: `Neural Context Snapshot:\n${snapshot}` }] },
      { role: 'model', parts: [{ text: 'Acknowledged. I have absorbed the context snapshot and am ready to continue.' }] },
      ...this.history.slice(-4),
    ];
  }
}
