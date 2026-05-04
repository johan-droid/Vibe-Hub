import React from 'react';
import { motion } from 'framer-motion';
import { FileCode2, X, Hash, Code } from 'lucide-react';
import { useStore } from '../../../store/useStore';

function getIcon(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'css' || ext === 'scss') return Hash;
  if (['js', 'jsx', 'ts', 'tsx', 'json'].includes(ext)) return Code;
  return FileCode2;
}

/**
 * EditorTabs — Multi-tab Navigation
 * Management of the active set of files in the principal workspace.
 */
export const EditorTabs = React.memo(function EditorTabs() {
  const { openFiles, activeFilePath, openFile, closeFile } = useStore();
  
  if (openFiles.length === 0) return null;

  return (
    <div className="h-9 flex items-center bg-surface-container-lowest border-b border-outline-variant/10 overflow-x-auto scrollbar-none gap-0 shrink-0">
      {openFiles.map((file) => {
        const isActive = activeFilePath === file.path;
        const Icon = getIcon(file.path);
        return (
          <div 
            key={file.path}
            onClick={() => openFile(file.path, file.content)}
            className={`
              h-full flex items-center gap-2.5 px-4 border-r border-outline-variant/10 cursor-pointer transition-all duration-200 select-none shrink-0 group
              ${isActive 
                ? 'bg-on-surface/[0.03] text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary relative' 
                : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-on-surface/[0.01]'}
            `}
          >
            <Icon size={12} className={isActive ? 'text-primary' : 'opacity-40 group-hover:opacity-100'} />
            <span className="label-small uppercase tracking-widest truncate max-w-[120px] font-bold">
              {file.path.split('/').pop()}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={`
                ml-1 rounded-md p-0.5 transition-all duration-200
                ${isActive ? 'opacity-100 hover:bg-primary/10' : 'opacity-0 group-hover:opacity-40 hover:opacity-100 hover:bg-on-surface/10'}
              `}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
});
