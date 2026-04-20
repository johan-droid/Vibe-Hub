import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, FileJson, FileText, FileBadge, Github, ChevronRight, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileTree() {
  const { vfsTree, setActiveFile, vfsStatus } = useStore();
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  const toggleExpand = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getIcon = (name, isDir) => {
    if (isDir) return expanded[name] ? <FolderOpen size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />;
    const ext = name.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx': return <FileCode size={14} className="text-yellow-400" />;
      case 'json': return <FileJson size={14} className="text-blue-300" />;
      case 'css': return <FileText size={14} className="text-cyan-400" />;
      case 'md': return <FileBadge size={14} className="text-emerald-400" />;
      default: return <FileText size={14} className="text-zinc-500" />;
    }
  };

  const renderItem = (item, depth = 0) => {
    const isDir = typeof item.isDirectory === 'function' ? item.isDirectory() : false;
    const isExpanded = expanded[item.name];
    
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return null;

    return (
      <div key={`${depth}-${item.name}`}>
        <motion.div 
          initial={{ x: -5, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={() => isDir ? toggleExpand(item.name) : setActiveFile(item.name, "// Content loading from VFS...")}
          className="flex items-center gap-2 text-zinc-400 py-1.5 px-2 hover:bg-white/5 hover:text-white transition-all cursor-pointer rounded-md group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isDir && (
              <ChevronRight size={10} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
            )}
            {getIcon(item.name, isDir)}
            <span className="truncate text-[11px] font-mono leading-none">{item.name}</span>
          </div>
        </motion.div>
        
        {/* Children would go here if we had a flat list with path info or fetched lazily */}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/50 p-2 overflow-hidden select-none">
      <div className="p-2 mb-2">
        <div className="relative group">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-cyan-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search VFS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md pl-8 pr-2 py-1.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-cyan-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono scrollbar-hide space-y-px">
        {vfsTree.length > 0 ? (
          vfsTree.map(item => renderItem(item))
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4">
            <div className={`w-1 h-1 rounded-full bg-zinc-800 mb-2 ${vfsStatus === 'booting' ? 'animate-ping' : ''}`} />
            <div className="text-[10px] text-zinc-700 uppercase tracking-[0.2em] italic">
              {vfsStatus === 'booting' ? 'Scanning_VFS...' : 'VFS_Empty'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
