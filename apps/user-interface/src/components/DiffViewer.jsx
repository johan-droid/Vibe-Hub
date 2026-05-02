import React, { useMemo } from 'react';
import { Eye, Zap, Code, FileCode, GitPullRequest, ChevronRight, X, Check } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Surface } from './ui/Surface';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

/**
 * DiffViewer — Material 3 Surgical Projection
 * Optimized for professional code orchestration and visual clarity.
 */
export default function DiffViewer({ onApply, onDiscard }) {
  const { diffData, isThinking, neuralStatus } = useStore();

  const diffChunk = useMemo(() => {
    if (!diffData || !diffData.oldValue || !diffData.newValue) return null;
    
    const oldLines = diffData.oldValue.split('\n');
    const newLines = diffData.newValue.split('\n');
    
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
      totalLines: newLines.length
    };
  }, [diffData]);

  return (
    <Surface elevation={0} className="h-full bg-surface-container-lowest flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 backdrop-blur-xl select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Surface elevation={2} shape="md" className="w-8 h-8 flex items-center justify-center bg-primary/10">
              <GitPullRequest size={16} className="text-primary" />
            </Surface>
            <h2 className="label-large font-bold text-on-surface uppercase tracking-widest opacity-60">Projection</h2>
          </div>
          
          <AnimatePresence mode="wait">
            {diffData && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center"
              >
                <div className="w-px h-4 bg-outline-variant/30 mx-2" />
                <Surface elevation={1} shape="full" className="flex items-center gap-2 px-3 py-1 border border-outline-variant/30 bg-surface-container-high/40">
                  <FileCode size={12} className="text-primary opacity-60" />
                  <span className="label-small text-on-surface-variant font-mono">{diffData.path}</span>
                </Surface>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {diffData && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3"
              >
                <Button 
                  variant="text" 
                  size="sm" 
                  onClick={onDiscard}
                  disabled={isThinking}
                  leadingIcon={X}
                >
                  Discard
                </Button>
                <Button 
                  variant="filled" 
                  size="sm" 
                  onClick={() => onApply(diffData)}
                  disabled={isThinking}
                  leadingIcon={Check}
                  className="shadow-lg shadow-primary/20"
                >
                  Apply Mutation
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-auto p-6 scrollbar-none">
        <AnimatePresence mode="wait">
          {diffChunk ? (
            <motion.div 
              key="diff-content"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="max-w-7xl mx-auto"
            >
              <Surface elevation={2} shape="xl" className="border border-outline-variant/30 overflow-hidden bg-surface shadow-2xl">
                <div className="bg-surface-container-high/50 px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-3 label-medium text-on-surface-variant uppercase tracking-widest opacity-60">
                    <Code size={14} className="text-primary" /> 
                    <span>Lines {diffChunk.startLine} — {diffChunk.startLine + 40}</span>
                  </div>
                  <div className="label-small text-on-surface-variant font-bold opacity-40">
                    {diffChunk.totalLines} lines total
                  </div>
                </div>
                
                <div className="p-4 bg-surface">
                  <ReactDiffViewer
                    oldValue={diffChunk.old}
                    newValue={diffChunk.new}
                    splitView={true}
                    useDarkTheme={true}
                    codeFoldGutter={true}
                    styles={{
                      variables: {
                        dark: {
                          diffViewerBackground: 'transparent',
                          diffViewerTitleBackground: 'transparent',
                          diffViewerTitleColor: 'var(--on-surface-variant)',
                          addedBackground: 'rgba(var(--primary-rgb), 0.08)',
                          addedColor: 'var(--primary)',
                          removedBackground: 'rgba(var(--error-rgb), 0.08)',
                          removedColor: 'var(--error)',
                          wordAddedBackground: 'rgba(var(--primary-rgb), 0.2)',
                          wordRemovedBackground: 'rgba(var(--error-rgb), 0.2)',
                          gutterBackground: 'transparent',
                          gutterColor: 'var(--outline-variant)',
                          codeFoldGutterBackground: 'transparent',
                          codeFoldBackground: 'var(--surface-container-low)',
                          codeFoldContentColor: 'var(--on-surface-variant)'
                        }
                      },
                      contentText: {
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono, monospace',
                        lineHeight: '1.8',
                        letterSpacing: '-0.01em'
                      },
                      line: {
                        padding: '2px 0',
                        '&:hover': {
                          background: 'rgba(var(--on-surface-rgb), 0.03)'
                        }
                      },
                      gutter: {
                        padding: '0 20px',
                        minWidth: '70px',
                        borderRight: '1px solid rgba(var(--outline-variant-rgb), 0.1)'
                      }
                    }}
                  />
                </div>
              </Surface>
            </motion.div>
          ) : (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-8"
            >
              <Surface elevation={1} shape="2xl" className="w-32 h-32 flex items-center justify-center bg-surface-container-high border border-outline-variant/20 relative group">
                <div className="absolute inset-0 bg-primary/5 rounded-[inherit] scale-0 group-hover:scale-110 transition-transform duration-700 ease-emphasized" />
                <motion.div
                  animate={{ 
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                >
                  <Zap size={48} className="text-primary opacity-20" />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 border-2 border-primary/10 border-dashed rounded-full animate-[spin_20s_linear_infinite]" />
                </div>
              </Surface>
              <div className="space-y-3">
                <h3 className="headline-small text-on-surface opacity-40">Ready for Intelligence</h3>
                <p className="label-large text-on-surface-variant opacity-30 max-w-xs">
                  Propose a change through chat to initiate a surgical code mutation.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Neural Monitor */}
      <AnimatePresence>
        {isThinking && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
          >
            <Surface elevation={5} shape="full" className="px-8 py-4 bg-surface-container-highest border border-outline-variant shadow-2xl flex items-center gap-6">
              <div className="flex gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} 
                    transition={{ repeat: Infinity, duration: 1.2, delay }} 
                    className="w-1.5 h-1.5 bg-primary rounded-full" 
                  />
                ))}
              </div>
              <span className="label-large font-bold text-primary uppercase tracking-[0.2em]">
                Neural_Processing
              </span>
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}
