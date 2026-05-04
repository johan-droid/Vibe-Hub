import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode2, X, Hash, Code2, FileJson, FileText, FileImage, Layout, ChevronRight } from 'lucide-react';
import { useStore } from '../../../store/useStore';

const FILE_ICONS = {
  js: { Icon: Code2, color: 'text-google-blue' },
  jsx: { Icon: Code2, color: 'text-google-blue' },
  ts: { Icon: Code2, color: 'text-google-blue' },
  tsx: { Icon: Code2, color: 'text-google-blue' },
  json: { Icon: FileJson, color: 'text-google-yellow' },
  css: { Icon: Hash, color: 'text-google-red' },
  scss: { Icon: Hash, color: 'text-google-red' },
  md: { Icon: FileText, color: 'text-google-green' },
};

function getIcon(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || { Icon: FileCode2, color: 'text-on-surface-variant' };
}

/**
 * EditorTabs — Multi-tab Navigation
 * Refined for a professional "common people" perspective.
 */
export const EditorTabs = React.memo(function EditorTabs() {
  const { openFiles, activeFilePath, openFile, closeFile } = useStore();
  
  if (openFiles.length === 0) return null;

  return (
    <div className="h-12 flex items-center bg-[#faf8f5] border-b border-black/[0.03] overflow-x-auto scrollbar-none gap-1 px-4 shrink-0">
      <AnimatePresence initial={false}>
        {openFiles.map((file) => {
          const isActive = activeFilePath === file.path;
          const { Icon, color } = getIcon(file.path);
          return (
            <motion.div 
              key={file.path}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => openFile(file.path, file.content)}
              className={`
                h-10 flex items-center gap-3 px-5 rounded-xl cursor-pointer transition-all duration-500 select-none shrink-0 group relative
                ${isActive 
                  ? 'bg-white text-on-surface shadow-sm ring-1 ring-black/[0.03]' 
                  : 'text-on-surface-variant/40 hover:text-on-surface hover:bg-white/40'}
              `}
            >
              {isActive && (
                <motion.div 
                  layoutId="tab-active-indicator"
                  className="absolute bottom-0 left-4 right-4 h-0.5 bg-google-blue rounded-full shadow-[0_0_8px_rgba(66,133,244,0.4)]"
                />
              )}
              
              <Icon size={14} className={isActive ? color : 'opacity-40 group-hover:opacity-100 transition-opacity'} />
              
              <span className={`text-[11px] font-black uppercase tracking-widest truncate max-w-[140px] ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'} transition-opacity`}>
                {file.path.split('/').pop()}
              </span>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.path);
                }}
                className={`
                  ml-2 rounded-lg p-1 transition-all duration-500
                  ${isActive ? 'opacity-40 hover:opacity-100 hover:bg-black/5' : 'opacity-0 group-hover:opacity-40 hover:opacity-100 hover:bg-black/5'}
                `}
              >
                <X size={10} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
