import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Terminal as TerminalIcon, Sparkles, Search as SearchIcon, Activity, ShieldAlert, Code2, Gauge, Sidebar as SidebarIcon, Cpu } from 'lucide-react';
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
const DEFAULT_SIDEBAR_W = 280;
const DEFAULT_CHAT_W = 400;

function SidebarPlaceholder({ icon: Icon, title, description }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/10 bg-on-surface/[0.02] text-primary/40">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="label-large uppercase tracking-widest opacity-80">{title}</h3>
        <p className="mt-2 max-w-xs body-small text-on-surface-variant/40 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function Workspace() {
  const location = useLocation();
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
  } = useStore();

  const [sidebarMode, setSidebarMode] = useState('explorer');
  const [mobileView, setMobileView] = useState('dashboard');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarW, setSidebarW] = useState(DEFAULT_SIDEBAR_W);
  const [chatW, setChatW] = useState(DEFAULT_CHAT_W);
  const [terminalH, setTerminalH] = useState(DEFAULT_TERM_H);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();
  const dashboardSegment = location.pathname.replace(/^\/dashboard\/?/, '').split('/')[0] || 'overview';
  const dashboardPages = new Set(['overview', 'activity', 'runtime', 'skills', 'security']);
  const isDashboardRoute = location.pathname.startsWith('/dashboard') && dashboardPages.has(dashboardSegment);
  const effectiveTab = dashboardSegment === 'editor' || dashboardSegment === 'diff' ? dashboardSegment : activeTab;

  const goDashboardPage = useCallback((page = 'overview') => {
    setActiveTab('dashboard');
    navigate(page === 'overview' ? '/dashboard' : `/dashboard/${page}`);
    if (isMobile) setMobileView('dashboard');
  }, [isMobile, navigate, setActiveTab]);

  const goWorkbench = useCallback(() => {
    setActiveTab('editor');
    navigate('/dashboard/editor');
    if (isMobile) setMobileView('editor');
  }, [isMobile, navigate, setActiveTab]);

  useEffect(() => {
    if ((dashboardSegment === 'editor' || dashboardSegment === 'diff') && activeTab === 'dashboard') {
      setActiveTab(dashboardSegment);
    } else if (isDashboardRoute && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [activeTab, dashboardSegment, isDashboardRoute, setActiveTab]);

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

  const isDashboardMode = isDashboardRoute || (activeTab === 'dashboard' && location.pathname === '/dashboard');
  const isWorkbenchMode = effectiveTab === 'editor' || effectiveTab === 'diff';

  return (
    <div className="isolate flex h-dvh w-full flex-col overflow-hidden bg-surface font-sans text-on-surface selection:bg-primary/10 selection:text-primary">
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="relative z-0 flex min-h-0 flex-1 overflow-hidden bg-surface">
        <div className="fixed inset-x-0 bottom-0 z-40 flex h-14 flex-row items-center justify-around border-t border-outline-variant bg-surface-container-lowest/95 px-3 backdrop-blur-xl md:relative md:inset-auto md:h-auto md:w-14 md:shrink-0 md:flex-col md:justify-start md:gap-3 md:border-r md:border-t-0 md:py-4">
          <NavIcon icon={Gauge} active={isDashboardMode && dashboardSegment === 'overview'} onClick={() => goDashboardPage('overview')} ariaLabel="Overview" />
          <NavIcon icon={LayoutGrid} active={isWorkbenchMode} onClick={goWorkbench} ariaLabel="Workbench" />
          <NavIcon icon={Activity} active={isDashboardMode && dashboardSegment === 'activity'} onClick={() => goDashboardPage('activity')} ariaLabel="Activity" />
          <NavIcon icon={Code2} active={isDashboardMode && dashboardSegment === 'runtime'} onClick={() => goDashboardPage('runtime')} ariaLabel="Runtime" />
          
          <div className="mx-2 hidden h-px w-6 bg-outline-variant md:block" />
          
          <NavIcon 
            icon={SidebarIcon} 
            active={!sidebarCollapsed && isWorkbenchMode} 
            onClick={() => { if (!isWorkbenchMode) goWorkbench(); setSidebarCollapsed(!sidebarCollapsed); }} 
            ariaLabel="Sidebar" 
          />
          
          {isMobile && <NavIcon icon={TerminalIcon} active={mobileView === 'terminal'} onClick={() => { goWorkbench(); setMobileView('terminal'); }} ariaLabel="Terminal" />}
          
          <div className="mt-auto hidden md:block">
            <NavIcon icon={Sparkles} active={!chatCollapsed && isWorkbenchMode} onClick={() => { if (!isWorkbenchMode) goWorkbench(); setChatCollapsed(!chatCollapsed); }} ariaLabel="Assistant" />
          </div>
        </div>

        {/* ── Main Viewport ── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {/* Dashboard Mode */}
          {!isWorkbenchMode && (
              <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface pb-14 md:pb-0">
              <React.Suspense fallback={<div className="h-full animate-pulse bg-surface" />}>
                <IntelligenceDashboard page={isDashboardRoute && dashboardPages.has(dashboardSegment) ? dashboardSegment : 'overview'} />
              </React.Suspense>
            </main>
          )}

          {/* Workbench Mode */}
          {isWorkbenchMode && (
            <div className="flex h-full w-full overflow-hidden">
              {/* Sidebar */}
              <AnimatePresence initial={false}>
                {(!sidebarCollapsed && (!isMobile || mobileView === 'sidebar')) && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isMobile ? '100vw' : sidebarW }}
                    exit={{ width: 0 }}
                    transition={{ type: 'spring', damping: 35, stiffness: 400 }}
                    className="relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-r border-outline-variant bg-surface-container-lowest"
                  >
                    <div className="min-h-0 flex-1">
                      <React.Suspense fallback={<div className="h-full animate-pulse bg-surface" />}>
                        {sidebarMode === 'explorer' && <SidebarFileTree />}
                        {sidebarMode === 'swarm' && <IntelligenceDashboard page="activity" />}
                      </React.Suspense>
                    </div>
                    {sidebarMode === 'explorer' && !isMobile && (
                      <div className="h-[30%] min-h-[180px] overflow-hidden border-t border-outline-variant bg-surface-container-low">
                        <ActivityFeed />
                      </div>
                    )}
                    <ResizeHandle direction="horizontal" onDrag={onSidebarDrag} className="absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Editor + Terminal */}
              <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
                <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${(isMobile && mobileView === 'terminal') ? 'hidden' : ''}`}>
                  {openFiles.length > 0 && <EditorTabs />}
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <NeuralProjection />
                    <div className="relative z-10 h-full">
                      <React.Suspense fallback={<div className="h-full animate-pulse bg-surface-container-lowest" />}>
                        {effectiveTab === 'diff' ? <DiffViewer onApply={() => {}} onDiscard={() => {}} /> : <FileViewer path={activeFilePath} content={activeFileContent} />}
                      </React.Suspense>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block">
                  <ResizeHandle direction="vertical" onDrag={onTerminalDrag} className="h-1 cursor-row-resize transition-colors hover:bg-primary/20" />
                </div>

                <div 
                  className={`shrink-0 overflow-hidden border-t border-outline-variant bg-surface-container-lowest ${(isMobile && mobileView !== 'terminal') ? 'hidden' : ''}`}
                  style={{ height: isMobile ? '100%' : terminalH }}
                >
                  <div className="flex h-9 items-center justify-between border-b border-outline-variant bg-surface-container-low px-4">
                    <div className="flex items-center gap-2">
                      <TerminalIcon size={13} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-normal text-on-surface-variant">Terminal</span>
                    </div>
                    <div className="hidden items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-on-surface-variant/70 sm:flex">
                      <span className="flex items-center gap-1.5"><Cpu size={10} /> BUS: 0x24</span>
                      <span>Link: active</span>
                    </div>
                  </div>
                  <div className="h-[calc(100%-36px)]">
                    <React.Suspense fallback={<div className="h-full animate-pulse bg-black/10" />}>
                      <Terminal />
                    </React.Suspense>
                  </div>
                </div>
              </main>

              {/* Chat Panel */}
              <AnimatePresence initial={false}>
                {(!chatCollapsed && (!isMobile || mobileView === 'chat')) && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isMobile ? '100vw' : chatW }}
                    exit={{ width: 0 }}
                    transition={{ type: 'spring', damping: 35, stiffness: 400 }}
                    className="relative z-30 h-full shrink-0 overflow-hidden border-l border-outline-variant bg-surface-container-lowest"
                  >
                    <ResizeHandle direction="horizontal" onDrag={onChatDrag} className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors" />
                    <ChatInterface onSend={sendPrompt} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {!isMobile && <StatusBar />}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
