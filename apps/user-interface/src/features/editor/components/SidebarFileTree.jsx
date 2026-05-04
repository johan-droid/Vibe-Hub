import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  Folder, FolderOpen, FileCode, FileJson, FileText, FileBadge,
  FileImage, FileArchive, ChevronRight, Search, Loader2, GitBranch,
  CircleDot, PenLine, Lock, Hash, Shield, HardDrive, Layout, 
  Code2, Sparkles, FolderTree, Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';

// ─── Pure Icon Mapping (Premium Professional) ──────────────────────────────────
const FILE_ICONS = {
  js: { Icon: Code2, color: 'text-google-blue' },
  jsx: { Icon: Code2, color: 'text-google-blue' },
  ts: { Icon: Code2, color: 'text-google-blue' },
  tsx: { Icon: Code2, color: 'text-google-blue' },
  json: { Icon: FileJson, color: 'text-google-yellow' },
  css: { Icon: Hash, color: 'text-google-red' },
  scss: { Icon: Hash, color: 'text-google-red' },
  md: { Icon: FileText, color: 'text-google-green' },
  png: { Icon: FileImage, color: 'text-google-red' },
  jpg: { Icon: FileImage, color: 'text-google-red' },
  svg: { Icon: FileImage, color: 'text-google-red' },
  zip: { Icon: FileArchive, color: 'text-on-surface-variant' },
};

