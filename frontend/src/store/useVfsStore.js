import { create } from 'zustand';
import { OrchestratorSocket } from '../services/socket';
import { api } from '../services/api';

/**
 * Virtual File System (VFS) State Manager
 * 
 * Holds agent-proposed code in memory (staging area) instead of writing
directly to disk. User must approve changes via DiffViewer before physical commit.
 */

// Create socket instance for VFS WebSocket listener
const vfsSocket = new OrchestratorSocket();

export const useVfsStore = create((set, get) => ({
  // Staging state
  activeDiff: null, // { filePath, originalContent, proposedContent, metadata }
  isReviewing: false,
  pendingFiles: [], // Array of staged files awaiting review
  vfsStats: { total: 0, pending: 0, approved: 0, rejected: 0, committed: 0 },

  /**
   * Stage proposed changes from agent (called via WebSocket)
   */
  stageProposedChanges: (filePath, originalContent, proposedContent, metadata = {}) => {
    const entry = {
      filePath,
      originalContent,
      proposedContent,
      metadata,
      stagedAt: new Date().toISOString()
    };

    set((state) => ({
      activeDiff: entry,
      isReviewing: true,
      pendingFiles: [...state.pendingFiles, entry]
    }));

    console.log('[VFS] Staged for review:', filePath);
  },

  /**
   * Discard/reject changes (physical disk untouched)
   */
  discardChanges: async () => {
    const { activeDiff } = get();
    if (!activeDiff) return;

    try {
      await api.post('/api/fs/commit', {
        filePath: activeDiff.filePath,
        approved: false
      });

      set((state) => ({
        activeDiff: null,
        isReviewing: false,
        pendingFiles: state.pendingFiles.filter(f => f.filePath !== activeDiff.filePath)
      }));

      console.log('[VFS] Changes rejected:', activeDiff.filePath);
    } catch (error) {
      console.error('[VFS] Failed to reject changes:', error);
    }
  },

  /**
   * Commit approved changes to physical disk
   * This is the ONLY operation that triggers actual fs.writeFile
   */
  commitToPhysicalDisk: async () => {
    const { activeDiff } = get();
    if (!activeDiff) return;

    try {
      const result = await api.post('/api/fs/commit', {
        filePath: activeDiff.filePath,
        approved: true
      });

      // Clear VFS after successful physical write
      set((state) => ({
        activeDiff: null,
        isReviewing: false,
        pendingFiles: state.pendingFiles.filter(f => f.filePath !== activeDiff.filePath)
      }));

      console.log('[VFS] Committed to disk:', activeDiff.filePath, result.committedAt);
      return result;

    } catch (error) {
      console.error('[VFS] Commit failed:', error);
      throw error;
    }
  },

  /**
   * Fetch pending files from backend VFS
   */
  fetchPendingFiles: async () => {
    try {
      const data = await api.get('/api/fs/pending');
      
      if (data.success) {
        set({ pendingFiles: data.files });
      }
    } catch (error) {
      console.error('[VFS] Failed to fetch pending files:', error);
    }
  },

  /**
   * Fetch VFS statistics
   */
  fetchVfsStats: async () => {
    try {
      const data = await api.get('/api/fs/stats');
      
      if (data.success) {
        set({ vfsStats: data.stats });
      }
    } catch (error) {
      console.error('[VFS] Failed to fetch stats:', error);
    }
  },

  /**
   * Select a specific file for review from pending list
   */
  selectFileForReview: (filePath) => {
    const { pendingFiles } = get();
    const file = pendingFiles.find(f => f.filePath === filePath);
    if (file) {
      set({ activeDiff: file, isReviewing: true });
    }
  },

  /**
   * Clear active diff view
   */
  clearActiveDiff: () => {
    set({ activeDiff: null, isReviewing: false });
  }
}));

// Wire the WebSocket listener outside React component lifecycle
// This ensures we never miss an orchestration payload
let socketInitialized = false;

export const initializeVfsSocket = (userId = null) => {
  if (socketInitialized) return;
  
  vfsSocket.connect(userId);

  // Listen for file staging events from backend
  vfsSocket.on('file_staged', (data) => {
    console.log('[VFS Socket] File staged:', data.filePath);
    useVfsStore.getState().stageProposedChanges(
      data.filePath,
      data.originalContent,
      data.proposedContent,
      data.metadata
    );
  });

  // Listen for agent status to track orchestration progress
  vfsSocket.on('agent_status', (data) => {
    if (data.status === 'success') {
      console.log('[VFS Socket] Agent completed, awaiting file staging...');
    }
  });

  socketInitialized = true;
  console.log('[VFS] Socket listener initialized');
};

export default useVfsStore;
