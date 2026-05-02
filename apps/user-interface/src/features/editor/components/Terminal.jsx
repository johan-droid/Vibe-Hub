import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Terminal as TermIcon, Trash2, ChevronDown, Circle, Play } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Surface } from '../../shared/components/Surface';
import { IconButton } from '../../shared/components/IconButton';
import { Button } from '../../shared/components/Button';

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
  let currentClass = 'text-on-surface-variant/70';

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
  if (l.startsWith('  ') || l.startsWith('\t')) return 'text-outline opacity-60';
  return 'text-on-surface-variant/80';
}

// ─── LogLine (Memoized) ─────────────────────────────────────────────────────
const LogLine = memo(function LogLine({ line, index }) {
  const segments = parseAnsi(line);
  const hasAnsi = segments.some((s) => s.className !== 'text-on-surface-variant/70');
  const lineClass = hasAnsi ? '' : getLineClass(line);

  return (
    <div className={`flex gap-4 py-0.5 leading-6 group hover:bg-on-surface/5 transition-colors rounded-sm ${lineClass}`}>
      <span className="shrink-0 w-10 text-right label-small font-mono text-outline/40 select-none opacity-40 group-hover:opacity-100 transition-opacity">
        {index + 1}
      </span>
      <span className="font-mono text-[12px] break-all whitespace-pre-wrap flex-1 tracking-tight">
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
  const { terminalOutput, neuralStatus } = useStore();
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

  return (
    <Surface elevation={0} className="h-full w-full flex flex-col bg-surface-container-lowest overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-outline-variant/20 shrink-0 bg-surface-container-low/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Surface elevation={2} shape="md" className="w-6 h-6 flex items-center justify-center bg-primary/10">
            <TermIcon size={14} className="text-primary" />
          </Surface>
          <span className="label-large font-bold text-on-surface uppercase tracking-widest opacity-60">
            Output_Stream
          </span>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`w-1.5 h-1.5 rounded-full ${lines.length > 0 ? 'bg-primary' : 'bg-outline/20'}`}
          />
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence>
            {isUserScrolled && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
              >
                <Button
                  variant="tonal"
                  size="sm"
                  onClick={scrollToBottom}
                  leadingIcon={ChevronDown}
                  className="h-8 !px-3 !rounded-lg text-[10px] animate-pulse"
                >
                  Resume
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <IconButton
            icon={Trash2}
            variant="ghost"
            size="sm"
            onClick={clearOutput}
            className="text-on-surface-variant/40 hover:text-error"
          />
        </div>
      </div>

      {/* Stream Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 px-2 scrollbar-none"
      >
                {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 opacity-20">
            {neuralStatus?.waitingForGitHub ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Surface elevation={1} shape="full" className="w-12 h-12 flex items-center justify-center border-t-2 border-primary border-outline-variant/30">
                </Surface>
              </motion.div>
            ) : (
              <Surface elevation={1} shape="full" className="w-12 h-12 flex items-center justify-center border border-outline-variant/30">
                 <Play size={20} className="text-on-surface ml-1" />
              </Surface>
            )}
            <span className="label-small font-mono uppercase tracking-[0.5em]">
              {neuralStatus?.waitingForGitHub ? 'Awaiting_GitHub_Runner...' : 'Idle_System'}
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
    </Surface>
  );
}
