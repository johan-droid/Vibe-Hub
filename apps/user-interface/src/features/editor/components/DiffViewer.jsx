import React, { useMemo, useEffect } from 'react';
import { Eye, Zap, Code, FileCode, GitPullRequest, ChevronRight, X, Check, Github, Terminal } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useStore } from '../../../store/useStore';
import { useVfsStore } from '../../../store/useVfsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Surface } from '../../shared/components/Surface';
import { Button } from '../../shared/components/Button';

/**
 * DiffViewer — Material 3 Surgical Projection
 * Optimized for professional code orchestration and visual clarity.
 */
export default function DiffViewer({ onApply, onDiscard }) {
  const { diffData, isThinking, neuralStatus } = useStore();
  
  // VFS Integration: Check for staged files awaiting approval
  const { 
    activeDiff, 
    isReviewing, 
    discardChanges, 
    commitToPhysicalDisk,
    pendingFiles,
    fetchPendingFiles 
  } = useVfsStore();

  // Fetch pending VFS files on mount
  useEffect(() => {
    fetchPendingFiles();
  }, [fetchPendingFiles]);

  // Check if we have VFS staged changes
  const hasVfsDiff = isReviewing && activeDiff;

  const diffChunk = useMemo(() => {
    // Priority 1: VFS staged changes (agent-generated code awaiting approval)
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
    
    // Priority 2: Legacy diffData from store
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
  let isVfsMode = false;

  if (hasVfsDiff) {
    title = `VFS Review: ${activeDiff.filePath}`;
    isVfsMode = true;
  } else if (diffData && diffData.type === 'github_pr') {
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
            {(diffData || hasVfsDiff) && (
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
                {isVfsMode ? (
                  // VFS Approval Gate: Reject / Approve & Write
                  <>
                    <Button 
                      variant="text" 
                      size="sm" 
                      onClick={discardChanges}
                      disabled={isThinking}
                      leadingIcon={X}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="filled"
                      size="sm"
                      onClick={commitToPhysicalDisk}
                      disabled={isThinking}
                      leadingIcon={Check}
                      className="shadow-lg shadow-primary/20"
                    >
                      Approve & Write
                    </Button>
                  </>
                ) : diffData?.type === 'github_pr' ? (
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
              className="flex min-h-full flex-col"
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
              <div className="flex-1 overflow-auto px-6 py-6 lg:px-8">
                <div className="mx-auto grid w-full max-w-6xl gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                  <Surface elevation={1} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-6 shadow-xl shadow-black/10 md:p-7">
                    <div className="flex items-start gap-4">
                      <Surface elevation={2} shape="md" className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/10">
                        <GitPullRequest size={18} className="text-primary" />
                      </Surface>
                      <div className="min-w-0">
                        <p className="label-small text-primary">Projection Ready</p>
                        <h3 className="headline-small mt-2 text-on-surface">No active diff is loaded</h3>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                          Ask Selina to make changes, review PRs, or audit code. Diffs will appear here for surgical review.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        { icon: Eye, label: 'Review', value: 'Pending', tone: 'text-primary/70' },
                        { icon: Code, label: 'Changes', value: 'None', tone: 'text-secondary/70' },
                        { icon: Check, label: 'Status', value: 'Idle', tone: 'text-tertiary/70' },
                      ].map(({ icon: Icon, label, value, tone }) => (
                        <div key={label} className="rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 p-4">
                          <Icon size={18} className={`mb-3 ${tone}`} />
                          <p className="text-xs text-on-surface-variant">{label}</p>
                          <p className="text-sm font-medium text-on-surface">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/55 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant/60">
                          <Terminal size={13} className="text-primary" />
                          Runtime linked
                        </div>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          Use the runtime panel below to stream commands, diagnostics, and agent output while you iterate.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/55 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant/60">
                          <ChevronRight size={13} className="text-secondary" />
                          Next action
                        </div>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          Open a file from the explorer or ask Selina to stage a change, then this projection surface will populate automatically.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-high/50 px-4 py-2">
                      <Zap size={14} className="text-primary" />
                      <span className="text-xs text-on-surface-variant">AI-powered diff engine active</span>
                    </div>
                  </Surface>

                  <div className="grid gap-5">
                    <Surface elevation={1} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="label-small text-on-surface-variant">Connected providers</p>
                          <h4 className="title-small mt-1 text-on-surface">Ready for review input</h4>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-tertiary/20 bg-tertiary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                          <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                          Live
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 px-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-highest text-on-surface-variant">
                            <Github size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-on-surface">GitHub</p>
                            <p className="text-xs text-on-surface-variant">PR parsing and apply actions</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 px-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-highest text-on-surface-variant">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-on-surface">Google</p>
                            <p className="text-xs text-on-surface-variant">Identity and workspace access</p>
                          </div>
                        </div>
                      </div>
                    </Surface>

                    <Surface elevation={1} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
                      <p className="label-small text-primary">Workspace posture</p>
                      <h4 className="title-small mt-2 text-on-surface">Projection waits until something is worth reviewing.</h4>
                      <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                        The screen stays compact and readable, so the workspace feels deliberate instead of empty when no patch is active.
                      </p>
                    </Surface>
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
