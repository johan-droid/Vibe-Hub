import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { v4 as uuid } from 'uuid';
import { performLogoutCleanup, savePanelStates, loadPanelStates } from '../utils/localStorage';
import { getAgentLoop } from '../services/AgentLoop.js';

const MAX_ORCHESTRATOR_EVENTS = 500;

function inferEventSource(event) {
  if (event.source) return event.source;
  if (event.metadata?.source) return event.metadata.source;
  if (event.tool?.includes('__')) return 'mcp';
  if (event.tool?.startsWith('browser_')) return 'browser';
  if (event.tool?.startsWith('github_')) return 'github';
  return 'selina';
}

function normalizeOrchestratorEvent(event = {}) {
  const type = event.type || 'status';
  const run = event.run || event.params?.run || event.metadata?.run || {};
  const source = inferEventSource(event);
  const status = event.status || event.state || 'info';
  const title = event.title
    || (event.tool ? `${event.tool} ${status}` : null)
    || (type === 'terminal_output' ? 'Terminal output' : null)
    || (type === 'plan_request' ? 'Approval requested' : null)
    || (type === 'clarification_request' ? 'Clarification requested' : null)
    || 'Workspace event';

  return {
    id: event.id || event.callId || event.planId || event.clarificationId || uuid(),
    type,
    status,
    title,
    summary: event.summary || event.message || event.error || event.delta || event.content || '',
    details: event.details || event.data || event.chunks || event.metadata || null,
    timestamp: event.timestamp || new Date().toISOString(),
    source,
    metadata: event.metadata || {},
    tool: event.tool,
    state: event.state,
    runId: event.runId || run.runId || null,
    rootRunId: event.rootRunId || run.rootRunId || null,
    parentRunId: event.parentRunId || run.parentRunId || null,
    depth: run.depth || 0,
    expert: run.expert || event.metadata?.expert || null,
    provider: run.provider || event.metadata?.provider || null,
    model: run.model || event.metadata?.model || null,
    risk: event.metadata?.risk || null,
  };
}

function buildToolGraph(events = []) {
  const nodesById = new Map();
  const order = [];
  const runNodeByRunId = new Map();

  for (const event of events) {
    if (event.type !== 'tool_call' && event.state !== 'run_started') continue;
    const nodeId = event.state === 'run_started'
      ? `run:${event.runId || event.id}`
      : event.id;
    if (!nodesById.has(nodeId)) order.push(nodeId);
    if (event.runId && event.state === 'run_started') runNodeByRunId.set(event.runId, nodeId);
    const previous = nodesById.get(nodeId) || {};
    nodesById.set(nodeId, {
      ...previous,
      id: nodeId,
      label: event.state === 'run_started'
        ? `${event.expert || 'manager'} run`
        : event.tool || event.title || 'tool',
      status: event.status,
      source: event.source,
      summary: event.summary,
      metadata: event.metadata,
      timestamp: event.timestamp,
      runId: event.runId,
      rootRunId: event.rootRunId,
      parentRunId: event.parentRunId,
      depth: event.depth,
      expert: event.expert,
      provider: event.provider,
      model: event.model,
      risk: event.risk,
      nodeKind: event.state === 'run_started' ? 'run' : 'tool',
    });
  }

  const nodes = order.map((id, index) => ({
    ...nodesById.get(id),
    index,
  }));

  return {
    nodes,
    edges: nodes.slice(1).map((node, index) => {
      const parentRunNode = node.parentRunId ? runNodeByRunId.get(node.parentRunId) : null;
      const source = parentRunNode && parentRunNode !== node.id ? parentRunNode : nodes[index].id;
      return {
        id: `${source}->${node.id}`,
        source,
        target: node.id,
      };
    }),
  };
}

/**
 * Selina Global State Store — Principal Architect Implementation
 * 
 * Engineered for hyper-performance on Ryzen hardware.
 * Uses atomic updates and selective persistence to minimize I/O overhead.
 */
