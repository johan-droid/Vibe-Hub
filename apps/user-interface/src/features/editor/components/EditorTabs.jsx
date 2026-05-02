import React from 'react';
import { motion } from 'framer-motion';
import { FileCode2, X } from 'lucide-react';
import { useStore } from '../../../store/useStore';

/**
 * EditorTabs — Multi-tab Navigation
 * Management of the active set of files in the principal workspace.
 */
export const EditorTabs = React.memo(function EditorTabs() {
  const { openFiles, activeFilePath, openFile, closeFile } = useStore();
  
  if (openFiles.length === 0) return null;

  return (
    <div className="h-12 flex items-center px-4 bg-surface-container-low/30 border-b border-outline-variant/10 overflow-x-auto scrollbar-none gap-1 shrink-0">
      {openFiles.map((file) => {
        const isActive = activeFilePath === file.path;
        return (
          <div 
            key={file.path}
            onClick={() => openFile(file.path, file.content)}
            className={`
              h-9 flex items-center gap-3 px-4 rounded-t-lg cursor-pointer transition-all duration-300 select-none shrink-0
              ${isActive 
                ? 'bg-surface-container-lowest text-primary border-t border-x border-outline-variant/20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]' 
                : 'text-on-surface-variant opacity-40 hover:opacity-100 hover:bg-surface-container-high/50'}
            `}
          >
            <FileCode2 size={14} className={isActive ? 'text-primary' : ''} />
            <span className="label-small font-bold truncate max-w-[140px] uppercase tracking-tight">
              {file.path.split('/').pop()}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className="hover:bg-error/10 hover:text-error rounded-full p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
});
