import React from 'react';
import { Eye, Zap, Code, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

export default function DiffViewer({ onRecure }) {
  const { visionScore, diffData, isThinking } = useStore();

  const getSurgicalChunk = (oldValue, newValue) => {
    if (!oldValue || !newValue) return { old: oldValue, new: newValue };
    
    const oldLines = oldValue.split('\n');
    const newLines = newValue.split('\n');
    
    let firstDiff = 0;
    while (firstDiff < oldLines.length && oldLines[firstDiff] === newLines[firstDiff]) {
      firstDiff++;
    }

    const start = Math.max(0, firstDiff - 20);
    const end = Math.min(newLines.length, firstDiff + 30);
    
    return {
      old: oldLines.slice(start, end).join('\n'),
      new: newLines.slice(start, end).join('\n'),
      startLine: start + 1
    };
  };

  const chunked = diffData ? getSurgicalChunk(diffData.oldValue, diffData.newValue) : null;

  return (
    <div className="h-full bg-black flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950 select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-zinc-500" />
            <h2 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.2em]">Surgical_Diff</h2>
          </div>
          
          {diffData && (
            <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-full px-3 py-1">
              <FileCode size={10} className="text-cyan-400" />
              <span className="text-[10px] font-mono text-zinc-300">{diffData.path}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {diffData && (
            <>
              <button 
                onClick={() => onRecure("Please re-examine the current state and perform another optimization pass.")}
                disabled={isThinking}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] uppercase font-mono transition-all btn-hover disabled:opacity-30"
              >
                RECUR_AND_REPAIR
              </button>
              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
              <button className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-[9px] uppercase font-mono transition-all">Discard</button>
              <button className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[9px] font-bold font-mono transition-all btn-hover">APPLY_STATE</button>
            </>
          )}
        </div>
      </div>

      {/* Diff Area */}
      <div className="flex-1 overflow-auto bg-black p-4">
        {chunked ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-zinc-900 overflow-hidden"
          >
            <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                <Code size={10} /> 
                Lines {chunked.startLine} - {chunked.startLine + 50}
              </div>
              {visionScore && (
                 <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(v => (
                      <div key={v} className={`w-1 h-3 rounded-full ${v <= visionScore.score ? 'bg-cyan-500' : 'bg-zinc-800'}`} />
                    ))}
                 </div>
              )}
            </div>
            <ReactDiffViewer
              oldValue={chunked.old}
              newValue={chunked.new}
              splitView={true}
              useDarkTheme={true}
              codeFoldGutter={true}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: '#000',
                    diffViewerTitleBackground: '#0a0a0a',
                    diffViewerTitleColor: '#666',
                    addedBackground: 'rgba(16, 185, 129, 0.05)',
                    addedColor: '#10b981',
                    removedBackground: 'rgba(239, 68, 68, 0.05)',
                    removedColor: '#ef4444',
                    wordAddedBackground: 'rgba(16, 185, 129, 0.2)',
                    wordRemovedBackground: 'rgba(239, 68, 68, 0.2)',
                  }
                },
                contentText: {
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  lineHeight: '1.6'
                },
                line: {
                  padding: '2px 0',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.02)'
                  }
                }
              }}
            />
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700 font-mono gap-6 opacity-40">
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 180, 270, 360] }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="w-16 h-16 rounded-2xl border border-dashed border-zinc-700" 
              />
              <Eye size={24} className="absolute inset-0 m-auto text-zinc-800" />
            </div>
            <div className="text-center space-y-1">
              <div className="text-xs uppercase tracking-[0.4em]">awaiting_vfs_diff</div>
              <p className="text-[10px] text-zinc-800">Surgical edits will be projected here in real-time.</p>
            </div>
          </div>
        )}
      </div>

      {/* Vision Card Overlay */}
      {visionScore && (
        <motion.div 
          initial={{ x: 300 }}
          animate={{ x: 0 }}
          className="absolute top-16 right-8 w-72 glass p-6 rounded-3xl border border-white/10 z-20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400 fill-amber-400" />
              <h4 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Neural_Eval</h4>
            </div>
            <div className="text-xl font-black font-mono text-cyan-400">{visionScore.score}/10</div>
          </div>

          <div className="space-y-4">
            {Object.entries(visionScore.metrics || {}).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
                  <span>{key}</span>
                  <span>{val * 10}%</span>
                </div>
                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${val * 10}%` }}
                    className={`h-full ${val >= 7 ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-red-500'}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-[10px] text-zinc-400 leading-relaxed italic">
               <span className="text-cyan-500/50 mr-1">"</span>
               {visionScore.reasoning}
               <span className="text-cyan-500/50 ml-1">"</span>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
