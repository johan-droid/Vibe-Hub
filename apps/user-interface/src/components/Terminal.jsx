import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TermIcon, Trash2, ChevronDown, Circle } from 'lucide-react';
import { useStore } from '../store/useStore';

// ─── ANSI Color Map ────────────────────────────────────────────────────────────
// Converts common ANSI escape sequences into Tailwind class names so logs render
// with semantic color directly in the DOM — no canvas/xterm dependency needed
// for read-only output. This is much lighter than loading the full xterm.js bundle
// when the terminal is read-only.
// ──────────────────────────────────────────────────────────────────────────────

const ANSI_CLASSES = {
  '\x1b[0m':   'text-neutral-400',          // reset
  '\x1b[1m':   'font-bold',                 // bold
  '\x1b[31m':  'text-red-400',              // red   → errors
  '\x1b[32m':  'text-emerald-400',          // green → success
  '\x1b[33m':  'text-amber-400',            // yellow → warnings
  '\x1b[34m':  'text-blue-400',             // blue
  '\x1b[35m':  'text-violet-400',           // magenta
  '\x1b[36m':  'text-cyan-400',             // cyan
  '\x1b[37m':  'text-neutral-200',          // white
  '\x1b[90m':  'text-neutral-600',          // bright black (dim)
  '\x1b[91m':  'text-red-300',              // bright red
  '\x1b[92m':  'text-emerald-300',          // bright green
  '\x1b[93m':  'text-yellow-300',           // bright yellow
};

// Strip ANSI codes not in our map and split raw output into colored segments.
function parseAnsi(raw) {
  const segments = [];
  // Match any ANSI escape sequence
  const parts = raw.split(/(\x1b\[[0-9;]*m)/g);
  let currentClass = 'text-neutral-400';

  for (const part of parts) {
    if (part in ANSI_CLASSES) {
      currentClass = ANSI_CLASSES[part];
    } else if (part.startsWith('\x1b[')) {
      // Unknown/unsupported sequence — drop it
      continue;
    } else if (part) {
      segments.push({ text: part, className: currentClass });
    }
  }
  return segments;
}

// ─── Heuristic log-level coloriser (for plain-text backends) ──────────────────
function getLineClass(line) {
  const l = line.toLowerCase();
  if (/\b(error|err|fail|fatal|critical|exception)\b/.test(l)) return 'text-red-400';
  if (/\b(warn|warning)\b/.test(l)) return 'text-amber-400';
  if (/\b(success|done|passed|ok|ready|started|listening)\b/.test(l)) return 'text-emerald-400';
  if (/\b(info|log|note)\b/.test(l)) return 'text-blue-300';
  if (l.startsWith('  ') || l.startsWith('\t')) return 'text-neutral-500'; // indented → dim
  return 'text-neutral-400';
}

// ─── Single log line (memoized to prevent full-list re-render on new output) ──
const LogLine = React.memo(function LogLine({ line, index }) {
  const segments = parseAnsi(line);
  const hasAnsi = segments.some((s) => s.className !== 'text-neutral-400');
  const lineClass = hasAnsi ? '' : getLineClass(line);

  return (
    <div className={`flex gap-3 py-px leading-5 ${lineClass}`}>
      {/* Line number gutter */}
      <span className="shrink-0 w-10 text-right text-neutral-700 text-[10px] select-none font-mono">
        {index + 1}
      </span>
      {/* Line content */}
      <span className="font-mono text-[11px] break-all whitespace-pre-wrap flex-1">
        {hasAnsi
          ? segments.map((seg, i) => (
              <span key={i} className={seg.className}>{seg.text}</span>
            ))
          : line || '\u00a0' /* non-breaking space to preserve empty line height */
        }
      </span>
    </div>
  );
});

// ─── Terminal Root ─────────────────────────────────────────────────────────────
export default function Terminal() {
  const { terminalOutput } = useStore();
  const scrollRef = useRef(null);

  // Sticky-scroll state: if user scrolls up, we pause auto-scroll.
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const isUserScrolledRef = useRef(false);

  // BUG #10 companion fix: terminalOutput is now Array<string> in the store,
  // not a growing string. We consume it directly — no split() needed.
  // The store caps the array at 2000 lines, so this is always bounded.
  const lines = terminalOutput; // already an array

  // Scroll event: detect when user manually scrolls away from the bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Consider "at bottom" if within 40px of the end
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    isUserScrolledRef.current = !atBottom;
    setIsUserScrolled(!atBottom);
  }, []);

  // Auto-scroll to bottom on new output, only if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Resume auto-scroll button handler
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    isUserScrolledRef.current = false;
    setIsUserScrolled(false);
  }, []);

  // Clear terminal output
  const clearOutput = useCallback(() => {
    useStore.getState().clearTerminal();
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-neutral-950 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-neutral-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <TermIcon size={13} className="text-emerald-500" />
          <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
            Output_Stream
          </span>
          {/* Live indicator dot */}
          <Circle
            size={6}
            className={`fill-current transition-colors ${
              lines.length > 0 ? 'text-emerald-500 animate-pulse' : 'text-neutral-700'
            }`}
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Scroll-lock notice + jump button */}
          {isUserScrolled && (
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 px-2.5 py-1 mr-2
                         bg-cyan-600/20 border border-cyan-500/30 text-cyan-400
                         rounded-md text-[9px] font-mono uppercase tracking-widest
                         hover:bg-cyan-600/30 transition-colors animate-pulse"
            >
              <ChevronDown size={10} />
              Resume
            </button>
          )}
          {/* Clear button */}
          <button
            onClick={clearOutput}
            className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors text-neutral-600 hover:text-neutral-400"
            title="Clear output"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Log stream ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 px-1"
      >
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-20 opacity-30">
            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-[0.3em]">
              Awaiting_Output...
            </span>
          </div>
        ) : (
          lines.map((line, i) => (
            // Key by index is safe here — we only ever append to the end
            <LogLine key={i} line={line} index={i} />
          ))
        )}
      </div>
    </div>
  );
}