export const useStore = create(
  persist(
    (set, get) => ({
      // --- AUTH & HYDRATION ---
      user: null,
      hydrated: false,

      // --- LAYOUT STATE ---
      sidebarCollapsed: false,
      chatCollapsed: false,
      terminalHeight: 256,
      activeTab: 'workbench', // Default to workbench instead of dashboard
      theme: 'dark', // Always dark

      // --- AGENT CORE STATE (Volatile) ---
      messages: [],
      streamingMessage: null, 
      agentThoughts: [],
      isThinking: false,
      chatHistory: [], // Array<{ id, title, timestamp }>
      linkedProjects: [], // Array<{ id, name, type: 'repo'|'local', path }>
      uploadedFiles: [], // Array<{ id, name, size }>
      workflowState: null,
      setWorkflowState: (state) => set({ workflowState: state }),
      
      // Neural Status (Current Expert Context)
      neuralStatus: {
        expert: 'core', 
        phase: 'idle',  
        lastAction: '',
        waitingForGitHub: false,
      },

      // Agent state for AgentNeuralStatus
      agentState: 'idle',
      statusMessage: '',
      effortLevel: 'standard',
      auditMode: 'standard',
      terminalOutput: [],
      terminalSessions: new Map(),
      activeTerminalSession: null,
      terminalPanelVisible: false,
      orchestratorEvents: [],
      toolGraph: { nodes: [], edges: [] },
      workspaceMode: 'review',
      experienceMode: 'professional',
      autonomyLevel: 2,
      pendingApproval: null,

      // VFS & Code State
      vfsStatus: 'idle',
      vfsInstance: null,
      vfsTree: [],
      openFiles: [], 
      activeFilePath: null,
      activeFileContent: null,
      diffData: null, 
      
      // --- USER SETTINGS (Tier 2 Persisted) ---
      settings: {
        agent: {
          maxRetries: 3,
          timeout: 30,
          model: 'GPT-4o',
          autoAccept: false,
          sandboxType: 'Local Docker container',
          allowedLanguages: ['Python', 'Node', 'Rust']
        },
        terminal: {
          visibility: 'On Error',
          peekAutoDismiss: true,
          logRetention: 'Until session ends',
          maxLogLines: 10000,
          captureAnsi: true,
          recordDiary: true
        },
        appearance: {
          theme: 'dark',
          fontSize: 14,
          codeFont: 'JetBrains Mono',
          minimap: false,
          animationIntensity: 'Full',
          soundEffects: 'On',
          glassIntensity: 80
        },
        workflow: {
          showNotifications: true,
          alertManualReview: true,
          autoOpenDiff: false,
          confirmAcceptAll: true,
          experienceMode: 'professional',
          autonomyLevel: 2
        },
        advanced: {
          allowedDirectories: '',
          envVars: {},
          startupCommands: '',
          debugMode: false,
          sessionAutoSave: 'None',
          apiKeys: {}
        }
      },
      
      // --- SETTERS & ACTIONS ---

      // Auth
      setUser: (user) => set({ user }),
      logout: () => {
        // Tier 3 cleanup: Clear auth tokens but preserve Tier 1 & 2
        // (user preferences, lastJobId, panel states survive logout)
        performLogoutCleanup();
        set({ user: null, messages: [], agentThoughts: [], streamingMessage: null });
      },

      // Layout - Persisted to localStorage (Tier 2)
      setSidebarCollapsed: (v) => {
        set({ sidebarCollapsed: v });
        savePanelStates({ sidebarCollapsed: v, chatCollapsed: useStore.getState().chatCollapsed, terminalHeight: useStore.getState().terminalHeight });
      },
      setChatCollapsed: (v) => {
        set({ chatCollapsed: v });
        savePanelStates({ sidebarCollapsed: useStore.getState().sidebarCollapsed, chatCollapsed: v, terminalHeight: useStore.getState().terminalHeight });
      },
      setTerminalHeight: (v) => {
        set({ terminalHeight: v });
        savePanelStates({ sidebarCollapsed: useStore.getState().sidebarCollapsed, chatCollapsed: useStore.getState().chatCollapsed, terminalHeight: v });
      },
      setActiveTab: (tab) => set({ activeTab: tab }),
      setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
      setExperienceMode: (experienceMode) => set((state) => ({
        experienceMode,
        settings: {
          ...state.settings,
          workflow: { ...state.settings.workflow, experienceMode },
        },
      })),
      setAutonomyLevel: (autonomyLevel) => set((state) => ({
        autonomyLevel,
        settings: {
          ...state.settings,
          workflow: { ...state.settings.workflow, autonomyLevel },
        },
      })),
      setPendingApproval: (pendingApproval) => set({ pendingApproval }),
      setHydrated: (v) => set({ hydrated: v }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      // Restore panel states from localStorage
      restorePanelStates: () => {
        const states = loadPanelStates();
        if (states) {
          set({
            sidebarCollapsed: states.sidebarCollapsed ?? useStore.getState().sidebarCollapsed,
            chatCollapsed: states.chatCollapsed ?? useStore.getState().chatCollapsed,
            terminalHeight: states.terminalHeight ?? useStore.getState().terminalHeight,
          });
        }
      },

      // Agent Streaming
      setStreamingMessage: (content) => set({ streamingMessage: content }),
      
      finalizeStreamingMessage: () => set((state) => {
        if (!state.streamingMessage) return state;
        return {
          messages: [...state.messages, { role: 'assistant', content: state.streamingMessage }],
          streamingMessage: null,
          isThinking: false,
        };
      }),

      addMessage: (msg) => set((state) => ({
        messages: [...state.messages, { id: uuid(), ...msg }]
      })),

      setThinking: (v) => set({ isThinking: v }),
      addOrchestratorEvent: (event) => set((state) => {
        const normalized = normalizeOrchestratorEvent(event);
        const orchestratorEvents = [...state.orchestratorEvents, normalized].slice(-MAX_ORCHESTRATOR_EVENTS);
        return {
          orchestratorEvents,
          toolGraph: buildToolGraph(orchestratorEvents),
          agentLoopStatus: {
            ...state.agentLoopStatus,
            history: orchestratorEvents.slice(-200),
          },
        };
      }),
      clearOrchestratorEvents: () => set((state) => ({
        orchestratorEvents: [],
        toolGraph: { nodes: [], edges: [] },
        agentLoopStatus: { ...state.agentLoopStatus, history: [] },
      })),

      // Chat History
      activeSessionId: null,
      chatSessions: [],
      
      setChatSessions: (sessions) => set({ chatSessions: sessions }),
      setActiveSession: (id) => set({ activeSessionId: id }),
      
      setChatHistory: (history) => set({ chatHistory: history }),
      addChatToHistory: (chat) => set((state) => ({
        chatHistory: [chat, ...state.chatHistory]
      })),

      // Project Management
      setLinkedProjects: (projects) => set({ linkedProjects: projects }),
      addProject: (project) => set((state) => ({
        linkedProjects: [...state.linkedProjects, project]
      })),
      setProjects: (projects) => set({ linkedProjects: projects }),
      removeProject: (id) => set((state) => ({
        linkedProjects: state.linkedProjects.filter((p) => p.id !== id)
      })),

      // File Assets
      setUploadedFiles: (files) => set({ uploadedFiles: files }),
      addUploadedFile: (file) => set((state) => ({
        uploadedFiles: [...state.uploadedFiles, file]
      })),

      // Neural Status Updates
      updateNeuralStatus: (status) => set((state) => ({
        neuralStatus: { ...state.neuralStatus, ...status }
      })),

      // VFS & Code
      setVfsStatus: (status) => set({ vfsStatus: status }),
      setVfsInstance: (instance) => set({ vfsInstance: instance }),
      setVfsTree: (tree) => set({ vfsTree: tree }),
      setDiffData: (data) => set({ diffData: data }),
      setSettings: (newSettings, skipSync = false) => {
        set((state) => {
          const updatedSettings = { 
            ...state.settings, 
            ...Object.keys(newSettings).reduce((acc, key) => {
              if (state.settings[key] && typeof newSettings[key] === 'object' && newSettings[key] !== null) {
                acc[key] = { ...state.settings[key], ...newSettings[key] };
              }
              return acc;
            }, {})
          };

          // Background sync to backend if not skipped
          if (!skipSync && state.user) {
            import('../services/api').then(({ api }) => {
              // Map settings groups to DB preference types
              const mapping = {
                appearance: 'ui_theme',
                agent: 'workflow', // Map agent settings to workflow preference type
                workflow: 'workflow'
              };

              Object.keys(newSettings).forEach(group => {
                const type = mapping[group];
                if (type) {
                  api.updatePreference(type, updatedSettings[group]).catch(err => {
                    console.error(`[Store] Failed to sync ${group} settings:`, err);
                  });
                }
              });
              
              // Handle language separately if it's in a custom group or advanced
              if (newSettings.language) {
                api.updatePreference('language', newSettings.language).catch(err => {
                  console.error(`[Store] Failed to sync language:`, err);
                });
              }
            });
          }

          return { settings: updatedSettings };
        });
      },

      fetchSettings: async () => {
        try {
          const { api } = await import('../services/api');
          const { preferences } = await api.getPreferences();
          
          if (preferences) {
            const mappedSettings = {};
            
            // Map DB types back to store groups
            if (preferences.ui_theme) mappedSettings.appearance = preferences.ui_theme;
            if (preferences.workflow) {
              mappedSettings.workflow = preferences.workflow;
              mappedSettings.agent = preferences.workflow; // Dual mapping
            }
            if (preferences.language) mappedSettings.language = preferences.language;

            if (Object.keys(mappedSettings).length > 0) {
              useStore.getState().setSettings(mappedSettings, true); // skipSync to avoid loop
            }
            if (preferences.workflow?.experienceMode) {
              set({ experienceMode: preferences.workflow.experienceMode });
            }
            if (preferences.workflow?.autonomyLevel) {
              set({ autonomyLevel: preferences.workflow.autonomyLevel });
            }
          }
        } catch (error) {
          console.error('[Store] Failed to fetch settings:', error);
        }
      },
      
      openFile: (path, content) => set((state) => {
        const isAlreadyOpen = state.openFiles.find(f => f.path === path);
        const newOpenFiles = isAlreadyOpen 
          ? state.openFiles 
          : [...state.openFiles, { path, content, dirty: false }];
        
        return { 
          openFiles: newOpenFiles,
          activeFilePath: path, 
          activeFileContent: content, 
          activeTab: 'editor' 
        };
      }),

      closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(f => f.path !== path);
        let nextPath = state.activeFilePath;
        let nextContent = state.activeFileContent;

        if (state.activeFilePath === path) {
          const lastFile = newOpenFiles[newOpenFiles.length - 1];
          nextPath = lastFile?.path || null;
          nextContent = lastFile?.content || null;
        }

        return {
          openFiles: newOpenFiles,
          activeFilePath: nextPath,
          activeFileContent: nextContent,
          activeTab: nextPath ? 'editor' : (state.diffData ? 'diff' : 'workbench')
        };
      }),

      setActiveFile: (path, content) => {
        useStore.getState().openFile(path, content);
      },
      setDiffData: (diff) => set({ diffData: diff, activeTab: 'diff' }),

      appendTerminalOutput: (d) => set((s) => {
        const MAX_LINES = 2_000;
        const newLines = typeof d === 'string' ? d.split('\n') : [String(d)];
        const combined = [...s.terminalOutput, ...newLines];
        return {
          terminalOutput: combined.length > MAX_LINES
            ? combined.slice(-MAX_LINES)
            : combined,
        };
      }),
      clearTerminal: () => set({ terminalOutput: [] }),

      // Agent status
      setAgentStatus: (state, message) => set((prev) => {
        const nextState = { agentState: state, statusMessage: message || '' };
        if (state === 'waitingForGitHub') {
          nextState.neuralStatus = { ...prev.neuralStatus, waitingForGitHub: true };
        } else if (state === 'idle') {
          nextState.neuralStatus = { ...prev.neuralStatus, waitingForGitHub: false };
        }
        return nextState;
      }),
      setEffortLevel: (l) => set({ effortLevel: l }),
      setAuditMode: (mode) => set({ auditMode: mode }),

      // Thoughts & Logs
      addThought: (thought) => set((state) => {
        const normalized = typeof thought === 'string'
          ? { content: thought }
          : {
              ...thought,
              content: thought?.content || thought?.message || JSON.stringify(thought ?? ''),
            };

        const nextThoughts = [
          ...state.agentThoughts,
          {
            id: uuid(),
            ...normalized,
            timestamp: normalized.timestamp || Date.now(),
          },
        ];

        return { agentThoughts: nextThoughts.slice(-200) };
      }),
      clearThoughts: () => set({ agentThoughts: [] }),

      // Terminal Session Management
      addTerminalSession: (session) => set((state) => {
        const sessions = new Map(state.terminalSessions);
        sessions.set(session.id, session);
        return { 
          terminalSessions: sessions,
          activeTerminalSession: session.id,
          terminalPanelVisible: true
        };
      }),
      
      updateTerminalSession: (sessionId, updates) => set((state) => {
        const sessions = new Map(state.terminalSessions);
        const session = sessions.get(sessionId);
        if (session) {
          sessions.set(sessionId, { ...session, ...updates });
        }
        return { terminalSessions: sessions };
      }),
      
      removeTerminalSession: (sessionId) => set((state) => {
        const sessions = new Map(state.terminalSessions);
        sessions.delete(sessionId);
        const newActiveSession = state.activeTerminalSession === sessionId 
          ? (sessions.size > 0 ? sessions.keys().next().value : null)
          : state.activeTerminalSession;
        return { 
          terminalSessions: sessions,
          activeTerminalSession: newActiveSession,
          terminalPanelVisible: sessions.size > 0
        };
      }),
      
      setActiveTerminalSession: (sessionId) => set({ activeTerminalSession: sessionId }),
      
      toggleTerminalPanel: () => set((state) => ({ 
        terminalPanelVisible: !state.terminalPanelVisible 
      })),
      
      setTerminalPanelVisible: (visible) => set({ terminalPanelVisible: visible }),
      
      appendTerminalOutput: (sessionId, data) => set((state) => {
        if (data === undefined) {
          const MAX_LINES = 2_000;
          const newLines = typeof sessionId === 'string' ? sessionId.split('\n') : [String(sessionId)];
          const combined = [...state.terminalOutput, ...newLines];
          return {
            terminalOutput: combined.length > MAX_LINES ? combined.slice(-MAX_LINES) : combined,
          };
        }

        const sessions = new Map(state.terminalSessions);
        const session = sessions.get(sessionId);
        if (session) {
          const output = Array.isArray(data) ? data : [data];
          sessions.set(sessionId, {
            ...session,
            output: [...session.output, ...output].slice(-1000) // Keep last 1000 lines
          });
        }
        return { terminalSessions: sessions };
      }),
      
      clearTerminalSession: (sessionId) => set((state) => {
        const sessions = new Map(state.terminalSessions);
        const session = sessions.get(sessionId);
        if (session) {
          sessions.set(sessionId, { ...session, output: [] });
        }
        return { terminalSessions: sessions };
      }),

      // Agent Loop State
      agentLoopStatus: {
        isRunning: false,
        currentIteration: 0,
        maxIterations: 10,
        history: [],
        lastResult: null,
        error: null
      },

      setAgentLoopStatus: (status) => set((state) => ({
        agentLoopStatus: { ...state.agentLoopStatus, ...status }
      })),

      clearAgentLoopHistory: () => set((state) => ({
        agentLoopStatus: { ...state.agentLoopStatus, history: [] }
      })),

      startAgentLoop: async (files, command, args, options) => {
        const vfs = useStore.getState().vfsInstance;
        if (!vfs) throw new Error('VFS not initialized');
        
        const agentLoop = getAgentLoop(vfs);
        return await agentLoop.start({ files, command, args, options });
      },

      stopAgentLoop: () => {
        const vfs = useStore.getState().vfsInstance;
        if (vfs?.agentLoop) {
          vfs.agentLoop.stop();
        }
      },
    }),
    {
      name: 'selinahub-neural-storage-v2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        chatCollapsed: state.chatCollapsed,
        terminalHeight: state.terminalHeight,
        theme: state.theme,
        chatHistory: state.chatHistory,
        linkedProjects: state.linkedProjects,
        settings: state.settings,
        workspaceMode: state.workspaceMode,
        experienceMode: state.experienceMode,
        autonomyLevel: state.autonomyLevel,
      }),
      version: 3,
      migrate: (persistedState) => {
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);
