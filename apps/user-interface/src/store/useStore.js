import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idbStorage';

export const useStore = create(
  persist(
    (set) => ({
      // AUTH STATE 
      user: null, // { id, email, name, avatarUrl, provider }
      hydrated: false,

      // LAYOUT STATE
      sidebarCollapsed: false,
      chatCollapsed: false,
      terminalHeight: 256,
      activeTab: 'diff',

      // AGENT STATE (volatile)
      messages: [],
      agentThoughts: [],
      isThinking: false,
      agentState: 'idle', // 'idle', 'thinking', 'reading', 'writing', 'debugging', 'verifying'
      statusMessage: '',
      activeFileContent: null,
      activeFilePath: null,
      vfsStatus: 'idle',
      visionScore: null,
      effortLevel: 'standard',
      diffData: null,
      terminalOutput: '',
      vfsTree: [],
      repoUrl: '',
      pendingClarification: null, // { clarificationId, questions, context }
      pendingPlan: null,          // { planId, steps, risks }

      // AUTH SETTERS
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('vibe_token');
        set({ user: null, messages: [], agentThoughts: [] });
      },

      // LAYOUT SETTERS
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setChatCollapsed: (v) => set({ chatCollapsed: v }),
      setTerminalHeight: (h) => set({ terminalHeight: h }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setHydrated: (v) => set({ hydrated: v }),

      // AGENT SETTERS
      setSettings: (s) => set({ ...s }),
      setEffortLevel: (l) => set({ effortLevel: l }),
      setDiffData: (d) => set({ diffData: d }),
      appendTerminalOutput: (d) => set((s) => ({ terminalOutput: s.terminalOutput + d })),
      setVfsTree: (t) => set({ vfsTree: t }),
      setThinking: (v) => set({ isThinking: v }),
      setVfsStatus: (v) => set({ vfsStatus: v }),
      setVisionScore: (v) => set({ visionScore: v }),
      setAgentStatus: (state, message) => set({ agentState: state, statusMessage: message || '' }),

      // ACTIONS
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setActiveFile: (path, content) => set({ activeFilePath: path, activeFileContent: content, activeTab: 'editor' }),
      addThought: (thought) => set((s) => ({ agentThoughts: [...s.agentThoughts, thought] })),
      clearThoughts: () => set({ agentThoughts: [] }),
      addClarification: (data) => set({ pendingClarification: data }),
      clearClarification: () => set({ pendingClarification: null }),
      addPlan: (data) => set({ pendingPlan: data }),
      clearPlan: () => set({ pendingPlan: null }),
    }),
    {
      name: 'vibehub-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        user: state.user,
        sidebarCollapsed: state.sidebarCollapsed,
        chatCollapsed: state.chatCollapsed,
        terminalHeight: state.terminalHeight,
        repoUrl: state.repoUrl,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true);
      },
    }
  )
);
