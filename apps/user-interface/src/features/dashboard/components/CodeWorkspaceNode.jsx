import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, FileCode2, AlertCircle } from 'lucide-react';
import DiffViewer from '../../editor/components/DiffViewer';
import { FileViewer } from '../../editor/components/FileViewer';

export function CodeWorkspaceNode({ data }) {
  const { diffData, agentLoopStatus, vfsInstance, openFiles, activeFilePath } = data;

  const handleApprove = async () => {
    if (vfsInstance && diffData?.path) {
      try {
        await vfsInstance.commitToDisk(diffData.path);
        // Dispatch event or update state to clear diff
      } catch (err) {
        console.error('Failed to commit:', err);
      }
    }
  };

  const handleReject = async () => {
    if (vfsInstance && diffData?.path) {
       // Assuming wipe logic or reverting
       console.log('Rejected diff for', diffData.path);
    }
  };

  const isFailed = agentLoopStatus?.status === 'fatal_failure' || agentLoopStatus?.error;
  const isDrafting = agentLoopStatus?.status === 'drafting_code' || agentLoopStatus?.status === 'sandboxing';

  const activeContent = useMemo(() => {
    if (openFiles && activeFilePath) {
      const file = openFiles.find(f => f.path === activeFilePath);
      return file ? file.content : null;
    }
    return null;
  }, [openFiles, activeFilePath]);


  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, x: -50 }}
      animate={{ scale: 1, opacity: 1, x: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="relative z-40 flex h-[500px] w-[800px] max-w-[90vw] flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-container-lowest/80 shadow-2xl backdrop-blur-3xl"
    >
      <Handle type="target" position={Position.Left} id="b" className="hidden h-3 w-3 border-none bg-primary" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
           <FileCode2 size={16} className={isDrafting ? 'animate-pulse text-primary' : 'text-primary/70'} />
           <span>{diffData?.path || activeFilePath || 'Workspace'}</span>
        </div>

        {isFailed && (
          <div className="flex items-center gap-1.5 rounded-full bg-error/10 px-3 py-1 text-xs font-semibold text-error">
            <AlertCircle size={12} />
            Self-Healing in progress...
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {diffData ? (
             <motion.div
               key="diff"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="custom-scrollbar h-full w-full overflow-auto"
             >
               <DiffViewer
                 onApply={handleApprove}
                 onDiscard={handleReject}
                 // pass context or use store within DiffViewer
               />
             </motion.div>
          ) : activeContent !== null ? (
            <motion.div
               key="file"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="h-full w-full"
             >
                <FileViewer path={activeFilePath} content={activeContent} />
             </motion.div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-on-surface-variant/30">
               No active context
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar (Only show if there's a diff pending) */}
      <AnimatePresence>
        {diffData && !isDrafting && !isFailed && (
           <motion.div
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 20, opacity: 0 }}
             className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-surface-container-high/90 p-1.5 shadow-xl backdrop-blur-xl"
           >
             <button
               onClick={handleReject}
               className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error transition-colors hover:bg-error/20"
               title="Reject Changes"
               aria-label="Reject Changes"
             >
               <X size={18} />
             </button>
             <div className="mx-1 h-6 w-px bg-white/10" />
             <button
               onClick={handleApprove}
               className="flex h-10 items-center gap-2 rounded-full bg-primary/20 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/30"
               title="Approve Changes"
               aria-label="Approve Changes"
             >
               <Check size={18} />
               APPROVE
             </button>
           </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
