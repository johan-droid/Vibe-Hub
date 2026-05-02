import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  Folder, FolderOpen, FileCode, FileJson, FileText, FileBadge,
  FileImage, FileArchive, ChevronRight, Search, Loader2, GitBranch,
  CircleDot, PenLine, Lock
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Surface } from './ui/Surface';

// ─── Pure Icon Mapping ────────────────────────────────────────────────────────
const FILE_ICONS = {
  js: { Icon: FileCode, color: 'text-primary' },
  jsx: { Icon: FileCode, color: 'text-primary' },
  ts: { Icon: FileCode, color: 'text-secondary' },
  tsx: { Icon: FileCode, color: 'text-secondary' },
  json: { Icon: FileJson, color: 'text-tertiary' },
  css: { Icon: FileText, color: 'text-primary' },
  scss: { Icon: FileText, color: 'text-secondary' },
  md: { Icon: FileBadge, color: 'text-primary' },
  png: { Icon: FileImage, color: 'text-secondary' },
  jpg: { Icon: FileImage, color: 'text-secondary' },
  svg: { Icon: FileImage, color: 'text-secondary' },
  zip: { Icon: FileArchive, color: 'text-outline' },
};

function getIcon(name, isDir, isExpanded) {
  if (isDir) {
    return isExpanded
      ? <FolderOpen size={14} className="text-primary shrink-0" />
      : <Folder size={14} className="text-outline shrink-0" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  const mapping = FILE_ICONS[ext];
  if (mapping) return <mapping.Icon size={14} className={`${mapping.color} shrink-0 opacity-80`} />;
  return <FileText size={14} className="text-outline shrink-0 opacity-60" />;
}

const STATUS_INDICATOR = {
  modified: <CircleDot size={8} className="text-primary shrink-0 animate-pulse" />,
  unsaved: <PenLine size={8} className="text-secondary shrink-0" />,
  readonly: <Lock size={8} className="text-outline shrink-0 opacity-40" />,
};

// ─── FileNode (Memoized) ─────────────────────────────────────────────────────
const FileNode = memo(function FileNode({ item, depth, expanded, onToggle, onSelect, activeFilePath }) {
  const isDir = item.isDir || item.type === 'directory';
  const isExpanded = isDir && expanded[item.path || item.name];
  const isActive = !isDir && activeFilePath === (item.path || item.name);

  const handleClick = useCallback(() => {
    if (isDir) {
      onToggle(item.path || item.name);
    } else {
      onSelect(item.path || item.name, item.content ?? null);
    }
  }, [isDir, item, onToggle, onSelect]);

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={`
          flex items-center gap-2.5 h-8 pr-3 rounded-lg cursor-pointer select-none
          transition-all duration-200 group relative
          ${isActive 
            ? 'bg-primary/10 text-primary font-bold' 
            : 'text-on-surface-variant hover:bg-on-surface/5 hover:text-on-surface'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* State Layer Overlay */}
        <div className={`absolute inset-0 rounded-lg opacity-0 group-active:opacity-10 bg-primary transition-opacity`} />

        {/* Chevron */}
        <ChevronRight
          size={12}
          className={`
            shrink-0 transition-transform duration-300 ease-emphasized
            ${isDir ? 'opacity-40 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}
            ${isExpanded ? 'rotate-90' : ''}
          `}
        />

        {/* Icon */}
        {getIcon(item.name, isDir, isExpanded)}

        {/* Name */}
        <span className="truncate label-medium leading-none flex-1 min-w-0">
          {item.name}
        </span>

        {/* Status */}
        {item.status && (
          <span className={`ml-auto ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
            {STATUS_INDICATOR[item.status] ?? null}
          </span>
        )}
      </div>

      {/* Children */}
      {isDir && item.children?.length > 0 && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-emphasized`}
          style={{ maxHeight: isExpanded ? '2000px' : '0px', opacity: isExpanded ? 1 : 0 }}
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
    setActiveFile(path, content ?? `// VFS: Loading ${path}...`);
  }, [setActiveFile]);

  const visibleTree = useMemo(() => filterTree(vfsTree, search), [vfsTree, search]);
  const isEmpty = vfsTree.length === 0;

  return (
    <Surface elevation={0} className="flex flex-col h-full bg-surface-container-low overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center gap-3">
          <Surface elevation={2} shape="md" className="w-6 h-6 flex items-center justify-center bg-primary/10">
            <GitBranch size={14} className="text-primary" />
          </Surface>
          <span className="label-large font-bold text-on-surface uppercase tracking-widest opacity-60">
            Explorer
          </span>
        </div>
        {vfsStatus === 'booting' && (
          <Loader2 size={14} className="text-primary animate-spin" />
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-3 shrink-0">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3.5 text-on-surface-variant/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter VFS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full h-10 bg-surface-container-high border border-outline-variant/30 rounded-xl pl-10 pr-4 
              label-medium text-on-surface placeholder:text-on-surface-variant/30
              focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10
              transition-all duration-300
            "
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 scrollbar-thin">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 opacity-30">
            <div className={`w-2 h-2 rounded-full bg-primary ${vfsStatus === 'booting' ? 'animate-ping' : ''}`} />
            <span className="label-small font-mono uppercase tracking-[0.4em]">
              {vfsStatus === 'booting' ? 'Scanning_VFS' : 'Empty_VFS'}
            </span>
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="flex items-center justify-center h-32 opacity-20">
            <span className="label-small font-mono uppercase tracking-widest">No_Matches</span>
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
    </Surface>
  );
}
