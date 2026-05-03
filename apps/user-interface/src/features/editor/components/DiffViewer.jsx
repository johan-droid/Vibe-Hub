import React, { useMemo, useEffect } from 'react';
import { Eye, Code, FileCode, GitPullRequest, ChevronRight, X, Check, Github, Terminal } from 'lucide-react';
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

  let renderDiff = diffChunk;
  let title = "Review";
  let isVfsMode = false;

  if (hasVfsDiff) {
    title = `VFS Review: ${activeDiff.filePath}`;
    isVfsMode = true;
  } else if (diffData && diffData.type === 'github_pr') {
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
            <h2 className="title-small text-on-surface">{title}</h2>
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
                    Apply change
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
              className="flex min-h-full items-center justify-center px-4 py-8"
            >
              <Surface elevation={1} shape="2xl" className="w-full max-w-4xl border border-outline-variant/30 bg-surface-container-low/75 p-6 shadow-xl shadow-black/10 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  <Surface elevation={2} shape="md" className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/10">
                    <GitPullRequest size={18} className="text-primary" />
                  </Surface>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary">Review surface</p>
                    <h3 className="headline-small mt-2 text-on-surface">No active change is loaded</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                      This page stays quiet until Selina creates a patch or a PR diff is attached. When that happens, the exact before-and-after code appears here for review before anything is applied.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {[
                        { icon: Eye, label: 'Review', value: 'Waiting', tone: 'text-primary/70' },
                        { icon: Code, label: 'Changes', value: 'None', tone: 'text-secondary/70' },
                        { icon: Check, label: 'Write gate', value: 'Manual', tone: 'text-tertiary/70' },
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
                        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                          <Terminal size={13} className="text-primary" />
                          Runtime evidence
                        </div>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          Terminal output and agent activity stay available while a change is being prepared.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/55 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                          <ChevronRight size={13} className="text-secondary" />
                          Next action
                        </div>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          Open a file from the explorer or ask Selina to make a small, reviewable change.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Surface>
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
              <span className="text-sm font-semibold text-primary">
                Selina is preparing the change
              </span>
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}