function getIcon(name, isDir, isExpanded) {
  if (isDir) {
    return isExpanded
      ? <FolderOpen size={16} className="text-google-blue shrink-0 opacity-80" />
      : <Folder size={16} className="text-on-surface-variant shrink-0 opacity-40" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  const mapping = FILE_ICONS[ext];
  if (mapping) return <mapping.Icon size={16} className={`${mapping.color} shrink-0 opacity-70`} />;
  return <FileText size={16} className="text-on-surface-variant shrink-0 opacity-40" />;
}

const STATUS_INDICATOR = {
  modified: <div className="h-2 w-2 rounded-full bg-google-blue animate-pulse" />,
  unsaved: <div className="h-2 w-2 rounded-full bg-google-yellow" />,
  readonly: <Lock size={10} className="opacity-20" />,
};

// ─── FileNode (Memoized) ─────────────────────────────────────────────────────
const FileNode = memo(function FileNode({ item, depth, expanded, onToggle, onSelect, activeFilePath }) {
  const isDir = item.isDir || item.type === 'directory';
  const path = item.path || item.name;
  const isExpanded = isDir && expanded[path];
  const isActive = !isDir && activeFilePath === path;

  const handleClick = useCallback(() => {
    if (isDir) {
      onToggle(path);
    } else {
      onSelect(path, item.content ?? null);
    }
  }, [isDir, path, item.content, onToggle, onSelect]);

  return (
    <div className="w-full">
      <motion.div
        layout
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={`
          flex items-center gap-3.5 h-10 px-4 rounded-2xl cursor-pointer select-none
          transition-all duration-300 group relative mx-2
          ${isActive 
            ? 'bg-google-blue/[0.08] text-google-blue shadow-sm' 
            : 'text-on-surface-variant/80 hover:bg-white hover:text-on-surface hover:shadow-sm'}
        `}
        style={{ paddingLeft: `${depth * 16 + 16}px` }}
      >
        {/* Active Marker */}
        {isActive && (
          <motion.div 
            layoutId="active-vfs-marker"
            className="absolute left-1.5 top-2 bottom-2 w-1.5 bg-google-blue rounded-full" 
          />
        )}

        {/* Chevron */}
        <div className="w-4 flex justify-center shrink-0">
          {isDir && (
            <ChevronRight
              size={14}
              className={`
                transition-transform duration-500 opacity-20 group-hover:opacity-50
                ${isExpanded ? 'rotate-90' : ''}
              `}
            />
          )}
        </div>

        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
          {getIcon(item.name, isDir, isExpanded)}
        </div>

        {/* Name */}
        <span className={`truncate text-[13px] leading-none flex-1 min-w-0 tracking-tight ${isActive ? 'font-bold' : 'font-semibold opacity-70'}`}>
          {item.name}
        </span>

        {/* Status */}
        {item.status && (
          <div className="ml-auto flex items-center justify-center w-5 h-5">
            {STATUS_INDICATOR[item.status]}
          </div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isDir && item.children?.length > 0 && isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {item.children.map((child) => (
              <FileNode
                key={child.path || child.name}
                item={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                activeFilePath={activeFilePath}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Recursive Filter ────────────────────────────────────────────────────────
function filterTree(nodes, query) {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const results = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(q)) {
      results.push(node);
    } else if (node.children?.length) {
      const filteredChildren = filterTree(node.children, q);
      if (filteredChildren.length > 0) {
        results.push({ ...node, children: filteredChildren });
      }
    }
  }
  return results;
}

// ─── Main FileTree ────────────────────────────────────────────────────────────
export default function FileTree() {
  const { vfsTree, setActiveFile, vfsStatus, activeFilePath } = useStore();
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  const onToggle = useCallback((path) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const onSelect = useCallback((path, content) => {
    setActiveFile(path, content ?? `// Loading: ${path}...`);
  }, [setActiveFile]);

  const visibleTree = useMemo(() => filterTree(vfsTree, search), [vfsTree, search]);
  const isEmpty = vfsTree.length === 0;

  return (
    <div className="flex flex-col h-full bg-[#faf8f5] overflow-hidden border-r border-black/[0.03]">
      {/* Header */}
      <div className="h-16 px-8 flex items-center justify-between bg-white/50 border-b border-black/[0.03] shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-google-blue/5 text-google-blue shadow-sm">
             <Box size={14} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
            Explorer
          </span>
        </div>
        {vfsStatus === 'booting' && (
          <div className="flex items-center gap-3">
             <Loader2 size={12} className="text-google-blue animate-spin" />
             <span className="text-[9px] font-black uppercase tracking-widest text-google-blue opacity-40">Scanning</span>
          </div>
        )}
      </div>

      {/* Search Container */}
      <div className="p-6 shrink-0">
        <div className="relative flex items-center group">
          <Search size={16} className="absolute left-5 text-on-surface-variant/20 pointer-events-none group-focus-within:text-google-blue/40 transition-colors" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full h-12 bg-white border border-outline-variant/30 rounded-2xl pl-12 pr-5 
              text-sm font-bold text-on-surface placeholder:text-on-surface-variant/20
              focus:outline-none focus:border-google-blue/30 focus:shadow-2xl focus:shadow-black/[0.02]
              transition-all duration-500
            "
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-1 pb-10 space-y-0.5 scrollbar-none">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 gap-8 px-10 text-center">
            <div className={`h-3 w-3 rounded-full bg-google-blue/10 ${vfsStatus === 'booting' ? 'animate-pulse bg-google-blue/40' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-20 leading-loose">
              {vfsStatus === 'booting' ? 'Preparing Workspace...' : 'No files found.'}
            </span>
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Search size={24} className="opacity-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-10">No Matches</span>
          </div>
        ) : (
          <div className="pt-2">
            {visibleTree.map((item) => (
              <FileNode
                key={item.path || item.name}
                item={item}
                depth={0}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                activeFilePath={activeFilePath}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Meta */}
      <div className="p-6 border-t border-black/[0.03] bg-white/30 backdrop-blur-sm">
         <div className="flex items-center justify-between px-2 text-[9px] font-black opacity-20 tracking-widest uppercase">
           <span className="flex items-center gap-2"><GitBranch size={10} /> Main</span>
           <span className="flex items-center gap-2"><HardDrive size={10} /> Ready</span>
         </div>
      </div>
    </div>
  );
}
