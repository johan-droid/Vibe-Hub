import React, { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Terminal as TerminalIcon, Sparkles, Search as SearchIcon, Activity, ShieldAlert, Code2, Gauge } from 'lucide-react';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';
import { useMediaQuery } from '../hooks/useMediaQuery';

import Titlebar from '../features/shared/components/Titlebar';
import StatusBar from '../features/shared/components/StatusBar';
import SettingsModal from '../features/shared/components/SettingsModal';
import { Surface } from '../features/shared/components/Surface';
import { ResizeHandle } from '../features/shared/components/ResizeHandle';
import { NavIcon } from '../features/shared/components/NavIcon';
import { NeuralProjection } from '../features/shared/components/NeuralProjection';

import SidebarFileTree from '../features/editor/components/SidebarFileTree';
import ChatInterface from '../features/chat/components/ChatInterface';
import { EditorTabs } from '../features/editor/components/EditorTabs';
import { FileViewer } from '../features/editor/components/FileViewer';
import ActivityFeed from '../features/swarm/components/ActivityFeed';

const DiffViewer = React.lazy(() => import('../features/editor/components/DiffViewer'));
const Terminal = React.lazy(() => import('../features/editor/components/Terminal'));
const IntelligenceDashboard = React.lazy(() => import('../features/swarm/components/CommandCenterDashboard'));
const SecurityAudit = React.lazy(() => import('../features/security/components/SecurityAudit'));

const MIN_SIDEBAR_W = 220;
const MAX_SIDEBAR_W = 560;
const MIN_CHAT_W = 320;
const MAX_CHAT_W = 760;
const MIN_TERM_H = 140;
const MAX_TERM_H = 640;
const DEFAULT_TERM_H = 280;
const DEFAULT_SIDEBAR_W = 318;
const DEFAULT_CHAT_W = 420;

