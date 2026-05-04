import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Terminal as TermIcon, Trash2, ChevronDown, Circle, Play, Zap, Cpu } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

// ─── M3-Aligned ANSI Color Map ───────────────────────────────────────────────
const ANSI_CLASSES = {
  '\x1b[0m':   'text-on-surface-variant',   // reset
  '\x1b[1m':   'font-bold',                  // bold
  '\x1b[31m':  'text-error',                 // red
  '\x1b[32m':  'text-primary',               // green
  '\x1b[33m':  'text-secondary',             // yellow
  '\x1b[34m':  'text-tertiary',              // blue
  '\x1b[35m':  'text-error',                 // magenta
  '\x1b[36m':  'text-secondary',             // cyan
  '\x1b[37m':  'text-on-surface',            // white
  '\x1b[90m':  'text-outline',               // dim
};

function parseAnsi(raw) {
  const segments = [];
  const parts = raw.split(/(\x1b\[[0-9;]*m)/g);
  let currentClass = 'text-on-surface-variant/50';

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
  if (/\b(error|err|fail|fatal|critical)\b/.test(l)) return 'text-error font-medium';
  if (/\b(warn|warning)\b/.test(l)) return 'text-secondary';
  if (/\b(success|done|passed|ok|ready|started)\b/.test(l)) return 'text-primary font-medium';
  if (/\b(info|log|note)\b/.test(l)) return 'text-primary/60';
  if (l.startsWith('  ') || l.startsWith('\t')) return 'text-outline opacity-40';
  return 'text-on-surface-variant/60';
}

// ─── LogLine (Memoized) ─────────────────────────────────────────────────────
const LogLine = memo(function LogLine({ line, index }) {
  const segments = parseAnsi(line);
  const hasAnsi = segments.some((s) => s.className !== 'text-on-surface-variant/50');
  const lineClass = hasAnsi ? '' : getLineClass(line);

  return (
    <div className={`flex gap-3 py-0 group hover:bg-on-surface/[0.03] transition-colors rounded-sm ${lineClass}`}>
      <span className="shrink-0 w-8 text-right label-small font-mono text-outline/20 select-none opacity-30 group-hover:opacity-100 transition-opacity">
        {index + 1}
      </span>
      <span className="font-mono text-[11px] break-all whitespace-pre-wrap flex-1 tracking-tight py-0.5">
        {hasAnsi
          ? segments.map((seg, i) => (
              <span key={i} className={seg.className}>{seg.text}</span>
            ))
          : line || '\u00a0'
        }
      </span>
    </div>
  );
});

// ─── Main Terminal ────────────────────────────────────────────────────────────
export default function Terminal() {
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

  let headerStatus = "SYSTEM_IDLE";
  if (workflowState && workflowState.status === 'triggered') {
      headerStatus = "RUNNER_QUEUED";
  } else if (workflowState && workflowState.status === 'completed') {
      headerStatus = workflowState.conclusion === 'success' ? "RUNNER_SUCCESS" : "RUNNER_FAILURE";
  } else if (lines.length > 0) {
      headerStatus = "STDOUT_STREAM";
  }

  return (
    <div className="h-full w-full flex flex-col bg-surface-container-lowest overflow-hidden">
      {/* Toolbar */}
      <div className="h-9 px-5 flex items-center justify-between border-b border-outline-variant/10 shrink-0 bg-on-surface/[0.01]">
        <div className="flex items-center gap-3">
          <TermIcon size={12} className="text-primary opacity-60" />
          <span className="label-small font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-60">
            {headerStatus}
          </span>
          <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {isUserScrolled && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                onClick={scrollToBottom}
                className="label-small uppercase tracking-widest text-primary flex items-center gap-2 hover:brightness-110 transition-all"
              >
                <ChevronDown size={10} /> RESUME_STREAM
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={clearOutput}
            className="label-small uppercase tracking-widest text-on-surface-variant/20 hover:text-error hover:opacity-100 transition-all"
          >
            PURGE
          </button>
        </div>
      </div>

      {/* Stream Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-3 px-2 scrollbar-none"
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="relative mb-4">
              <Play size={20} className="text-primary/10" />
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.15, 0.05] }} 
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute inset-0 bg-primary/20 blur-[20px] rounded-full"
              />
            </div>
            <span className="label-small uppercase tracking-[0.25em] opacity-20">
              {neuralStatus?.waitingForGitHub ? 'Awaiting Data Link...' : 'STDOUT_STANDBY'}
            </span>
          </div>
        ) : (
          <div className="max-w-full">
            {lines.map((line, i) => (
              <LogLine key={i} line={line} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Footer Telemetry */}
      <div className="h-6 px-5 border-t border-outline-variant/10 flex items-center justify-between shrink-0 bg-on-surface/[0.01]">
        <div className="flex items-center gap-4 label-small opacity-20 uppercase tracking-widest font-mono text-[9px]">
          <span className="flex items-center gap-1.5"><Cpu size={10} /> CORE_0</span>
          <span>TTY: /dev/pts/1</span>
        </div>
        <div className="label-small opacity-20 uppercase tracking-widest font-mono text-[9px]">
          BUFF: {Math.round(JSON.stringify(lines).length / 1024)}KB
        </div>
      </div>
    </div>
  );
}
