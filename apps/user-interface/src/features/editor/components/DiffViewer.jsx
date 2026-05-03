import React, { useMemo } from 'react';
import { Eye, Zap, Code, FileCode, GitPullRequest, ChevronRight, X, Check, Github, Terminal } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../../../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Surface } from '../../shared/components/Surface';
import { Button } from '../../shared/components/Button';
import { IconButton } from '../../shared/components/IconButton';

/**
 * DiffViewer — Material 3 Surgical Projection
 * Optimized for professional code orchestration and visual clarity.
 */
export default function DiffViewer({ onApply, onDiscard }) {
  const { diffData, isThinking, neuralStatus } = useStore();

  const diffChunk = useMemo(() => {
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
      totalLines: newLines.length
    };
  }, [diffData]);

  // Mock GitHub Diff support, we fall back to existing diff chunk logic
  const githubDiffChunk = useMemo(() => {
      if (!diffData || !diffData.patch) return null;
      // We will parse patch later when fully integrating GitHub Diff parsing
      return {
          old: "// Github PR Difference loading...",
          new: "// PR Code differences",
          startLine: 1,
          totalLines: 0
      };
  }, [diffData]);

  let renderDiff = diffChunk;
  let title = "Projection";

  if (diffData && diffData.type === 'github_pr') {
      renderDiff = githubDiffChunk;
            title = `PR #${diffData.prNumber} (${diffData.repo})`;
  }

  return (
    <Surface elevation={0} className="h-full bg-surface-container-lowest flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50 backdrop-blur-xl select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Surface elevation={2} shape="md" className="w-8 h-8 flex items-center justify-center bg-primary/10">
              <GitPullRequest size={16} className="text-primary" />
            </Surface>
            <h2 className="label-large font-bold text-on-surface uppercase tracking-widest opacity-60">{title}</h2>
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
                  <span className="label-small text-on-surface-variant font-mono">{Array.isArray(diffData) ? `${diffData.length} files (PR View)` : diffData.path}</span>
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
                {diffData.type === 'github_pr' ? (
                  <Button
                    variant="filled"
                    size="sm"
                    onClick={() => onApply(diffData)}
                    disabled={isThinking}
                    leadingIcon={Github}
                    className="shadow-lg shadow-primary/20"
                  >
                    Merge to Main
                  </Button>
                ) : (
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
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-auto p-6 scrollbar-none">
        <AnimatePresence mode="wait">
          {renderDiff ? (
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
                    <span>Lines {renderDiff.startLine} — {renderDiff.startLine + 40}</span>
                  </div>
                  <div className="label-small text-on-surface-variant font-bold opacity-40">
                    {renderDiff.totalLines} lines total
                  </div>
                </div>
                
                <div className="p-4 bg-surface">
                  <ReactDiffViewer
                    oldValue={renderDiff.old}
                    newValue={renderDiff.new}
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
              className="h-full flex flex-col"
            >
              {/* Empty State Header */}
              <div className="flex h-14 items-center justify-between px-6 border-b border-outline-variant/20 bg-surface-container-low/30">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <GitPullRequest size={14} className="text-primary" />
                  <span>No active diff</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant/50">Connected providers:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-surface-container-high flex items-center justify-center" title="GitHub">
                      <Github size={12} />
                    </div>
                    <div className="w-5 h-5 rounded bg-surface-container-high flex items-center justify-center" title="Google">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empty State Content */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-lg">
                  {/* Status Cards */}
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/20 text-center">
                      <Eye size={20} className="mx-auto mb-2 text-primary/60" />
                      <p className="text-xs text-on-surface-variant">Review</p>
                      <p className="text-sm font-medium text-on-surface">Pending</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/20 text-center">
                      <Code size={20} className="mx-auto mb-2 text-secondary/60" />
                      <p className="text-xs text-on-surface-variant">Changes</p>
                      <p className="text-sm font-medium text-on-surface">None</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-container-high/50 border border-outline-variant/20 text-center">
                      <Check size={20} className="mx-auto mb-2 text-tertiary/60" />
                      <p className="text-xs text-on-surface-variant">Status</p>
                      <p className="text-sm font-medium text-on-surface">Idle</p>
                    </div>
                  </div>

                  {/* Main Message */}
                  <div className="text-center">
                    <h3 className="headline-small text-on-surface mb-2">Projection Ready</h3>
                    <p className="text-sm text-on-surface-variant mb-6 max-w-sm mx-auto">
                      Ask Selina to make changes, review PRs, or audit code. Diffs will appear here for surgical review.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high border border-outline-variant/30">
                      <Zap size={14} className="text-primary" />
                      <span className="text-xs text-on-surface-variant">AI-powered diff engine active</span>
                    </div>
                  </div>
                </div>
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