function SidebarPlaceholder({ icon: Icon, title, description }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant/35 bg-surface-container text-primary">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="title-medium">{title}</h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

export default function Workspace() {
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
  } = useStore();

  const [sidebarMode, setSidebarMode] = useState('explorer');
  const [mobileView, setMobileView] = useState('dashboard');
  const isMobile = useMediaQuery('(max-width: 768px)');
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

  const showMain = !isMobile || mobileView === 'dashboard' || mobileView === 'editor' || mobileView === 'terminal';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-container-lowest text-on-surface font-sans selection:bg-primary/20 selection:text-primary">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.08),transparent_32%),radial-gradient(circle_at_90%_18%,hsl(var(--secondary)/0.07),transparent_28%)]" />
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-surface-container-lowest/80">
        <div className="flex h-full shrink-0">
          <Surface
            elevation={0}
            className="fixed inset-x-0 bottom-0 z-40 flex h-16 flex-row items-center justify-around border-t border-outline-variant/30 bg-surface-container-lowest/92 px-3 backdrop-blur-2xl md:relative md:inset-auto md:h-auto md:w-[68px] md:flex-col md:justify-start md:gap-3 md:border-r md:border-t-0 md:py-5"
          >
            <NavIcon icon={Gauge} active={activeTab === 'dashboard' || mobileView === 'dashboard'} onClick={() => { setActiveTab('dashboard'); if (isMobile) setMobileView('dashboard'); }} ariaLabel="Dashboard" />
            <NavIcon icon={LayoutGrid} active={sidebarMode === 'explorer'} onClick={() => { setSidebarMode('explorer'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }} ariaLabel="Explorer" />
            <NavIcon icon={Activity} active={sidebarMode === 'swarm'} onClick={() => { setSidebarMode('swarm'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }} ariaLabel="Swarm Dashboard" />
            <NavIcon icon={SearchIcon} active={sidebarMode === 'search'} onClick={() => { setSidebarMode('search'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }} ariaLabel="Search" />
            <NavIcon icon={ShieldAlert} active={sidebarMode === 'security'} onClick={() => { setSidebarMode('security'); setSidebarCollapsed(false); if (isMobile) setMobileView('sidebar'); }} ariaLabel="Security Audit" />
            {isMobile && <NavIcon icon={TerminalIcon} active={mobileView === 'terminal'} onClick={() => setMobileView('terminal')} ariaLabel="Terminal" />}
            {isMobile && <NavIcon icon={Sparkles} active={mobileView === 'chat'} onClick={() => { setMobileView('chat'); setChatCollapsed(false); }} ariaLabel="Assistant" />}
            {isMobile && <NavIcon icon={Code2} active={mobileView === 'editor'} onClick={() => { setActiveTab('editor'); setMobileView('editor'); }} ariaLabel="Editor" />}
            <div className="mt-auto hidden md:block">
              <NavIcon icon={Sparkles} active={!chatCollapsed} onClick={() => setChatCollapsed(!chatCollapsed)} ariaLabel="Assistant" />
            </div>
          </Surface>

          <AnimatePresence initial={false}>
            {(!sidebarCollapsed && (!isMobile || mobileView === 'sidebar')) && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: isMobile ? '100vw' : sidebarW, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="absolute inset-0 z-30 flex h-[calc(100%-4rem)] shrink-0 flex-col overflow-hidden border-r border-outline-variant/30 bg-surface-container-low/95 shadow-2xl shadow-black/25 backdrop-blur-xl md:static md:h-full md:shadow-none"
              >
                <div className="min-h-0 flex-1">
                  <React.Suspense fallback={<div className="h-full animate-pulse bg-surface-container-low" />}>
                    {sidebarMode === 'explorer' && <SidebarFileTree />}
                    {sidebarMode === 'swarm' && <IntelligenceDashboard />}
                    {sidebarMode === 'search' && <SidebarPlaceholder icon={SearchIcon} title="Search is staged" description="The command surface is ready for a future global search index." />}
                    {sidebarMode === 'security' && <SecurityAudit />}
                  </React.Suspense>
                </div>
                {sidebarMode === 'explorer' && !isMobile && (
                  <div className="h-[34%] min-h-[220px] overflow-hidden border-t border-outline-variant/30 bg-surface-container-lowest/55">
                    <ActivityFeed />
                  </div>
                )}
                <ResizeHandle direction="horizontal" onDrag={onSidebarDrag} className="absolute right-0 top-0 hidden h-full w-1.5 hover:bg-primary/20 md:block" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <main className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest ${showMain ? '' : 'hidden'}`}>
          <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest ${(isMobile && mobileView === 'terminal') ? 'hidden' : ''}`}>
            {activeTab !== 'dashboard' && openFiles.length > 0 && <EditorTabs />}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {activeTab !== 'dashboard' && <NeuralProjection />}
              <React.Suspense fallback={<div className="h-full animate-pulse bg-surface-container-lowest" />}>
                {activeTab === 'dashboard' ? <IntelligenceDashboard /> : activeTab === 'diff' ? <DiffViewer onApply={() => {}} onDiscard={() => {}} /> : <FileViewer path={activeFilePath} content={activeFileContent} />}
              </React.Suspense>
            </div>
          </div>

          <div className="hidden md:block"><ResizeHandle direction="vertical" onDrag={onTerminalDrag} /></div>

          <Surface
            elevation={0}
            shape="none"
            className={`shrink-0 overflow-hidden border-t border-outline-variant/30 bg-surface-container-low/80 ${(isMobile && mobileView !== 'terminal') ? 'hidden' : ''}`}
            style={{ height: isMobile ? '100%' : terminalH }}
          >
            <div className="flex h-10 items-center justify-between border-b border-outline-variant/25 bg-surface-container/65 px-5 md:px-7">
              <div className="flex items-center gap-3">
                <TerminalIcon size={14} className="text-primary" />
                <span className="label-small text-on-surface-variant">Runtime</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary" /> Connected shell
              </div>
            </div>
            <div className="h-[calc(100%-40px)]">
              <React.Suspense fallback={<div className="h-full animate-pulse bg-black/30" />}>
                <Terminal />
              </React.Suspense>
            </div>
          </Surface>
        </main>

        <AnimatePresence initial={false}>
          {(!chatCollapsed && (!isMobile || mobileView === 'chat')) && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100vw' : chatW, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="absolute inset-0 z-30 h-[calc(100%-4rem)] shrink-0 overflow-hidden border-l border-outline-variant/30 bg-surface-container-lowest/96 shadow-[-24px_0_48px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl md:static md:h-full"
            >
              <ResizeHandle direction="horizontal" onDrag={onChatDrag} className="absolute left-0 top-0 hidden h-full w-1.5 hover:bg-primary/20 md:block" />
              <ChatInterface onSend={sendPrompt} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isMobile && <StatusBar />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
