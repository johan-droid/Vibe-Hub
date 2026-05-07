import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal as TerminalIcon, 
  Sparkles, 
  Search as SearchIcon, 
  Activity, 
  ShieldAlert, 
  Code2, 
  Sidebar as SidebarIcon, 
  Cpu,
  MessageSquare,
  Plug,
  Layout
} from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';
import { useMediaQuery } from '../hooks/useMediaQuery';

import Titlebar from '../features/shared/components/Titlebar';
import StatusBar from '../features/shared/components/StatusBar';
import SettingsModal from '../features/shared/components/SettingsModal';
import { Surface } from '../features/shared/components/Surface';
import { ResizeHandle } from '../features/shared/components/ResizeHandle';
import { NavIcon } from '../features/shared/components/NavIcon';
import NeuralProjection from '../features/shared/components/NeuralProjection';

import ChatHistorySidebar from '../features/chat/components/ChatHistorySidebar';
import ConnectorsPanel from '../features/chat/components/ConnectorsPanel';
import ChatInterface from '../features/chat/components/ChatInterface';
import { EditorTabs } from '../features/editor/components/EditorTabs';
import { FileViewer } from '../features/editor/components/FileViewer';
import ActivityFeed from '../features/swarm/components/ActivityFeed';
import TerminalSessionsPanel from '../features/terminal/components/TerminalSessionsPanel';

const DiffViewer = React.lazy(() => import('../features/editor/components/DiffViewer'));

const MIN_SIDEBAR_W = 260;
const MAX_SIDEBAR_W = 400;
const MIN_CHAT_W = 400;
const MAX_CHAT_W = 1000;
const DEFAULT_SIDEBAR_W = 280;
const DEFAULT_CONNECTORS_W = 320;

export default function Workspace() {
  const navigate = useNavigate();
  const {
    user,
    sidebarCollapsed,
    setSidebarCollapsed,
    chatCollapsed,
    setChatCollapsed,
    setActiveTab,
    activeTab,
    activeFileContent,
    activeFilePath,
    openFiles,
    terminalPanelVisible,
    toggleTerminalPanel,
  } = useStore();

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarW, setSidebarW] = useState(DEFAULT_SIDEBAR_W);
  const [connectorsW, setConnectorsW] = useState(DEFAULT_CONNECTORS_W);
  const [terminalH, setTerminalH] = useState(240);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();

  const [viewMode, setViewMode] = useState('chat'); // 'chat' or 'editor'

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+` to toggle terminal panel
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminalPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTerminalPanel]);

  const onSidebarDrag = useCallback((delta) => {
    setSidebarW((w) => Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, w + delta)));
  }, []);

  const onConnectorsDrag = useCallback((delta) => {
    setConnectorsW((w) => Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, w - delta)));
  }, []);

  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(140, Math.min(600, h - delta)));
  }, []);

  return (
    <div className="isolate flex h-dvh w-full flex-col overflow-hidden bg-surface font-sans text-on-surface selection:bg-primary/10 selection:text-primary">
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="relative z-0 flex min-h-0 flex-1 overflow-hidden bg-surface">
        {/* ── Fixed Sidebar Strip ── */}
        <div className="hidden md:flex relative z-40 w-14 shrink-0 flex-col items-center py-4 border-r border-outline-variant bg-surface-container-lowest/95 backdrop-blur-xl gap-4">
          <NavIcon icon={MessageSquare} active={viewMode === 'chat'} onClick={() => setViewMode('chat')} ariaLabel="Chat" />
          <NavIcon icon={Code2} active={viewMode === 'editor'} onClick={() => setViewMode('editor')} ariaLabel="Editor" />
          <div className="mx-2 h-px w-6 bg-outline-variant" />
          <NavIcon icon={SidebarIcon} active={!sidebarCollapsed} onClick={() => setSidebarCollapsed(!sidebarCollapsed)} ariaLabel="History" />
          <NavIcon icon={Plug} active={!chatCollapsed} onClick={() => setChatCollapsed(!chatCollapsed)} ariaLabel="Connectors" />
          
          <div className="mt-auto">
            <NavIcon icon={Sparkles} active={false} onClick={() => {}} ariaLabel="Ai Pulse" />
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          
          {/* Left Sidebar: Chat History */}
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && !isMobile && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: sidebarW }}
                exit={{ width: 0 }}
                transition={{ type: 'spring', damping: 35, stiffness: 400 }}
                className="relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-r border-outline-variant"
              >
                <ChatHistorySidebar />
                <ResizeHandle direction="horizontal" onDrag={onSidebarDrag} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Workspace */}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
            
            {/* View Switching */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              
              {/* Chat View */}
              <AnimatePresence mode="wait">
                {viewMode === 'chat' ? (
                  <motion.div 
                    key="chat-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex-1 h-full overflow-hidden flex flex-col"
                  >
                    <ChatInterface onSend={sendPrompt} />
                  </motion.div>
                ) : (
                  /* Editor View */
                  <motion.div 
                    key="editor-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex-1 h-full overflow-hidden flex flex-col"
                  >
                    {openFiles.length > 0 ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        <EditorTabs />
                        <div className="relative flex-1 min-h-0 overflow-hidden">
                          <NeuralProjection />
                          <div className="relative z-10 h-full">
                            <React.Suspense fallback={<div className="h-full animate-pulse bg-surface-container-lowest" />}>
                              {activeTab === 'diff' ? <DiffViewer onApply={() => {}} onDiscard={() => {}} /> : <FileViewer path={activeFilePath} content={activeFileContent} />}
                            </React.Suspense>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-center">
                        <div className="max-w-xs">
                          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant/20">
                            <Layout size={32} />
                          </div>
                          <h3 className="text-xl font-black text-on-surface mb-2">No files open</h3>
                          <p className="text-sm font-medium text-on-surface-variant/40">Select a file from the explorer or ask the assistant to generate code.</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Internal Terminal Sessions - Hidden by default, toggle with Ctrl+` */}
            <AnimatePresence>
              {terminalPanelVisible && <TerminalSessionsPanel />}
            </AnimatePresence>
          </main>

          {/* Right Sidebar: Connectors */}
          <AnimatePresence initial={false}>
            {!chatCollapsed && !isMobile && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: connectorsW }}
                exit={{ width: 0 }}
                transition={{ type: 'spring', damping: 35, stiffness: 400 }}
                className="relative z-30 flex h-full shrink-0 flex-col overflow-hidden"
              >
                <ResizeHandle direction="horizontal" onDrag={onConnectorsDrag} className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors" />
                <ConnectorsPanel />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {!isMobile && <StatusBar />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
