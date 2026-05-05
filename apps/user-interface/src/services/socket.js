/**
 * WebSocket client for real-time Brain communication (v3.0).
 * 
 * New in v3:
 * - Clarification request/response flow
 * - Plan approval/rejection flow
 * - Tool dispatch with edit_file support
 * - Socket.io integration for XState streaming
 */

import { io } from 'socket.io-client';
import { api } from './api';
import { setLastJobId, clearLastJobId } from '../utils/localStorage';
export class SwarmSocket {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.listeners = {};
    this.toolHandler = null;
  }

  connect() {
    const wsBase = import.meta.env.VITE_WS_BASE || (import.meta.env.PROD
      ? 'wss://vibe-hub-bridge.onrender.com'
      : `ws://${window.location.hostname}:3001`);
    
    const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    this.ws = new WebSocket(`${wsBase}/ws${tokenQuery}`);

    this.ws.onopen = () => {
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

        case 'stream_chunk':
          this.emit('stream_chunk', msg.delta || '');
          break;

        case 'thinking':
          this.emit('thinking', msg.value);
          break;

        case 'error':
          this.emit('error', msg.message);
          break;

        case 'github_workflow_completed':
          this.emit('github_workflow_completed', msg);
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
        case 'state_change':
          this.emit('state_change', { state: msg.state, message: msg.message });
          break;

        case 'status':
          this.emit('state_change', { state: msg.state, message: msg.message });
          break;

        case 'terminal_output':
          this.emit('terminal_output', msg.data);
          break;

        case 'task_added':
        case 'task_status':
        case 'queue:update':
        case 'queue:done':
          this.emit('task_event', msg);
          break;

        case 'conflict_warning':
          this.emit('conflict_warning', { risk: msg.risk });
          break;
      }
    };

    this.ws.onclose = (e) => {
      this.emit('disconnected');
    };

    this.ws.onerror = () => {
      // Error handled by disconnect
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

/**
 * Socket.io client for XState orchestration streaming (v6)
 * Streams real-time state machine transitions from server-bridge
 */
export class OrchestratorSocket {
  constructor() {
    this.socket = null;
    this.listeners = {};
    this.socketId = null;
  }

  connect(userId = null) {
    const SOCKET_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
    
    this.socket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token: api.getToken() },
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.socket.auth = { token: api.getToken() };
    });

    this.socket.on('connect', () => {
      this.socketId = this.socket.id;
      console.log('[OrchestratorSocket] Connected:', this.socketId);
      
      // Join user-specific room if userId provided
      if (userId) {
        this.socket.emit('join', { userId });
      }
      
      this.emit('connected', { socketId: this.socketId });
    });

    this.socket.on('agent_status', (data) => {
      console.log('[OrchestratorSocket] Agent status:', data);
      
      // Track jobs for resumption support
      if (data.jobId) {
        if (data.status === 'queued' || data.status === 'queued_job_started') {
          // Job started - store for potential resumption
          setLastJobId(data.jobId, data.requestId);
        } else if (data.status === 'job_completed' || data.status === 'fatal_failure') {
          // Job finished - clear tracking after a delay (allow user to see completion)
          setTimeout(() => {
            clearLastJobId();
          }, 30000);
        }
      }
      
      this.emit('agent_status', data);
    });

    this.socket.on('file_staged', (data) => {
      console.log('[OrchestratorSocket] File staged for review:', data.filePath);
      this.emit('file_staged', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[OrchestratorSocket] Disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[OrchestratorSocket] Connection error:', error);
      this.emit('error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[OrchestratorSocket] Reconnected after', attemptNumber, 'attempts');
      this.emit('reconnected', { attemptNumber });
    });

    return this;
  }

  getSocketId() {
    return this.socketId;
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
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Default export for convenience
export const socket = new OrchestratorSocket();
