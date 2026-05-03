import React, { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Terminal as TerminalIcon, Sparkles, Search as SearchIcon, Activity, ShieldAlert } from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';
import { useMediaQuery } from '../hooks/useMediaQuery';

// Layout & UI
import Titlebar from '../features/shared/components/Titlebar';
import StatusBar from '../features/shared/components/StatusBar';
import SettingsModal from '../features/shared/components/SettingsModal';
import { Surface } from '../features/shared/components/Surface';
import { ResizeHandle } from '../features/shared/components/ResizeHandle';
import { NavIcon } from '../features/shared/components/NavIcon';
import { NeuralProjection } from '../features/shared/components/NeuralProjection';

// Feature Components (Static)
import SidebarFileTree from '../features/editor/components/SidebarFileTree';
import ChatInterface from '../features/chat/components/ChatInterface';
import { EditorTabs } from '../features/editor/components/EditorTabs';
import { FileViewer } from '../features/editor/components/FileViewer';

// Feature Components (Lazy Load for Performance)
const DiffViewer = React.lazy(() => import('../features/editor/components/DiffViewer'));
const Terminal = React.lazy(() => import('../features/editor/components/Terminal'));
const IntelligenceDashboard = React.lazy(() => import('../features/swarm/components/Dashboard'));
const SecurityAudit = React.lazy(() => import('../features/security/components/SecurityAudit'));

// ─── Constants ─────────────────────────────────────────────────────────────────
const NAV_RAIL_W = 64;
const MIN_SIDEBAR_W = 200;
const MAX_SIDEBAR_W = 600;
const MIN_CHAT_W = 300;
const MAX_CHAT_W = 800;
const MIN_TERM_H = 140;  
const MAX_TERM_H = 700;  
const DEFAULT_TERM_H = 300;
const DEFAULT_SIDEBAR_W = 320;
const DEFAULT_CHAT_W = 440;

