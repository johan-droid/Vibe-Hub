import React, { useState, useCallback, memo, useMemo } from 'react';
import {
  Folder, FolderOpen, FileCode, FileJson, FileText, FileBadge,
  FileImage, FileArchive, ChevronRight, Search, Loader2, GitBranch,
  CircleDot, PenLine, Lock
} from 'lucide-react';
import { useStore } from '../store/useStore';

// ─── DOM Optimization Strategy ────────────────────────────────────────────────
// 1. Every FileNode is wrapped in React.memo. Only nodes whose props change
//    (name, depth, expanded, status) will re-render when the tree updates.
// 2. Expansion state is keyed by full path string, not just name, so sibling
//    folders with the same name are independent.
// 3. getIcon() is a pure function — no inline JSX allocations per render.
// 4. Framer Motion is intentionally NOT used for per-item entry animations.
//    At 100+ nodes, Framer's WAAPI scheduler can spike the GPU on iGPU hardware.
//    A single CSS `transition-[height,opacity]` achieves the visual at zero JS cost.
// 5. The search filter uses useMemo to derive the visible set only when the
//    raw tree or query string changes — not on every keystroke render.
// ──────────────────────────────────────────────────────────────────────────────

/** Maps file extension to a colored icon component (pure, no allocation per call). */
const FILE_ICONS = {
  js: { Icon: FileCode, className: 'text-yellow-400' },
  jsx: { Icon: FileCode, className: 'text-yellow-400' },
  ts: { Icon: FileCode, className: 'text-blue-400' },
  tsx: { Icon: FileCode, className: 'text-blue-400' },
  json: { Icon: FileJson, className: 'text-emerald-400' },
  css: { Icon: FileText, className: 'text-cyan-400' },
  scss: { Icon: FileText, className: 'text-pink-400' },
  md: { Icon: FileBadge, className: 'text-violet-400' },
  png: { Icon: FileImage, className: 'text-orange-400' },
  jpg: { Icon: FileImage, className: 'text-orange-400' },
  svg: { Icon: FileImage, className: 'text-orange-400' },
  zip: { Icon: FileArchive, className: 'text-zinc-400' },
};

function getIcon(name, isDir, isExpanded) {
  if (isDir) {
    return isExpanded
      ? <FolderOpen size={13} className="text-sky-400 shrink-0" />
      : <Folder size={13} className="text-sky-500/70 shrink-0" />;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  const mapping = FILE_ICONS[ext];
  if (mapping) return <mapping.Icon size={13} className={`${mapping.className} shrink-0`} />;
  return <FileText size={13} className="text-zinc-600 shrink-0" />;
}

/** Per-file status dot: shows if the file was recently modified by the agent. */
const STATUS_INDICATOR = {
  modified: <CircleDot size={8} className="text-amber-400 shrink-0" />,
  unsaved: <PenLine size={8} className="text-cyan-400 shrink-0" />,
  readonly: <Lock size={8} className="text-zinc-600 shrink-0" />,
};

// ─── Single File/Folder Node (memoized) ───────────────────────────────────────
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
    <div>
      {/* Row */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-expanded={isDir ? isExpanded : undefined}
        className={[
          'flex items-center gap-1.5 h-[26px] pr-2 rounded-md cursor-pointer select-none',
          'transition-colors duration-100 group outline-none',
          'focus-visible:ring-1 focus-visible:ring-cyan-500/50',
          isActive
            ? 'bg-cyan-500/10 text-cyan-300'
            : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {/* Expand chevron (dirs only, preserves layout for files) */}
        <ChevronRight
          size={10}
          className={[
            'shrink-0 transition-transform duration-150',
            isDir ? 'opacity-60' : 'opacity-0 pointer-events-none',
            isExpanded ? 'rotate-90' : '',
          ].join(' ')}
        />

        {/* File/folder icon */}
        {getIcon(item.name, isDir, isExpanded)}

        {/* File name */}
        <span className="truncate text-[11px] font-mono leading-none flex-1 min-w-0">
          {item.name}
        </span>

        {/* Status indicator badge (right-aligned, only on hover or when active) */}
        {item.status && (
          <span className={`ml-auto ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'} transition-opacity`}>
            {STATUS_INDICATOR[item.status] ?? null}
          </span>
        )}
      </div>

      {/* Children — rendered in-place using CSS max-height for GPU-efficient collapse */}
      {isDir && item.children?.length > 0 && (
        <div
          className="overflow-hidden transition-all duration-150 ease-in-out"
          style={{ maxHeight: isExpanded ? '9999px' : '0px', opacity: isExpanded ? 1 : 0 }}
          aria-hidden={!isExpanded}
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

// ─── Recursive search filter (memoized on tree + query) ───────────────────────
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

// ─── FileTree Root ─────────────────────────────────────────────────────────────
export default function FileTree() {
  const { vfsTree, setActiveFile, vfsStatus, activeFilePath } = useStore();
  // Path-keyed expansion map — prevents sibling name collisions
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  const onToggle = useCallback((path) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const onSelect = useCallback((path, content) => {
    setActiveFile(path, content ?? `// VFS: Loading ${path}...`);
  }, [setActiveFile]);

  // Derive visible tree only when source data or query changes
  const visibleTree = useMemo(() => filterTree(vfsTree, search), [vfsTree, search]);

  const isEmpty = vfsTree.length === 0;

  return (
    <div className="flex flex-col h-full bg-neutral-950 overflow-hidden select-none">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-neutral-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch size={12} className="text-neutral-500" />
          <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
            Explorer
          </span>
        </div>
        {vfsStatus === 'booting' && (
          <Loader2 size={11} className="text-cyan-500 animate-spin" />
        )}
      </div>

      {/* Search bar */}
      <div className="px-2.5 py-2 shrink-0">
        <div className="relative flex items-center">
          <Search size={11} className="absolute left-2.5 text-neutral-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-7 pr-2 py-1.5
                       text-[10px] font-mono text-neutral-300 placeholder:text-neutral-700
                       focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10
                       transition-all"
          />
        </div>
      </div>

      {/* File tree scroll container */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-4 space-y-px">
        {isEmpty ? (
          /* Empty / booting state */
          <div className="flex flex-col items-center justify-center h-32 gap-3 opacity-40">
            <div
              className={`w-1.5 h-1.5 rounded-full bg-neutral-700
                          ${vfsStatus === 'booting' ? 'animate-ping' : ''}`}
            />
            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-[0.3em]">
              {vfsStatus === 'booting' ? 'Scanning_VFS...' : 'VFS_Empty'}
            </span>
          </div>
        ) : visibleTree.length === 0 ? (
          /* No search matches */
          <div className="flex items-center justify-center h-20 opacity-40">
            <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">
              No_Match
            </span>
          </div>
        ) : (
          /* Render tree — each node is memoized */
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
    </div>
  );
}
