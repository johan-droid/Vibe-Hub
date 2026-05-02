import React, { useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2, LayoutGrid, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import FileTree from '../components/FileTree';
import ChatInterface from '../components/ChatInterface';
import DiffViewer from '../components/DiffViewer';
import Terminal from '../components/Terminal';
import SettingsModal from '../components/SettingsModal';
import Titlebar from '../components/Titlebar';
import StatusBar from '../components/StatusBar';
import IntelligenceDashboard from '../components/IntelligenceDashboard';
import { useAgent } from '../hooks/useAgent';
import { useStore } from '../store/useStore';
import { Surface } from '../components/ui/Surface';

// ─── Constants ─────────────────────────────────────────────────────────────────
const SIDEBAR_W = 340;   
const CHAT_W    = 460;   
const MIN_TERM_H = 140;  
const MAX_TERM_H = 700;  
const DEFAULT_TERM_H = 300;

// ─── Resize Handle ───────────────────────────────────────────────────────────
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

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={
        `group shrink-0 relative z-30 transition-all duration-300 select-none 
        ${direction === 'vertical' ? 'h-1 w-full cursor-ns-resize' : 'w-1 h-full cursor-ew-resize'} ${className}`
      }
    >
      <div className={`absolute inset-0 m-auto bg-outline-variant/10 group-hover:bg-primary/40 transition-colors ${direction === 'vertical' ? 'h-[1px] w-full' : 'w-[1px] h-full'}`} />
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 ${direction === 'vertical' ? 'h-4 -top-1.5' : 'w-4 -left-1.5'}`} />
    </div>
  );
}

// ─── File Viewer ──────────────────────────────────────────────────────────────
const FileViewer = React.memo(function FileViewer({ path, content }) {
  const language = React.useMemo(() => {
    if (!path) return 'text';
    const ext = path.split('.').pop()?.toLowerCase();
    const MAP = { js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
                  json: 'json', css: 'css', scss: 'scss', md: 'markdown',
                  sh: 'bash', py: 'python', html: 'html', go: 'go', rs: 'rust' };
    return MAP[ext] ?? 'text';
  }, [path]);

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8 bg-surface-container-lowest/50">
        <Surface elevation={3} shape="3xl" className="p-12 bg-surface-container-highest relative group overflow-hidden border border-outline-variant/20 shadow-2xl">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
           <LayoutGrid size={64} className="text-primary transition-transform duration-1000 group-hover:rotate-12 group-hover:scale-110" />
        </Surface>
        <div className="flex flex-col items-center gap-3">
          <h2 className="headline-medium font-black tracking-tighter text-on-surface uppercase italic">
            Neural_Core_Active
          </h2>
          <p className="label-large text-on-surface-variant font-bold opacity-40 uppercase tracking-[0.4em] flex items-center gap-3">
            <Sparkles size={16} />
            Await_Input_Stream
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-container-lowest">
      <div className="h-14 border-b border-outline-variant/20 flex items-center px-8 gap-4 bg-surface-container-low/30 backdrop-blur-2xl shrink-0">
        <FileCode2 size={18} className="text-primary opacity-60" />
        <div className="flex flex-col">
          <span className="label-medium font-bold text-on-surface tracking-tight truncate max-w-md">{path.split('/').pop()}</span>
          <span className="text-[8px] font-mono text-on-surface-variant opacity-40 uppercase tracking-widest">{path}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-none">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines={false}
          customStyle={{
            margin: 0,
            padding: '3rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.9',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ color: 'hsl(var(--outline-variant))', opacity: 0.2, minWidth: '4em', paddingRight: '3em', textAlign: 'right' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

// ─── Workspace ─────────────────────────────────────────────────────────────────
export default function Workspace() {
  const {
    user,
    sidebarCollapsed,
    chatCollapsed,
    activeTab,
    activeFileContent, activeFilePath,
  } = useStore();

  const [terminalH, setTerminalH] = useState(DEFAULT_TERM_H);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { sendPrompt } = useAgent();

  if (!user && !localStorage.getItem('vibe_token')) {
    return <Navigate to="/" replace />;
  }

  const onTerminalDrag = useCallback((delta) => {
    setTerminalH((h) => Math.max(MIN_TERM_H, Math.min(MAX_TERM_H, h - delta)));
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen bg-surface-container-lowest text-on-surface overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <div className="flex-1 flex overflow-hidden min-h-0 bg-surface">
        {/* LEFT: Explorer & Metrics (Bento Style) */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -30, filter: 'blur(8px)' }}
              animate={{ width: SIDEBAR_W, opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ width: 0, opacity: 0, x: -30, filter: 'blur(8px)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="flex flex-col shrink-0 overflow-hidden border-r border-outline-variant/20 bg-surface-container-low"
            >
              <div className="flex-1 min-h-0">
                <FileTree />
              </div>
              <div className="h-[48%] min-h-[340px] border-t border-outline-variant/20 overflow-hidden bg-surface-container-lowest/50">
                <IntelligenceDashboard />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER: Editor & Terminal */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-surface-container-lowest relative z-10">
          <div className="flex-1 min-h-0 relative shadow-inner">
            {activeTab === 'diff' ? (
              <DiffViewer onApply={() => {}} onDiscard={() => {}} />
            ) : (
              <FileViewer path={activeFilePath} content={activeFileContent} />
            )}
          </div>

          <ResizeHandle direction="vertical" onDrag={onTerminalDrag} />
          
          <Surface 
            elevation={1} 
            shape="none" 
            className="shrink-0 overflow-hidden border-t border-outline-variant/20 bg-surface-container-low"
            style={{ height: terminalH }}
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
              <Terminal />
            </div>
          </Surface>
        </main>

        {/* RIGHT: Chat Interface */}
        <AnimatePresence initial={false}>
          {!chatCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 30, filter: 'blur(8px)' }}
              animate={{ width: CHAT_W, opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ width: 0, opacity: 0, x: 30, filter: 'blur(8px)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="shrink-0 border-l border-outline-variant/20 overflow-hidden bg-surface-container-lowest shadow-[-20px_0_40px_-20px_rgba(0,0,0,0.2)]"
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
