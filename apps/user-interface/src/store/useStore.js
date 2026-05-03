import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';
import { v4 as uuid } from 'uuid';

/**
 * Vibe Hub Global State Store — Principal Architect Implementation
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
      activeTab: 'diff',
      theme: 'dark', // 'dark' | 'light'

      // --- AGENT CORE STATE (Volatile) ---
      messages: [],
      streamingMessage: null, // Atomic storage for byte-by-byte updates
      agentThoughts: [],
      isThinking: false,
      workflowState: null, // Track remote github actions
      setWorkflowState: (state) => set({ workflowState: state }),
      
      // Neural Status (Current Expert Context)
      neuralStatus: {
        expert: 'core', // 'core', 'react', 'debugging', 'planning', etc.
        phase: 'idle',  // 'idle', 'classifying', 'executing', 'streaming'
        lastAction: '',
        waitingForGitHub: false,
      },

      // Agent state for AgentNeuralStatus
      agentState: 'idle',
      statusMessage: '',
      effortLevel: 'standard',
      // BUG #10 FIX: terminalOutput was an ever-growing string appended on every
      // sandbox stdout chunk. On a 60s timeout at 1000 lines/sec it accumulates
      // ~60MB in React state, with Zustand triggering a full re-render per chunk.
      // Changed to a capped circular line buffer (2000 lines max). Terminal.jsx
      // joins lines with '\n' on render instead of storing the joined string.
      terminalOutput: [], // Array<string>, max MAX_TERMINAL_LINES entries

      // VFS & Code State
      vfsTree: [],
      openFiles: [], // Array<{ path, content, dirty }>
      activeFilePath: null,
      activeFileContent: null,
      diffData: null, // { path, oldValue, newValue }
      
      // --- SETTERS & ACTIONS ---

      // Auth
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('vibe_token');
        set({ user: null, messages: [], agentThoughts: [], streamingMessage: null });
      },

      // Layout
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setChatCollapsed: (v) => set({ chatCollapsed: v }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setHydrated: (v) => set({ hydrated: v }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

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

      // BUG #9 companion fix: stamp each message with a stable uuid so
      // AnimatePresence in ChatInterface.jsx can use m.id as the React key.
      // Index-based keys cause full remount of all historical messages on insert.
      addMessage: (msg) => set((state) => ({
        messages: [...state.messages, { id: uuid(), ...msg }]
      })),

      setThinking: (v) => set({ isThinking: v }),

      // Neural Status Updates
      updateNeuralStatus: (status) => set((state) => ({
        neuralStatus: { ...state.neuralStatus, ...status }
      })),

      // VFS & Code
      setVfsTree: (tree) => set({ vfsTree: tree }),
      
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
          activeTab: nextPath ? 'editor' : state.activeTab
        };
      }),

      setActiveFile: (path, content) => {
        useStore.getState().openFile(path, content);
      },
      setDiffData: (diff) => set({ diffData: diff, activeTab: 'diff' }),

      // BUG #10 FIX: O(1) append with 2000-line eviction.
      // Terminal.jsx must join with '\n': const text = terminalOutput.join('\n');
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

      // Agent status (used by useAgent.js and AgentNeuralStatus)
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
      addThought: (thought) => set((state) => ({ 
        agentThoughts: [...state.agentThoughts, { ...thought, timestamp: Date.now() }] 
      })),
      clearThoughts: () => set({ agentThoughts: [] }),
    }),
    {
      name: 'vibehub-neural-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        user: state.user,
        sidebarCollapsed: state.sidebarCollapsed,
        chatCollapsed: state.chatCollapsed,
        terminalHeight: state.terminalHeight,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true);
      },
    }
  )
);
