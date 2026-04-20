import { GoogleGenerativeAI } from '@google/generative-ai';
import { AGENT_TOOLS } from './tools.js';

/**
 * EmployeeBase — Server-Side Expert (Brain v3.0)
 * 
 * Key improvements over v2:
 * - System prompt is now built from skills + memory (injected at execute time)
 * - ReAct loop handles clarification and planning tools specially
 * - History management with smart compression
 */
export class EmployeeBase {
  constructor(modelName = 'gemini-2.0-flash') {
    this.modelName = modelName;
    this.history = [];
    this.historyLimit = 12;
    this.domainInstruction = ''; // Set by subclass
  }

  /**
   * Execute the full ReAct loop.
   */
  async execute(prompt, systemPrompt, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    if (this.history.length > this.historyLimit * 2) {
      this.history.splice(0, 2);
    }

    const fullSystemPrompt = systemPrompt + '\n\n---\n\n' + this.domainInstruction;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      tools: [{ functionDeclarations: AGENT_TOOLS }],
      systemInstruction: fullSystemPrompt,
    });

    const chat = model.startChat({ history: this.history });
    
    // Neural Phase: Initial Thought
    if (emitState) emitState('thinking', 'Reasoning about prompt...');
    let result = await chat.sendMessage(prompt);
    let response = result.response;

    let maxIterations = 25;
    let iteration = 0;

    while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iteration < maxIterations) {
      iteration++;
      const calls = response.candidates[0].content.parts
        .filter(p => p.functionCall)
        .map(p => p.functionCall);

      const toolResponses = [];

      for (const call of calls) {
        // Map tool calls to logical states
        if (call.name === 'read_file' || call.name === 'list_files') {
          if (emitState) emitState('reading', `Analyzing ${call.args.path || 'project structure'}...`);
        } else if (call.name === 'edit_file' || call.name === 'write_file' || call.name === 'create_file') {
          if (emitState) emitState('writing', `Surgically editing ${call.path || 'file'}...`);
        } else if (call.name === 'run_command') {
          if (emitState) emitState('debugging', `Executing ${call.args.command || 'terminal command'}...`);
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
      result = await chat.sendMessage(toolResponses);
      response = result.response;
    }

    const finalText = response.text();

    this.history.push({ role: 'user', parts: [{ text: prompt }] });
    this.history.push({ role: 'model', parts: [{ text: finalText }] });

    return finalText;
  }
}
