/**
 * WebSocket client for real-time Brain communication (v3.0).
 * 
 * New in v3:
 * - Clarification request/response flow
 * - Plan approval/rejection flow
 * - Tool dispatch with edit_file support
 */
export class SwarmSocket {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.listeners = {};
    this.toolHandler = null;
  }

  connect() {
    const wsBase = import.meta.env.PROD
      ? 'wss://vibe-hub-bridge.onrender.com'
      : `ws://${window.location.hostname}:3001`;
    
    this.ws = new WebSocket(`${wsBase}/ws?token=${this.token}`);

    this.ws.onopen = () => {
      console.log('[Socket] Connected to Brain v3.');
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'thought':
          this.emit('thought', msg.message);
          break;

        case 'tool_request':
          this.handleToolRequest(msg);
          break;

        case 'result':
          this.emit('result', msg.content);
          break;

        case 'thinking':
          this.emit('thinking', msg.value);
          break;

        case 'error':
          this.emit('error', msg.message);
          break;

        // === NEW in v3 ===
        case 'clarification_request':
          this.emit('clarification', {
            clarificationId: msg.clarificationId,
            questions: msg.questions,
            context: msg.context,
          });
          break;

        case 'plan_request':
          this.emit('plan', {
            planId: msg.planId,
            steps: msg.steps,
            risks: msg.risks,
          });
          break;
      }
    };

    this.ws.onclose = (e) => {
      console.log('[Socket] Disconnected:', e.code, e.reason);
      this.emit('disconnected');
    };

    this.ws.onerror = (err) => {
      console.error('[Socket] Error:', err);
    };
  }

  async handleToolRequest(msg) {
    const { callId, name, args } = msg;

    if (!this.toolHandler) {
      this.send({ type: 'tool_response', callId, error: 'No VFS handler attached.' });
      return;
    }

    try {
      const result = await this.toolHandler(name, args);
      this.send({ type: 'tool_response', callId, result });
    } catch (err) {
      this.send({ type: 'tool_response', callId, error: err.message });
    }
  }

  sendPrompt(prompt, effortLevel = 'standard') {
    this.send({ type: 'prompt', prompt, effortLevel });
  }

  /** Send clarification answer back to the Brain */
  sendClarificationResponse(clarificationId, answer) {
    this.send({ type: 'clarification_response', clarificationId, answer });
  }

  /** Send plan approval/rejection back to the Brain */
  sendPlanResponse(planId, approved) {
    this.send({ type: 'plan_response', planId, approved });
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  setToolHandler(handler) {
    this.toolHandler = handler;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, ...args) {
    (this.listeners[event] || []).forEach(cb => cb(...args));
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}
