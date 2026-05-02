import { GoogleGenerativeAI } from '@google/generative-ai';
import { AGENT_TOOLS } from './tools.js';
import { modelService } from './models.js';

/**
 * Shared Context Store - Phase 4
 * Maintains unified state across expert handoffs
 * Passes AST and file context by reference, not raw strings
 */
class SharedContextStore {
  constructor() {
    this.context = new Map(); // sessionId -> context data
  }

  createSession(sessionId) {
    this.context.set(sessionId, {
      ast: null,           // Abstract Syntax Tree reference
      fileContext: {},     // File contents with metadata
      symbolTable: {},     // Cross-file symbol references
      executionHistory: [],
      decisions: [],
      pendingActions: [],
      createdAt: Date.now(),
    });
    return this.context.get(sessionId);
  }

  getSession(sessionId) {
    return this.context.get(sessionId);
  }

  updateAST(sessionId, ast) {
    const session = this.context.get(sessionId);
    if (session) session.ast = ast;
  }

  setFileContext(sessionId, filePath, content, metadata = {}) {
    const session = this.context.get(sessionId);
    if (session) {
      session.fileContext[filePath] = {
        content,
        ...metadata,
        lastAccessed: Date.now(),
      };
    }
  }

  getFileContext(sessionId, filePath) {
    const session = this.context.get(sessionId);
    return session?.fileContext[filePath] || null;
  }

  addSymbol(sessionId, symbolName, definition) {
    const session = this.context.get(sessionId);
    if (session) {
      session.symbolTable[symbolName] = {
        ...definition,
        addedAt: Date.now(),
      };
    }
  }

  getSymbol(sessionId, symbolName) {
    const session = this.context.get(sessionId);
    return session?.symbolTable[symbolName] || null;
  }

  addDecision(sessionId, decision) {
    const session = this.context.get(sessionId);
    if (session) session.decisions.push({ ...decision, timestamp: Date.now() });
  }

  addExecutionStep(sessionId, step) {
    const session = this.context.get(sessionId);
    if (session) session.executionHistory.push({ ...step, timestamp: Date.now() });
  }

  getFullContext(sessionId) {
    return this.context.get(sessionId);
  }

  clearSession(sessionId) {
    this.context.delete(sessionId);
  }
}

export const sharedContextStore = new SharedContextStore();

/**
 * EmployeeBase — Server-Side Expert (Brain v4.0)
 * 
 * Key improvements:
 * - Uses shared context store for cross-expert state preservation
 * - Native Google SDK with structured outputs
 * - AST-aware context passing between experts
 */
export class EmployeeBase {
  constructor(modelName = 'gemini-2.0-flash') {
    this.modelName = modelName;
    this.history = [];
    this.historyLimit = 12;
    this.domainInstruction = ''; // Set by subclass
    this.sessionId = null;
  }

  /**
   * Attach this expert to a shared session
   */
  attachSession(sessionId) {
    this.sessionId = sessionId;
    if (!sharedContextStore.getSession(sessionId)) {
      sharedContextStore.createSession(sessionId);
    }
  }

  /**
   * Execute the full ReAct loop with shared context awareness.
   */
  async execute(prompt, systemPrompt, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    // Attach to shared context if sessionId exists
    if (this.sessionId) {
      const context = sharedContextStore.getSession(this.sessionId);
      if (context && emitState) {
        emitState('thinking', `Loading shared context (${Object.keys(context.fileContext).length} files in memory)`);
      }
    }

    // Neural Context Management (v4.1)
    if (this.history.length > this.historyLimit * 2) {
      if (emitState) emitState('thinking', 'Compressing neural context...');
      await this.summarizeHistory(systemPrompt);
    }

    const fullSystemPrompt = systemPrompt + '\n\n---\n\n' + this.domainInstruction;

    try {
      const result = await modelService.chat({
        model: this.modelName,
        messages: this._buildMessages(prompt),
        tools: [{ functionDeclarations: AGENT_TOOLS }],
        systemInstruction: fullSystemPrompt,
        max_tokens: 8192,
      });

      let finalText = result.text;
      const functionCalls = result.functionCalls || [];

      // Process any tool calls from the response
      if (functionCalls.length > 0) {
        finalText = await this._processToolCalls(
          functionCalls,
          onToolCall,
          onThought,
          onClarification,
          onPlan,
          onMemoryUpdate,
          emitState
        );
      }

      // Update history
      this.history.push({ role: 'user', parts: [{ text: prompt }] });
      this.history.push({ role: 'model', parts: [{ text: finalText }] });

      // Record execution in shared context
      if (this.sessionId) {
        sharedContextStore.addExecutionStep(this.sessionId, {
          expert: this.constructor.name,
          prompt: prompt.slice(0, 200),
          result: finalText.slice(0, 500),
        });
      }

      return {
        content: finalText,
        toolCalls: functionCalls,
        thoughts: this._extractThoughts(finalText),
      };
    } catch (error) {
      console.error(`[${this.constructor.name}] Execution error:`, error.message);
      throw error;
    }
  }

