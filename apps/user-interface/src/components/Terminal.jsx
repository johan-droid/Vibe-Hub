import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TermIcon, Trash2, Maximize2 } from 'lucide-react';

export default function Terminal({ onData, output }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#06b6d4',
        cursor: '#06b6d4',
        selectionBackground: 'rgba(6, 182, 212, 0.2)',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#fafafa',
      },
      fontSize: 12,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      convertEol: true,
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Smooth delay for fit to avoid tiny terminal
    setTimeout(() => fitAddon.fit(), 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (onData) onData(data);
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current && output) {
      xtermRef.current.write(output);
    }
  }, [output]);

  return (
    <div className="h-full w-full flex flex-col bg-[#0a0a0a]">
      <div className="h-9 px-4 border-b border-zinc-900 bg-black flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TermIcon size={14} className="text-cyan-500" />
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Interactive_Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-600 hover:text-zinc-400">
            <Trash2 size={12} />
          </button>
          <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-600 hover:text-zinc-400">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 p-3">
        <div ref={terminalRef} className="h-full w-full overflow-hidden" />
      </div>
    </div>
  );
}
