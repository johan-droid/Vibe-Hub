import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  Folder, FolderOpen, FileCode, FileJson, FileText, FileBadge,
  FileImage, FileArchive, ChevronRight, Search, Loader2, GitBranch,
  CircleDot, PenLine, Lock, Hash, Shield
} from 'lucide-react';
import { useStore } from '../../../store/useStore';

// ─── Pure Icon Mapping (Google Inspired) ──────────────────────────────────────
const FILE_ICONS = {
  js: { Icon: FileCode, color: 'text-google-blue' },
  jsx: { Icon: FileCode, color: 'text-google-blue' },
  ts: { Icon: FileCode, color: 'text-google-blue' },
  tsx: { Icon: FileCode, color: 'text-google-blue' },
  json: { Icon: FileJson, color: 'text-google-yellow' },
  css: { Icon: Hash, color: 'text-google-red' },
  scss: { Icon: Hash, color: 'text-google-red' },
  md: { Icon: FileBadge, color: 'text-google-green' },
  png: { Icon: FileImage, color: 'text-google-red' },
  jpg: { Icon: FileImage, color: 'text-google-red' },
  svg: { Icon: FileImage, color: 'text-google-red' },
  zip: { Icon: FileArchive, color: 'text-on-surface-variant' },
};

function getIcon(name, isDir, isExpanded) {
  if (isDir) {
    return isExpanded
      ? <FolderOpen size={14} className="text-google-blue shrink-0 opacity-80" />
      : <Folder size={14} className="text-on-surface-variant shrink-0 opacity-40" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  const mapping = FILE_ICONS[ext];
  if (mapping) return <mapping.Icon size={14} className={`${mapping.color} shrink-0 opacity-80`} />;
  return <FileText size={14} className="text-on-surface-variant shrink-0 opacity-40" />;
}

const STATUS_INDICATOR = {
  modified: <div className="h-1.5 w-1.5 rounded-full bg-google-blue animate-thinking-pulse" />,
  unsaved: <div className="h-1.5 w-1.5 rounded-full bg-google-yellow" />,
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
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={`
          flex items-center gap-2.5 h-8 px-3 rounded-xl cursor-pointer select-none
          transition-all duration-200 group relative
          ${isActive 
            ? 'bg-google-blue/[0.05] text-google-blue' 
            : 'text-on-surface-variant hover:bg-on-surface/[0.02] hover:text-on-surface'}
        `}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {/* Active Marker */}
        {isActive && (
          <div className="absolute left-2 top-2 bottom-2 w-1 bg-google-blue rounded-full" />
        )}

        {/* Chevron */}
        <div className="w-3 flex justify-center shrink-0">
          {isDir && (
            <ChevronRight
              size={12}
              className={`
                transition-transform duration-300 opacity-20 group-hover:opacity-50
                ${isExpanded ? 'rotate-90' : ''}
              `}
            />
          )}
        </div>

        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center">
          {getIcon(item.name, isDir, isExpanded)}
        </div>

        {/* Name */}
        <span className={`truncate text-[12px] leading-none flex-1 min-w-0 tracking-tight ${isActive ? 'font-bold' : 'font-medium opacity-80'}`}>
          {item.name}
        </span>

        {/* Status */}
        {item.status && (
          <div className="ml-auto flex items-center justify-center w-4 h-4">
            {STATUS_INDICATOR[item.status]}
          </div>
        )}
      </div>

      {/* Children */}
      {isDir && item.children?.length > 0 && isExpanded && (
        <div className="overflow-hidden">
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
        </div>
      )}
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
    setActiveFile(path, content ?? `// VFS_LOADING_BUFFER: ${path}...`);
  }, [setActiveFile]);

  const visibleTree = useMemo(() => filterTree(vfsTree, search), [vfsTree, search]);
  const isEmpty = vfsTree.length === 0;

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest overflow-hidden border-r border-outline-variant/10">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between bg-on-surface/[0.01] border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center gap-3">
          <Shield size={14} className="text-google-green opacity-40" />
          <span className="label-small uppercase tracking-[0.3em] opacity-40 font-black">
            Explorer
          </span>
        </div>
        {vfsStatus === 'booting' && (
          <div className="flex items-center gap-2">
             <Loader2 size={12} className="text-google-blue animate-spin" />
             <span className="text-[8px] font-black uppercase tracking-widest text-google-blue opacity-40">SCANNING</span>
          </div>
        )}
      </div>

      {/* Search Container */}
      <div className="p-5 shrink-0">
        <div className="relative flex items-center group">
          <Search size={14} className="absolute left-4 text-on-surface-variant/20 pointer-events-none group-focus-within:text-google-blue/40 transition-colors" />
          <input
            type="text"
            placeholder="FILTER_VFS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full h-11 bg-on-surface/[0.02] border border-outline-variant/20 rounded-2xl pl-11 pr-4 
              label-small text-on-surface placeholder:text-on-surface-variant/20 uppercase tracking-[0.15em]
              focus:outline-none focus:border-google-blue/20 focus:bg-on-surface/[0.04] focus:ring-8 focus:ring-google-blue/5
              transition-all duration-300 font-bold
            "
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-0.5 scrollbar-none">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 gap-6 px-10 text-center">
            <div className={`w-2 h-2 rounded-full bg-google-blue/10 ${vfsStatus === 'booting' ? 'animate-thinking-pulse bg-google-blue/40' : ''}`} />
            <span className="label-small uppercase tracking-[0.3em] opacity-20 font-black leading-loose">
              {vfsStatus === 'booting' ? 'HYDRATING_VFS_TOPOLOGY' : 'VFS_ENCLAVE_EMPTY'}
            </span>
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <span className="label-small uppercase tracking-[0.4em] opacity-10 font-black">NO_MATCHES</span>
          </div>
        ) : (
          visibleTree.map((item) => (
            <FileNode
              key={item.path || item.name}
              item={item}
              depth={0}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              activeFilePath={activeFilePath}
            />
          ))
        )}
      </div>

      {/* Footer Meta */}
      <div className="p-4 border-t border-outline-variant/5 bg-on-surface/[0.005]">
         <div className="flex items-center justify-between px-2 label-small opacity-20 tracking-widest font-mono text-[8px]">
           <span className="flex items-center gap-1.5"><GitBranch size={9} /> MAIN</span>
           <span>UTF-8</span>
         </div>
      </div>
    </div>
  );
}
