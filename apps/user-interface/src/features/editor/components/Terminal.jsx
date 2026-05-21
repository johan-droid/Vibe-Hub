import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Terminal as TermIcon, Trash2, ChevronDown, Circle, Play, Zap, Cpu, Activity, Shield, Globe, HardDrive, RefreshCw } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Premium ANSI Color Map (Refined) ───────────────────────────────────────
const ANSI_CLASSES = {
  '\x1b[0m':   'text-on-surface-variant/60',   // reset
  '\x1b[1m':   'font-black',                    // bold
  '\x1b[31m':  'text-google-red',               // red
  '\x1b[32m':  'text-google-green',             // green
  '\x1b[33m':  'text-google-yellow',            // yellow
  '\x1b[34m':  'text-google-blue',              // blue
  '\x1b[35m':  'text-google-red',               // magenta -> red
  '\x1b[36m':  'text-google-blue',              // cyan -> blue
  '\x1b[37m':  'text-on-surface',              // white
  '\x1b[90m':  'text-on-surface-variant/20',    // dim
};

function parseAnsi(raw) {
  const segments = [];
  const parts = raw.split(/(\x1b\[[0-9;]*m)/g);
  let currentClass = 'text-on-surface-variant/60';

  for (const part of parts) {
    if (part in ANSI_CLASSES) {
      currentClass = ANSI_CLASSES[part];
    } else if (part.startsWith('\x1b[')) {
      continue;
    } else if (part) {
      segments.push({ text: part, className: currentClass });
    }
  }
  return segments;
}

function getLineClass(line) {
  const l = line.toLowerCase();
  if (/\b(error|err|fail|fatal|critical)\b/.test(l)) return 'text-google-red font-bold';
  if (/\b(warn|warning)\b/.test(l)) return 'text-google-yellow font-bold';
  if (/\b(success|done|passed|ok|ready|started)\b/.test(l)) return 'text-google-green font-bold';
  if (/\b(info|log|note)\b/.test(l)) return 'text-google-blue font-bold';
  if (l.startsWith('  ') || l.startsWith('\t')) return 'opacity-40';
  return 'text-on-surface-variant/60';
}

// ─── LogLine (Refined for Professionals) ─────────────────────────────────────
const LogLine = memo(function LogLine({ line, index }) {
  const segments = parseAnsi(line);
  const hasAnsi = segments.some((s) => s.className !== 'text-on-surface-variant/60');
  const lineClass = hasAnsi ? '' : getLineClass(line);
  const safeLine = line;

  return (
    <div className={`flex gap-6 py-1 px-4 group hover:bg-black/[0.02] transition-colors rounded-lg mx-2 ${lineClass}`}>
      <span className="shrink-0 w-10 text-right text-[9px] font-black tracking-tighter opacity-10 group-hover:opacity-30 transition-opacity select-none font-mono">
        {index + 1}
      </span>
      <span className="font-mono text-[12px] break-all whitespace-pre-wrap flex-1 tracking-tight py-0.5 leading-relaxed font-medium">
        {hasAnsi
          ? segments.map((seg, i) => (
              <span key={i} className={seg.className}>{seg.text}</span>
            ))
          : safeLine || '\u00a0'
        }
      </span>
    </div>
  );
});

// ─── Main Terminal ────────────────────────────────────────────────────────────
const Terminal = memo(function Terminal() {
  const { terminalOutput, neuralStatus, workflowState } = useStore();
  const scrollRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const isUserScrolledRef = useRef(false);
  const lines = terminalOutput;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isUserScrolledRef.current = !atBottom;
    setIsUserScrolled(!atBottom);
  }, []);

  useEffect(() => {
    if (!isUserScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    isUserScrolledRef.current = false;
    setIsUserScrolled(false);
  }, []);

  const clearOutput = useCallback(() => {
    useStore.getState().clearTerminal();
  }, []);

  let headerStatus = "System Idle";
  let statusColor = "bg-black/10";
  
  if (workflowState && workflowState.status === 'triggered') {
      headerStatus = "Task Queued";
      statusColor = "bg-google-yellow";
  } else if (workflowState && workflowState.status === 'completed') {
      headerStatus = workflowState.conclusion === 'success' ? "Build Success" : "Build Failure";
      statusColor = workflowState.conclusion === 'success' ? "bg-google-green" : "bg-google-red";
  } else if (lines.length > 0) {
      headerStatus = "Live Log Stream";
      statusColor = "bg-google-blue";
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#faf8f5] overflow-hidden border-t border-black/[0.03]">
      {/* Header / Toolbar */}
      <div className="h-12 px-8 flex items-center justify-between border-b border-black/[0.03] shrink-0 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className={`h-2 w-2 rounded-full ${statusColor} animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
             <span className="text-[10px] font-black text-on-surface uppercase tracking-[0.4em]">{headerStatus}</span>
          </div>
          <div className="h-4 w-px bg-black/[0.05]" />
          <div className="flex items-center gap-3 opacity-20 group">
             <TermIcon size={12} className="group-hover:text-google-blue transition-colors" />
             <span className="text-[9px] font-black uppercase tracking-widest">Active Shell</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <AnimatePresence>
            {isUserScrolled && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={scrollToBottom}
                className="px-4 py-1.5 rounded-full bg-google-blue/10 text-google-blue text-[9px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-google-blue/20 transition-all"
              >
                <ChevronDown size={10} /> Resume
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={clearOutput}
            className="flex items-center gap-2.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/20 hover:text-google-red transition-all"
          >
            <RefreshCw size={10} /> Clear
          </button>
        </div>
      </div>

      {/* Output Stream Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none"
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 p-12 text-center">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.8rem] bg-white border border-black/[0.03] shadow-sm text-google-blue/10 transition-transform hover:scale-110">
                <Play size={28} />
              </div>
              <motion.div 
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.1, 0.3, 0.1] }} 
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute inset-0 bg-google-blue blur-[30px] rounded-full -z-10"
              />
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-black text-on-surface-variant/40 uppercase tracking-[0.3em]">Stdout Standby</h4>
              <p className="text-[10px] font-semibold text-on-surface-variant/20 uppercase tracking-[0.15em]">Establishing secure link to production node...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-full pb-10">
            {lines.map((line, i) => (
              <LogLine key={i} line={line} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Terminal Footer Telemetry */}
      <div className="h-10 px-8 border-t border-black/[0.03] flex items-center justify-between shrink-0 bg-white/30 backdrop-blur-md">
        <div className="flex items-center gap-8 text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest">
          <div className="flex items-center gap-3">
             <Activity size={10} className="text-google-green" />
             <span>Core Healthy</span>
          </div>
          <div className="h-3 w-px bg-black/[0.05]" />
          <div className="flex items-center gap-3">
             <HardDrive size={10} className="text-google-blue" />
             <span>Disk: 4.1GB Free</span>
          </div>
          <div className="h-3 w-px bg-black/[0.05]" />
          <div className="flex items-center gap-3">
             <Globe size={10} className="text-google-yellow" />
             <span>Latency: 28ms</span>
          </div>
        </div>
        <div className="text-[9px] font-black text-on-surface-variant/10 uppercase tracking-[0.4em] font-mono">
           Tty: /dev/pts/1
        </div>
      </div>
    </div>
  );
});

export default Terminal;
