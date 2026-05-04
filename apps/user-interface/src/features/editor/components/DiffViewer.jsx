import React, { useMemo, useEffect } from 'react';
import { Eye, Code, FileCode, GitPullRequest, ChevronRight, X, Check, Github, Terminal, Zap, Sparkles } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../../../store/useStore';
import { useVfsStore } from '../../../store/useVfsStore';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DiffViewer — Neural OS Surgical Projection
 * Optimized for professional code orchestration and industrial clarity.
 */
export default function DiffViewer({ onApply, onDiscard }) {
  const { diffData, isThinking } = useStore();
  const { 
    activeDiff, 
    isReviewing, 
    discardChanges, 
    commitToPhysicalDisk,
    fetchPendingFiles 
  } = useVfsStore();

  useEffect(() => {
    fetchPendingFiles();
  }, [fetchPendingFiles]);

  const hasVfsDiff = isReviewing && activeDiff;

  const diffChunk = useMemo(() => {
    if (hasVfsDiff) {
      const oldContent = activeDiff.originalContent || '';
      const newContent = activeDiff.proposedContent || '';
      return {
        old: oldContent,
        new: newContent,
        startLine: 1,
        totalLines: newContent.split('\n').length,
        isVfs: true,
        filePath: activeDiff.filePath,
        metadata: activeDiff.metadata
      };
    }
    
    if (!diffData) return null;
    const diffToRender = Array.isArray(diffData) ? diffData[0] : diffData;
    if (!diffToRender.oldValue || !diffToRender.newValue) return null;
    
    const oldLines = diffToRender.oldValue.split('\n');
    const newLines = diffToRender.newValue.split('\n');
    
    let firstDiff = 0;
    while (firstDiff < oldLines.length && oldLines[firstDiff] === newLines[firstDiff]) {
      firstDiff++;
    }

    const start = Math.max(0, firstDiff - 12);
    const end = Math.min(newLines.length, firstDiff + 28);
    
    return {
      old: oldLines.slice(start, end).join('\n'),
      new: newLines.slice(start, end).join('\n'),
      startLine: start + 1,
      totalLines: newLines.length,
      isVfs: false
    };
  }, [diffData, hasVfsDiff, activeDiff]);

  let title = "SURGICAL_PATCH";
  let isVfsMode = false;

  if (hasVfsDiff) {
    title = `VFS_INSPECT: ${activeDiff.filePath.split('/').pop()?.toUpperCase()}`;
    isVfsMode = true;
  } else if (diffData && diffData.type === 'github_pr') {
    title = `PR_#${diffData.prNumber}_VECT`;
  }

  return (
    <div className="h-full bg-surface-container-lowest flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-10 px-6 neural-glass border-x-0 border-t-0 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <GitPullRequest size={12} className="text-primary opacity-60" />
            <h2 className="label-small uppercase tracking-[0.2em] opacity-80 font-bold">{title}</h2>
          </div>
          
          <AnimatePresence mode="wait">
            {(diffData || hasVfsDiff) && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center"
              >
                <div className="w-px h-3 bg-outline-variant/10 mx-2" />
                <div className="flex items-center gap-2 label-small opacity-30 uppercase tracking-widest font-mono">
                  <FileCode size={10} />
                  <span>{isVfsMode ? activeDiff.filePath : (Array.isArray(diffData) ? `${diffData.length} FILES` : diffData.path)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {(diffData || hasVfsDiff) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3"
              >
                <button 
                  onClick={isVfsMode ? discardChanges : onDiscard}
                  disabled={isThinking}
                  className="label-small uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5"
                >
                  <X size={10} /> REJECT
                </button>
                <button
                  onClick={isVfsMode ? commitToPhysicalDisk : () => onApply(diffData)}
                  disabled={isThinking}
                  className="bg-primary text-on-primary label-small uppercase tracking-widest font-bold px-4 py-1.5 rounded-md flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/10"
                >
                  <Check size={10} /> {isVfsMode ? 'APPROVE_WRITE' : 'APPLY_PATCH'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-auto p-4 md:p-8 scrollbar-none">
        <AnimatePresence mode="wait">
          {diffChunk ? (
            <motion.div 
              key="diff-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-4"
            >
              <div className="rounded-xl border border-outline-variant/10 overflow-hidden bg-on-surface/[0.01]">
                <div className="bg-on-surface/[0.02] px-5 py-3 border-b border-outline-variant/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 label-small text-on-surface-variant/40 uppercase tracking-widest font-bold">
                    <Code size={12} className="text-primary" /> 
                    <span>SEGMENT: L{diffChunk.startLine} — L{diffChunk.startLine + 40}</span>
                  </div>
                  <div className="label-small text-on-surface-variant/20 uppercase tracking-widest font-mono">
                    {diffChunk.totalLines} LN_TOTAL
                  </div>
                </div>
                
                <div className="p-2 md:p-4">
                  <ReactDiffViewer
                    oldValue={diffChunk.old}
                    newValue={diffChunk.new}
                    splitView={true}
                    useDarkTheme={true}
                    styles={{
                      variables: {
                        dark: {
                          diffViewerBackground: 'transparent',
                          addedBackground: 'rgba(var(--primary-rgb), 0.05)',
                          addedColor: 'var(--primary)',
                          removedBackground: 'rgba(var(--error-rgb), 0.05)',
                          removedColor: 'var(--error)',
                          wordAddedBackground: 'rgba(var(--primary-rgb), 0.15)',
                          wordRemovedBackground: 'rgba(var(--error-rgb), 0.15)',
                          gutterBackground: 'transparent',
                          gutterColor: 'var(--outline-variant)',
                        }
                      },
                      contentText: {
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                        lineHeight: '1.7',
                      },
                      line: {
                        padding: '1px 0',
                        '&:hover': { background: 'rgba(var(--on-surface-rgb), 0.02)' }
                      },
                      gutter: {
                        padding: '0 15px',
                        minWidth: '60px',
                        opacity: 0.3,
                        borderRight: '1px solid rgba(var(--outline-variant-rgb), 0.05)'
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full items-center justify-center p-8 text-center"
            >
              <div className="max-w-md">
                <div className="relative mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant/10 bg-on-surface/[0.01]">
                  <GitPullRequest size={28} className="text-primary/20" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} 
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute inset-0 bg-primary/20 blur-[25px] rounded-full"
                  />
                </div>
                <h3 className="label-large uppercase tracking-[0.2em] opacity-80">Injection Buffer Empty</h3>
                <p className="mt-4 body-small text-on-surface-variant/40 leading-relaxed">
                  The surgical projection surface is in standby. 
                  Generated code patches will be queued here for ingestion review.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-outline-variant/5 bg-on-surface/[0.01]">
                    <Sparkles size={14} className="mx-auto mb-3 text-primary opacity-40" />
                    <p className="label-small uppercase tracking-widest opacity-20">Auto Review</p>
                  </div>
                  <div className="p-4 rounded-lg border border-outline-variant/5 bg-on-surface/[0.01]">
                    <Zap size={14} className="mx-auto mb-3 text-secondary opacity-40" />
                    <p className="label-small uppercase tracking-widest opacity-20">Turbo Apply</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Agent working indicator */}
      <AnimatePresence>
        {isThinking && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="px-6 py-3 bg-surface-container-highest border border-outline-variant/20 rounded-full shadow-2xl flex items-center gap-4">
              <div className="flex gap-1">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} 
                    transition={{ repeat: Infinity, duration: 1.2, delay }} 
                    className="w-1.5 h-1.5 bg-primary rounded-full" 
                  />
                ))}
              </div>
              <span className="label-small uppercase tracking-widest font-bold text-primary">
                Ingesting Patch...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