  /**
   * Build messages array for Google SDK
   */
  _buildMessages(prompt) {
    return this.history.concat({ role: 'user', parts: [{ text: prompt }] });
  }

  /**
   * Process tool calls from the model response
   */
  async _processToolCalls(calls, onToolCall, onThought, onClarification, onPlan, onMemoryUpdate, emitState) {
    const toolResponses = [];

    for (const call of calls) {
      // Map tool calls to logical states
      if (['read_file', 'list_files'].includes(call.name)) {
        if (emitState) emitState('reading', `Analyzing ${call.args?.path || 'project structure'}...`);
      } else if (['edit_file', 'write_file', 'create_file'].includes(call.name)) {
        if (emitState) emitState('writing', `Surgically editing ${call.args?.path || 'file'}...`);
      } else if (call.name === 'run_command') {
        if (emitState) emitState('debugging', `Executing ${call.args?.command || 'terminal command'}...`);
      } else if (call.name === 'search_symbols') {
        if (emitState) emitState('reading', `Searching for symbol "${call.args?.query}"...`);
      }

      console.log(`[${this.constructor.name}] Tool: ${call.name}`, JSON.stringify(call.args).slice(0, 200));

      let observation;

      switch (call.name) {
        case 'ask_clarification': {
          if (emitState) emitState('thinking', 'Clarification required.');
          observation = await onClarification(call.args?.questions || [], call.args?.context || '');
          break;
        }
        case 'create_plan': {
          if (emitState) emitState('thinking', 'Drafting execution plan...');
          const approved = await onPlan(call.args?.steps || [], call.args?.risks || []);
          observation = approved
            ? 'Plan approved by user. Proceed with execution.'
            : 'Plan rejected by user. Ask what they would like changed.';
          break;
        }
        case 'update_memory': {
          await onMemoryUpdate(call.args || {});
          observation = 'Memory entry saved successfully.';
          break;
        }
        default: {
          observation = await onToolCall(call.name, call.args || {});
          
          // Update shared context for file operations
          if (this.sessionId && ['read_file', 'edit_file', 'write_file', 'create_file'].includes(call.name)) {
            const filePath = call.args?.path;
            if (filePath) {
              // Store file context for other experts
              if (typeof observation === 'string') {
                sharedContextStore.setFileContext(this.sessionId, filePath, observation, {
                  modifiedBy: this.constructor.name,
                });
              }
            }
          }
        }
      }

      toolResponses.push({
        functionResponse: {
          name: call.name,
          response: { result: observation },
        },
      });
    }

    // Send tool responses back to model for final answer
    if (toolResponses.length > 0) {
      try {
        const result = await modelService.chat({
          model: this.modelName,
          messages: [
            ...this.history,
            { role: 'user', parts: toolResponses.map(r => ({ text: JSON.stringify(r) })) }
          ],
          systemInstruction: this.domainInstruction,
          max_tokens: 2048,
        });
        return result.text;
      } catch (error) {
        console.error('[EmployeeBase] Failed to process tool responses:', error.message);
        return 'Tool calls executed but failed to generate final response.';
      }
    }

    return 'Tool calls processed.';
  }

  /**
   * Extract implicit thoughts from response
   */
  _extractThoughts(text) {
    const thoughtPatterns = [
      /I need to\s+(.+?)(?:\.|$)/i,
      /First, I'll\s+(.+?)(?:\.|$)/i,
      /Let me\s+(.+?)(?:\.|$)/i,
    ];
    
    const thoughts = [];
    for (const pattern of thoughtPatterns) {
      const match = text.match(pattern);
      if (match) thoughts.push(match[1]);
    }
    
    return thoughts;
  }

  /**
   * Summarize history to stay within token limits while preserving state.
   */
  async summarizeHistory(systemPrompt) {
    const messagesToSummarize = this.history.slice(0, -4); // Keep last 2 turns
    
    try {
      const result = await modelService.generateStructuredJSON({
        model: 'gemini-1.5-flash',
        prompt: `Summarize the following conversation history into a concise "Neural Context Snapshot".
Preserve:
- Decisions made by the user.
- Learnings about the codebase.
- Progress on current tasks.
- Pending actions.

HISTORY:
${JSON.stringify(messagesToSummarize)}`,
        systemInstruction: 'You are a context manager for a coding agent. Create concise summaries.',
      });

      const snapshot = JSON.stringify(result);

      this.history = [
        { role: 'user', parts: [{ text: `Neural Context Snapshot:\n${snapshot}` }] },
        { role: 'model', parts: [{ text: 'Acknowledged. I have absorbed the context snapshot and am ready to continue.' }] },
        ...this.history.slice(-4)
      ];
      
      // Also store in shared context
      if (this.sessionId) {
        sharedContextStore.addDecision(this.sessionId, {
          type: 'context_summary',
          snapshot,
        });
      }
      
      console.log('[Orchestrator] History summarized into context snapshot.');
    } catch (error) {
      console.error('[EmployeeBase] History summarization failed:', error.message);
    }
  }
}
