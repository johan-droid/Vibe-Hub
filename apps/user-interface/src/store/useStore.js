import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { v4 as uuid } from 'uuid';
import { performLogoutCleanup, savePanelStates, loadPanelStates } from '../utils/localStorage';

/**
 * Selina Global State Store — Principal Architect Implementation
 * 
 * Engineered for hyper-performance on Ryzen hardware.
 * Uses atomic updates and selective persistence to minimize I/O overhead.
 */
export const useStore = create(
  persist(
    (set) => ({
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
      terminalOutput: [],

      // VFS & Code State
      vfsStatus: 'idle',
      vfsTree: [],
      openFiles: [], 
      activeFilePath: null,
      activeFileContent: null,
      diffData: null, 
      
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
      setVfsTree: (tree) => set({ vfsTree: tree, vfsStatus: tree?.length ? 'ready' : 'idle' }),
      
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
    }),
    {
      name: 'selinahub-neural-storage-v2', // Increment version
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        chatCollapsed: state.chatCollapsed,
        terminalHeight: state.terminalHeight,
        theme: state.theme,
        chatHistory: state.chatHistory,
        linkedProjects: state.linkedProjects,
      }),
      version: 3,
      migrate: (persistedState) => {
        if (!persistedState) return persistedState;
        return {
          ...persistedState,
          user: null,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setUser(null);
          state.setHydrated(true);
        }
      },
    }
  )
);
