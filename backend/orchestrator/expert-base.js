import { AGENT_TOOLS } from './tools.js';
import { modelService } from './models.js';
import { validateToolCallArguments } from './tool_schema.js';
import { ContextPruner } from './utils/context-pruner.js';
import { hardenSystemPrompt, wrapUserQuery } from './prompt-hardening.js';
import { sanitizeCompletionForRetention } from './secure-memory.js';

function textFromHistoryPart(turn) {
  if (typeof turn?.content === 'string') return turn.content;
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
    this.providerOverride = null;
    this.executionContext = {};
    this.contextPruner = new ContextPruner();
  }

  async execute(prompt, systemPrompt, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools = []) {
    if (this.history.length > this.historyLimit * 2 && !this._summarizing) {
      this._summarizing = true;
      if (emitState) emitState('thinking', 'Compressing neural context...');
      try {
        await this.summarizeHistory(systemPrompt);
      } catch (error) {
        if (emitState) emitState('warning', `Context compression skipped: ${error.message}`);
      } finally {
        this._summarizing = false;
      }
    }

    const domain = this.constructor.name.replace('Expert', '').replace('EmployeeBase', 'code').toLowerCase();
    const profile = modelService.selectProfile({
      modelName: this.modelName,
      effortLevel: this.effortLevel || 'standard',
      domain,
      provider: this.providerOverride,
    });
    const fullSystemPrompt = hardenSystemPrompt(`${systemPrompt}\n\n---\n\n${this.domainInstruction}`);
    const wrappedPrompt = wrapUserQuery(prompt);
    const profiles = [profile, ...modelService.selectFallbackProfiles(profile)];
    let lastError = null;

    for (let index = 0; index < profiles.length; index++) {
      const candidate = profiles[index];
      const budgetAwareCandidate = modelService.prepareProfileForCall(candidate, this.executionContext);
      if (emitState) emitState('thinking', `Routing through ${candidate.provider}:${candidate.model}...`);
      try {
        return await this.executeWithProfile(wrappedPrompt, fullSystemPrompt, budgetAwareCandidate, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools);
      } catch (error) {
        if (['DAILY_TOKEN_QUOTA_EXCEEDED', 'LLM_RATE_LIMIT_EXCEEDED', 'USER_COST_SUSPENDED'].includes(error.code)) {
          throw error;
        }
        lastError = error;
        const hasNext = index < profiles.length - 1;
        const canFallback = hasNext && modelService.shouldFallback(error);
        modelService.recordAudit({
          kind: canFallback ? 'provider_fallback' : 'provider_failure',
          fromProvider: candidate.provider,
          fromModel: candidate.model,
          toProvider: canFallback ? profiles[index + 1].provider : null,
          code: modelService.providerFailureMessage(error, candidate),
        });

        if (!canFallback) {
          throw new Error(modelService.providerFailureMessage(error, candidate));
        }

        if (emitState) {
          emitState('warning', `${modelService.providerFailureMessage(error, candidate)} Falling back to ${profiles[index + 1].provider}:${profiles[index + 1].model}.`);
        }
      }
    }

    throw lastError;
  }

  async executeWithProfile(prompt, fullSystemPrompt, profile, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, additionalTools = []) {
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
      meta: { ...this.executionContext, phase },
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
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, combinedTools);
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
    if (profile.provider === 'openai' && profile.apiMode === 'responses') {
      return this.executeOpenAIResponsesLoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools);
    }

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...recentHistory,
      { role: 'user', content: prompt },
    ];

    let finalText = '';
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await modelService.openAICompatibleChat({ profile, messages, tools: combinedTools, meta: this.executionContext });
      finalText = result.content || '';

      if (!result.toolCalls.length) {
        if (finalText && onStream) onStream(finalText);
        this.commitHistory(prompt, finalText);
        return { content: finalText, toolCalls: allToolCalls };
      }

      messages.push(result.rawMessage);
      for (const call of result.toolCalls) {
        allToolCalls.push({ name: call.name, args: call.args });
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, combinedTools);
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

  async executeOpenAIResponsesLoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools = []) {
    const input = [
      ...recentHistory,
      { role: 'user', content: prompt },
    ];
    let finalText = '';
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await modelService.openAIResponses({
        profile,
        instructions: fullSystemPrompt,
        input,
        tools: combinedTools,
        meta: this.executionContext,
      });
      finalText = result.content || '';

      if (!result.toolCalls.length) {
        if (finalText && onStream) onStream(finalText);
        this.commitHistory(prompt, finalText);
        return { content: finalText, toolCalls: allToolCalls };
      }

      input.push(...result.rawItems);
      for (const call of result.toolCalls) {
        allToolCalls.push({ name: call.name, args: call.args });
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, combinedTools);
        input.push({
          type: 'function_call_output',
          call_id: call.callId,
          output: stringifyObservation(observation),
        });
      }
    }

    this.commitHistory(prompt, finalText || '[Provider stopped after maximum Responses tool iterations.]');
    return { content: finalText || '[Provider stopped after maximum Responses tool iterations.]', toolCalls: allToolCalls };
  }

  async executeAnthropicLoop(prompt, fullSystemPrompt, profile, recentHistory, allToolCalls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, onStream, combinedTools = []) {
    const messages = [...recentHistory, { role: 'user', content: prompt }];
    let finalText = '';
    const maxIterations = 16;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const result = await modelService.anthropicChat({
        profile,
        system: fullSystemPrompt,
        messages,
        tools: combinedTools,
        meta: this.executionContext,
      });
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
        const observation = await this.executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, combinedTools);
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

  async executeToolCall(call, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState, availableTools = AGENT_TOOLS) {
    validateToolCallArguments(call.name, call.args || {}, availableTools, { strict: true });

    if (call.name === 'read_file' || call.name === 'list_files') {
      if (emitState) emitState('reading', `Analyzing ${call.args.path || 'project structure'}...`);
    } else if (['edit_file', 'patch_file', 'replace_file_content', 'multi_replace_file_content', 'write_file', 'create_file'].includes(call.name)) {
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
    this.history.push({ role: 'model', parts: [{ text: sanitizeCompletionForRetention(finalText) }] });
    if (this.sharedContext) this.sharedContext.history = this.history;
  }

  async summarizeHistory(systemPrompt) {
    const prunedHistory = await this.contextPruner.pruneSessionMemory([
      { role: 'system', content: systemPrompt },
      ...this.history,
    ]);

    this.history = prunedHistory
      .slice(prunedHistory[0]?.role === 'system' ? 1 : 0)
      .map(normalizePrunedHistoryMessage);

    if (this.sharedContext) this.sharedContext.history = this.history;
  }
}

function normalizePrunedHistoryMessage(message) {
  if (Array.isArray(message?.parts)) {
    return message;
  }

  const role = message?.role === 'assistant' ? 'model' : (message?.role || 'user');
  return {
    role,
    parts: [{ text: textFromHistoryPart(message) }],
  };
}
