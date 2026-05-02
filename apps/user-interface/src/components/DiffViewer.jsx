import React, { useMemo } from 'react';
import { Eye, Zap, Code, FileCode, GitPullRequest, ChevronRight } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

/**
 * DiffViewer — Principal Frontend Architect Implementation
 * 
 * Optimized for displaying surgical code edits with minimal performance impact.
 * Uses useMemo to prevent re-calculating diff chunks on every state change.
 */
export default function DiffViewer({ onApply, onDiscard }) {
  const { diffData, isThinking, neuralStatus } = useStore();

  // Optimized Surgical Chunking
  // Focuses only on the lines that changed, providing context around the edit.
  const diffChunk = useMemo(() => {
    if (!diffData || !diffData.oldValue || !diffData.newValue) return null;
    
    const oldLines = diffData.oldValue.split('\n');
    const newLines = diffData.newValue.split('\n');
    
    let firstDiff = 0;
    while (firstDiff < oldLines.length && oldLines[firstDiff] === newLines[firstDiff]) {
      firstDiff++;
    }

    // Capture context: 15 lines before and 25 lines after the first detected difference
    const start = Math.max(0, firstDiff - 15);
    const end = Math.min(newLines.length, firstDiff + 25);
    
    return {
      old: oldLines.slice(start, end).join('\n'),
      new: newLines.slice(start, end).join('\n'),
      startLine: start + 1,
      totalLines: newLines.length
    };
  }, [diffData]);

  return (
    <div className="h-full bg-black flex flex-col relative overflow-hidden font-mono">
      {/* Precision Header */}
      <div className="h-14 px-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950 select-none">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <GitPullRequest size={14} className="text-cyan-500" />
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">Surgical_Projection</h2>
          </div>
          
          <AnimatePresence>
            {diffData && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2.5 bg-zinc-900/40 border border-zinc-800/50 rounded-full px-4 py-1.5 shadow-inner"
              >
                <FileCode size={12} className="text-cyan-400" />
                <span className="text-[10px] text-zinc-300 tracking-tight">{diffData.path}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {diffData && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <button 
                  onClick={onDiscard}
                  disabled={isThinking}
                  className="px-4 py-1.5 text-zinc-500 hover:text-zinc-200 text-[10px] uppercase font-bold transition-colors disabled:opacity-20"
                >
                  Discard
                </button>
                <button 
                  onClick={() => onApply(diffData)}
                  disabled={isThinking}
                  className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-lg shadow-cyan-900/20 active:scale-95 disabled:bg-zinc-800 disabled:shadow-none"
                >
                  Apply_Mutation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Diff Workspace */}
      <div className="flex-1 overflow-auto bg-[#050505] p-6 selection:bg-cyan-500/30">
        {diffChunk ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-zinc-900 overflow-hidden bg-black shadow-2xl"
          >
            <div className="bg-zinc-900/30 px-5 py-3 border-b border-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[9px] text-zinc-500 uppercase tracking-widest">
                <Code size={12} /> 
                <span className="flex items-center gap-1.5">
                  Frame <ChevronRight size={10} /> Lines {diffChunk.startLine} - {diffChunk.startLine + 40}
                </span>
              </div>
              <div className="text-[9px] text-zinc-700 font-bold">
                TOTAL_LINES: {diffChunk.totalLines}
              </div>
            </div>
            
            <div className="p-2">
              <ReactDiffViewer
                oldValue={diffChunk.old}
                newValue={diffChunk.new}
                splitView={true}
                useDarkTheme={true}
                codeFoldGutter={true}
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: '#000',
                      diffViewerTitleBackground: '#0a0a0a',
                      diffViewerTitleColor: '#444',
                      addedBackground: 'rgba(6, 182, 212, 0.08)',
                      addedColor: '#06b6d4',
                      removedBackground: 'rgba(239, 68, 68, 0.08)',
                      removedColor: '#ef4444',
                      wordAddedBackground: 'rgba(6, 182, 212, 0.25)',
                      wordRemovedBackground: 'rgba(239, 68, 68, 0.25)',
                      gutterBackground: '#000',
                      gutterColor: '#333',
                      codeFoldGutterBackground: '#050505',
                      codeFoldBackground: '#080808',
                      codeFoldContentColor: '#444'
                    }
                  },
                  contentText: {
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, Menlo, monospace',
                    lineHeight: '1.7',
                    letterSpacing: '-0.02em'
                  },
                  line: {
                    padding: '1px 0',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.015)'
                    }
                  },
                  gutter: {
                    padding: '0 15px',
                    minWidth: '60px'
                  }
                }}
              />
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-8 opacity-60">
            <div className="relative">
              <motion.div 
                animate={{ 
                  scale: [1, 1.15, 1],
                  rotate: [0, 90, 180, 270, 360],
                  borderRadius: ["20%", "40%", "20%"]
                }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                className="w-24 h-24 border-2 border-dashed border-zinc-900" 
              />
              <Zap size={32} className="absolute inset-0 m-auto text-zinc-900" />
            </div>
            <div className="text-center space-y-2">
              <div className="text-[11px] uppercase tracking-[0.5em] font-black text-zinc-700">Awaiting_Neural_Input</div>
              <p className="text-[9px] text-zinc-800 uppercase tracking-widest">Surgical patches will materialize here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Neural Feedback Overlay */}
      <AnimatePresence>
        {isThinking && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900/90 backdrop-blur-xl border border-white/5 rounded-full flex items-center gap-4 z-30 shadow-2xl"
          >
             <div className="flex gap-1">
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
             </div>
             <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
               Analyzing_VFS_Structure...
             </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
