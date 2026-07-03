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
          flex items-center gap-2.5 h-8 px-3 rounded-md cursor-pointer select-none
          transition-all duration-200 group relative mx-1
          ${isActive 
            ? 'bg-primary/10 text-primary' 
            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}
        `}
        style={{ paddingLeft: `${depth * 16 + 16}px` }}
      >
        {/* Active Marker */}
        {isActive && (
          <motion.div 
            layoutId="active-vfs-marker"
            className="absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full bg-primary" 
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
        <span className={`min-w-0 flex-1 truncate text-[13px] leading-none tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
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
    <div className="flex h-full flex-col overflow-hidden border-r border-outline-variant bg-surface-container-lowest">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
             <Box size={14} />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            Explorer
          </span>
        </div>
        {vfsStatus === 'booting' && (
          <div className="flex items-center gap-2">
             <Loader2 size={12} className="animate-spin text-primary" />
             <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Scanning</span>
          </div>
        )}
      </div>

      <div className="shrink-0 p-4">
        <div className="relative flex items-center group">
          <Search size={15} className="pointer-events-none absolute left-3.5 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-10 pr-4
              text-sm font-medium text-on-surface placeholder:text-on-surface-variant/55
              transition-all focus:border-primary/40 focus:bg-surface-container-lowest focus:outline-none
            "
          />
        </div>
      </div>

      <div className="scrollbar-none flex-1 space-y-0.5 overflow-y-auto px-1 pb-6">
        {isEmpty ? (
          <div className="flex h-64 flex-col items-center justify-center gap-5 px-8 text-center">
            <div className={`h-3 w-3 rounded-full bg-google-blue/10 ${vfsStatus === 'booting' ? 'animate-pulse bg-google-blue/40' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
              {vfsStatus === 'booting' ? 'Preparing Workspace...' : 'No files found.'}
            </span>
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Search size={24} className="text-on-surface-variant/25" />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">No Matches</span>
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

      <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3">
         <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
           <span className="flex items-center gap-2"><GitBranch size={10} /> Main</span>
           <span className="flex items-center gap-2"><HardDrive size={10} /> Ready</span>
         </div>
      </div>
    </div>
  );
}
