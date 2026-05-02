import React, { useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, FileCode2, LayoutGrid } from 'lucide-react';
import FileTree from '../components/FileTree';
import ChatInterface from '../components/ChatInterface';
import DiffViewer from '../components/DiffViewer';
import Terminal from '../components/Terminal';
import SettingsModal from '../components/SettingsModal';
import Titlebar from '../components/Titlebar';
import StatusBar from '../components/StatusBar';
import IntelligenceDashboard from '../components/IntelligenceDashboard';
import AgentNeuralStatus from '../components/AgentNeuralStatus';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';

// ─── Constants ─────────────────────────────────────────────────────────────────
const SIDEBAR_W = 260;   // px — left explorer panel
const CHAT_W    = 380;   // px — right chat panel
const MIN_TERM_H = 80;   // px
const MAX_TERM_H = 560;  // px
const DEFAULT_TERM_H = 220; // px

// ─── Draggable Resize Handle ───────────────────────────────────────────────────
// A zero-cost resize handle: uses pointer events (not mousemove) for smoother
// dragging. The onDrag callback receives the signed pixel delta.
function ResizeHandle({ direction = 'vertical', onDrag, className = '' }) {
  const isDragging = useRef(false);
  const origin = useRef(0);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    origin.current = direction === 'vertical' ? e.clientY : e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [direction]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const current = direction === 'vertical' ? e.clientY : e.clientX;
    const delta = current - origin.current;
    origin.current = current;
    onDrag(delta);
  }, [direction, onDrag]);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const isV = direction === 'vertical';
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={[
        'group shrink-0 relative z-20 transition-colors select-none',
        isV ? 'h-1.5 w-full cursor-ns-resize' : 'w-1.5 h-full cursor-ew-resize',
        'hover:bg-cyan-500/20 active:bg-cyan-500/40',
        className,
      ].join(' ')}
    >
      {/* Visual line */}
      <div
        className={[
          'absolute inset-0 m-auto transition-all duration-150',
          isV ? 'h-px w-full group-hover:h-0.5' : 'w-px h-full group-hover:w-0.5',
          'bg-neutral-800 group-hover:bg-cyan-500/50',
        ].join(' ')}
      />
    </div>
  );
}

// ─── File Viewer Panel ─────────────────────────────────────────────────────────
// Shows syntax-highlighted file content from the VFS.
const FileViewer = React.memo(function FileViewer({ path, content }) {
  const language = React.useMemo(() => {
    if (!path) return 'text';
    const ext = path.split('.').pop()?.toLowerCase();
    const MAP = { js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
                  json: 'json', css: 'css', scss: 'scss', md: 'markdown',
                  sh: 'bash', py: 'python', html: 'html' };
    return MAP[ext] ?? 'text';
  }, [path]);

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20">
        <LayoutGrid size={32} className="text-neutral-600" />
        <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-[0.4em]">
          Select_a_file
        </span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Tab bar showing active file path */}
      <div className="h-10 border-b border-neutral-800/60 flex items-center px-4 gap-2 bg-neutral-950 shrink-0">
        <FileCode2 size={13} className="text-cyan-500" />
        <span className="text-[11px] font-mono text-neutral-400 truncate">{path}</span>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers
        wrapLines={false}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '11px',
          lineHeight: '1.7',
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          minHeight: '100%',
        }}
        lineNumberStyle={{ color: '#3f3f46', minWidth: '3em', paddingRight: '1.5em' }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
});

// ─── Workspace ─────────────────────────────────────────────────────────────────
export default function Workspace() {
  const {
    user,
    sidebarCollapsed, setSidebarCollapsed,
    chatCollapsed,    setChatCollapsed,
    activeTab,        setActiveTab,
    activeFileContent, activeFilePath,
    diffData,
  } = useStore();

  const [terminalH, setTerminalH] = useState(DEFAULT_TERM_H);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();

  // Guard: redirect unauthenticated visitors
  if (!user && !localStorage.getItem('vibe_token')) {
    return <Navigate to="/" replace />;
  }

  // ── Terminal drag handler ──────────────────────────────────────────────────
  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(MIN_TERM_H, Math.min(MAX_TERM_H, h - delta)));
  }, []);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleSidebar = useCallback(() => setSidebarCollapsed(!sidebarCollapsed), [sidebarCollapsed, setSidebarCollapsed]);
  const toggleChat    = useCallback(() => setChatCollapsed(!chatCollapsed),       [chatCollapsed, setChatCollapsed]);

  return (
    <div className="flex flex-col w-screen h-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* ── Global title bar ── */}
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* ── Main body: [Sidebar | Editor+Terminal | Chat] ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: File Explorer ─────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: SIDEBAR_W, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col shrink-0 border-r border-neutral-800/60 bg-neutral-950 overflow-hidden"
            >
              {/* Upper half: file explorer */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileTree />
              </div>
              {/* Lower 35%: intelligence dashboard */}
              <div className="h-[35%] min-h-[180px] border-t border-neutral-800/60 overflow-hidden">
                <IntelligenceDashboard />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CENTER: Editor + Terminal (vertical split) ───────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-neutral-950">

          {/* Tab bar: switch between Diff and File Viewer */}
          <div className="h-10 flex items-center gap-0.5 px-2 border-b border-neutral-800/60 bg-neutral-950 shrink-0">
            {/* Toggle sidebar button */}
            <button
              onClick={toggleSidebar}
              className="p-1.5 mr-1 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              title={sidebarCollapsed ? 'Open Explorer' : 'Close Explorer'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>

            {/* Center tabs */}
            <div className="flex items-center gap-0.5 flex-1">
              {['diff', 'editor'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest transition-all',
                    activeTab === tab
                      ? 'bg-neutral-800 text-cyan-400 border border-neutral-700'
                      : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-900',
                  ].join(' ')}
                >
                  {tab === 'diff' ? 'Surgical_Diff' : 'File_View'}
                </button>
              ))}
              {/* Agent Neural Status pill floated right of tabs */}
              <div className="ml-auto mr-2">
                <AgentNeuralStatus compact />
              </div>
            </div>

            {/* Toggle chat button */}
            <button
              onClick={toggleChat}
              className="p-1.5 ml-1 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              title={chatCollapsed ? 'Open Chat' : 'Close Chat'}
            >
              {chatCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
            </button>
          </div>

          {/* Main content area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'diff' ? (
              <DiffViewer onApply={() => {}} onDiscard={() => setActiveTab('editor')} />
            ) : (
              <FileViewer path={activeFilePath} content={activeFileContent} />
            )}
          </div>

          {/* ── Terminal (draggable bottom pane) ── */}
          <ResizeHandle direction="vertical" onDrag={onTerminalDrag} />
          <div
            className="shrink-0 overflow-hidden border-t border-neutral-800/60"
            style={{ height: terminalH }}
          >
            <Terminal />
          </div>
        </div>

        {/* ── RIGHT: Chat Panel ────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!chatCollapsed && (
            <motion.div
              key="chat"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: CHAT_W, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="shrink-0 border-l border-neutral-800/60 bg-black overflow-hidden"
            >
              <ChatInterface onSend={sendPrompt} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Status bar ── */}
      <StatusBar />

      {/* ── Settings modal ── */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
