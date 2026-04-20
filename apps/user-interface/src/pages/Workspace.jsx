import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import FileTree from '../components/FileTree';
import ChatInterface from '../components/ChatInterface';
import DiffViewer from '../components/DiffViewer';
import Terminal from '../components/Terminal';
import SettingsModal from '../components/SettingsModal';
import Titlebar from '../components/Titlebar';
import StatusBar from '../components/StatusBar';
import ActivityFeed from '../components/ActivityFeed';
import AgentNeuralStatus from '../components/AgentNeuralStatus';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';

/**
 * Workspace — The protected IDE cockpit.
 * Only accessible after authentication.
 */
export default function Workspace() {
  const {
    user, sidebarCollapsed, chatCollapsed, terminalHeight,
    activeTab, activeFileContent, activeFilePath
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();

  // Redirect to landing if not authenticated
  if (!user && !localStorage.getItem('vibe_token')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-surface-dim text-white font-sans overflow-hidden">
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col border-r border-white/[0.06] surface overflow-hidden"
            >
              <div className="flex-1 overflow-hidden">
                <FileTree />
              </div>
              <div className="h-2/5 min-h-[180px]">
                <ActivityFeed />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Editor / Diff */}
        <div className="flex-1 flex flex-col min-w-0 surface-dim">
          <div className="flex-1 relative overflow-hidden">
            {activeTab === 'diff' ? (
              <DiffViewer onRecure={sendPrompt} />
            ) : (
              <div className="h-full flex flex-col">
                <div className="h-10 border-b border-white/[0.06] surface-container flex items-center px-4 gap-2">
                  <div className="px-3 py-1 surface-container-high border border-white/[0.06] rounded-lg text-[10px] font-mono text-primary">
                    {activeFilePath || 'no_file_active'}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden p-8">
                  {activeFileContent ? (
                    <pre className="font-mono text-sm text-white/70 leading-relaxed overflow-auto h-full">
                      <code>{activeFileContent}</code>
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white/10 font-mono text-xs uppercase tracking-[0.4em]">
                      select a file to view
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Terminal */}
          <div
            style={{ height: terminalHeight }}
            className="border-t border-white/[0.06] surface-dim relative"
          >
            <div
              className="absolute -top-1 inset-x-0 h-2 cursor-ns-resize hover:bg-primary/20 transition-colors z-20"
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startH = terminalHeight;
                const onMove = (ev) => {
                  const delta = startY - ev.clientY;
                  useStore.getState().setTerminalHeight(Math.max(100, Math.min(600, startH + delta)));
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
            {/* Neural Status Overlay */}
            <div className="absolute bottom-6 right-6 z-[60]">
              <AgentNeuralStatus />
            </div>
            
            <Terminal />
          </div>
        </div>

        {/* Right Sidebar: Chat */}
        <AnimatePresence>
          {!chatCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/[0.06] surface"
            >
              <ChatInterface onSend={sendPrompt} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StatusBar />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