// ─── Workspace ─────────────────────────────────────────────────────────────────
export default function Workspace() {
  const {
    user,
    sidebarCollapsed,
    setSidebarCollapsed,
    chatCollapsed,
    setChatCollapsed,
    activeTab,
    activeFileContent, activeFilePath,
  } = useStore();

  const [sidebarMode, setSidebarMode] = useState('explorer'); // 'explorer', 'swarm', 'search'
  const [mobileView, setMobileView] = useState('editor'); // 'sidebar', 'editor', 'chat', 'terminal'
  const isMobile = useMediaQuery('(max-width: 768px)'); // 'explorer', 'swarm', 'search'
  const [sidebarW, setSidebarW] = useState(DEFAULT_SIDEBAR_W);
  const [chatW, setChatW] = useState(DEFAULT_CHAT_W);
  const [terminalH, setTerminalH] = useState(DEFAULT_TERM_H);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();

  const onSidebarDrag = useCallback((delta) => {
    setSidebarW((w) => Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, w + delta)));
  }, []);

  const onChatDrag = useCallback((delta) => {
    setChatW((w) => Math.max(MIN_CHAT_W, Math.min(MAX_CHAT_W, w - delta)));
  }, []);

  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(MIN_TERM_H, Math.min(MAX_TERM_H, h - delta)));
  }, []);

  if (!user && !localStorage.getItem('selina_token')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-surface-container-lowest text-on-surface overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden min-h-0 bg-surface">
        {/* LEFT: Nav Rail & Sidebar */}
        <div className="flex shrink-0 h-full">
          {/* Nav Rail */}
          <Surface 
            elevation={1} 
            className="fixed bottom-0 inset-x-0 h-16 flex-row md:relative md:w-[64px] md:h-auto flex md:flex-col items-center md:py-6 justify-around md:justify-start gap-2 md:gap-6 border-t md:border-t-0 md:border-r border-outline-variant/10 bg-surface-container-lowest z-40"
          >
            <NavIcon 
              icon={LayoutGrid} 
              active={sidebarMode === 'explorer'} 
              onClick={() => { setSidebarMode('explorer'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }}
            />
            <NavIcon 
              icon={Activity} 
              active={sidebarMode === 'swarm'} 
              onClick={() => { setSidebarMode('swarm'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }}
            />
            <NavIcon 
              icon={SearchIcon} 
              active={sidebarMode === 'search'} 
              onClick={() => { setSidebarMode('search'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }}
            />
            <NavIcon
              icon={ShieldAlert}
              active={sidebarMode === 'security'}
              onClick={() => { setSidebarMode('security'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }}
            />

            {isMobile && (
              <NavIcon
                icon={TerminalIcon}
                active={mobileView === 'terminal'}
                onClick={() => setMobileView('terminal')}
              />
            )}
            {isMobile && (
              <NavIcon
                icon={Activity}
                active={mobileView === 'chat'}
                onClick={() => { setMobileView('chat'); setChatCollapsed(false); }}
              />
            )}
            {isMobile && (
              <NavIcon
                icon={LayoutGrid}
                active={mobileView === 'editor'}
                onClick={() => setMobileView('editor')}
              />
            )}

            <div className="md:mt-auto hidden md:block">
               <NavIcon icon={Sparkles} />
            </div>
          </Surface>

          <AnimatePresence initial={false}>
            {(!sidebarCollapsed && (!isMobile || mobileView === 'sidebar')) && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: isMobile ? '100vw' : sidebarW, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="flex flex-col shrink-0 overflow-hidden border-r border-outline-variant/20 bg-surface-container-low relative z-30 md:z-auto absolute md:static inset-0 md:inset-auto h-[calc(100%-4rem)] md:h-full bg-surface"
              >
                <div className="flex-1 min-h-0">
                  <React.Suspense fallback={<div className="h-full bg-surface-container-low animate-pulse" />}>
                    {sidebarMode === 'explorer' && <SidebarFileTree />}
                    {sidebarMode === 'swarm' && <IntelligenceDashboard />}
                    {sidebarMode === 'search' && (
                      <div className="p-8 flex flex-col items-center justify-center h-full opacity-20 gap-4">
                        <SearchIcon size={32} />
                        <span className="label-small font-bold uppercase tracking-widest">Global_Search_Pending</span>
                      </div>
                    )}
                    {sidebarMode === 'security' && <SecurityAudit />}
                  </React.Suspense>
                </div>
                {sidebarMode === 'explorer' && (
                  <div className="h-[35%] min-h-[240px] border-t border-outline-variant/20 overflow-hidden bg-surface-container-lowest/50">
                    <IntelligenceDashboard />
                  </div>
                )}
                
                <ResizeHandle 
                  direction="horizontal" 
                  onDrag={onSidebarDrag} 
                  className="absolute right-0 top-0 h-full w-1.5 hover:bg-primary/20 hidden md:block"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CENTER: Editor & Terminal */}
        <main className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-surface-container-lowest relative z-10 ${(isMobile && mobileView !== 'editor' && mobileView !== 'terminal') ? 'hidden' : ''}`}>
          <div className={`flex-1 min-h-0 relative flex flex-col bg-surface-container-lowest shadow-inner ${(isMobile && mobileView === 'terminal') ? 'hidden' : ''}`}>
            <EditorTabs />
            <div className="flex-1 min-h-0 relative">
              <NeuralProjection />
              <React.Suspense fallback={<div className="h-full bg-surface-container-lowest animate-pulse" />}>
                {activeTab === 'diff' ? (
                  <DiffViewer onApply={() => {}} onDiscard={() => {}} />
                ) : (
                  <FileViewer path={activeFilePath} content={activeFileContent} />
                )}
              </React.Suspense>
            </div>
          </div>

          <div className="hidden md:block"><ResizeHandle direction="vertical" onDrag={onTerminalDrag} /></div>
          
          <Surface 
            elevation={1} 
            shape="none" 
            className={`shrink-0 overflow-hidden border-t border-outline-variant/20 bg-surface-container-low ${(isMobile && mobileView !== 'terminal') ? 'hidden' : ''}`}
            style={{ height: isMobile ? '100%' : terminalH }}
          >
            <div className="h-10 px-8 flex items-center justify-between bg-surface-container-high/40 border-b border-outline-variant/10">
               <div className="flex items-center gap-3">
                  <TerminalIcon size={14} className="text-primary opacity-60" />
                  <span className="label-small font-bold text-on-surface-variant uppercase tracking-[0.2em]">Neural_Runtime</span>
               </div>
               <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/30" />
                  <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/30" />
                  <div className="w-1.5 h-1.5 rounded-full bg-outline-variant/30" />
               </div>
            </div>
            <div className="h-[calc(100%-40px)]">
              <React.Suspense fallback={<div className="h-full bg-black/40 animate-pulse" />}>
                <Terminal />
              </React.Suspense>
            </div>
          </Surface>
        </main>

        {/* RIGHT: Chat Interface */}
        <AnimatePresence initial={false}>
          {(!chatCollapsed && (!isMobile || mobileView === 'chat')) && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100vw' : chatW, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="shrink-0 border-l border-outline-variant/20 overflow-hidden bg-surface-container-lowest shadow-[-20px_0_40px_-20px_rgba(0,0,0,0.2)] relative z-30 md:z-auto absolute md:static inset-0 md:inset-auto h-[calc(100%-4rem)] md:h-full bg-surface"
            >
              <ResizeHandle 
                direction="horizontal" 
                onDrag={onChatDrag} 
                className="absolute left-0 top-0 h-full w-1.5 hover:bg-primary/20 hidden md:block"
              />
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
