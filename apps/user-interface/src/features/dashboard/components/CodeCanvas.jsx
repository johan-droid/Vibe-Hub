import React, { useEffect, useMemo, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import {
  Activity,
  Braces,
  CheckCircle,
  Code2,
  FileCode2,
  GitBranch,
  Network,
  Search,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { api } from '../../../services/api';
import ToolVisualizer from './ToolVisualizer';

function fileNameFromPath(path = '') {
  return path.split(/[\\/]/).filter(Boolean).pop() || path || 'Untitled file';
}

function languageFromPath(path = '') {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.go')) return 'go';
  return 'plaintext';
}

function normalizeFiles(primary, fallback) {
  const source = primary?.files ? primary : fallback?.files ? fallback : primary || fallback;
  if (!source) return [];

  if (Array.isArray(source.files)) {
    return source.files.map((file) => ({
      ...file,
      name: file.name || fileNameFromPath(file.path),
      changes: Array.isArray(file.changes) ? file.changes : [],
    }));
  }

  if (source.path) {
    return [{
      path: source.path,
      name: fileNameFromPath(source.path),
      status: source.oldValue ? 'modified' : 'new',
      changes: [],
      oldValue: source.oldValue || '',
      newValue: source.newValue || source.content || '',
    }];
  }

  return [];
}

function summarizeCode(content = '') {
  const lines = content.split('\n');
  const imports = lines.filter((line) => /^\s*import\s/.test(line)).slice(0, 8);
  const exports = lines.filter((line) => /^\s*export\s/.test(line)).slice(0, 8);
  const functions = lines
    .map((line) => line.match(/\b(function|const|async function)\s+([A-Za-z0-9_]+)/)?.[2])
    .filter(Boolean)
    .slice(0, 10);

  return {
    lineCount: lines.length,
    imports,
    exports,
    functions,
  };
}

function LensCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-[#43F3C5]" />
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white/70">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function CodeCanvas({
  diffData,
  agentLoopStatus,
  vfsInstance,
  workspaceMode,
  setWorkspaceMode,
  experienceMode = 'professional',
  toolGraph,
}) {
  const {
    openFiles,
    activeFilePath,
    activeFileContent,
    openFile,
    closeFile,
  } = useStore();
  const [realDiffData, setRealDiffData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [mcpDiagnostics, setMcpDiagnostics] = useState(null);
  const [lensError, setLensError] = useState(null);

  useEffect(() => {
    const loadDiffData = async () => {
      if (!vfsInstance) return;
      try {
        const diff = await vfsInstance.getDiffData();
        if (diff && (diff.files || diff.path)) setRealDiffData(diff);
      } catch (error) {
        console.error('Failed to load diff data:', error);
      }
    };
    loadDiffData();
  }, [vfsInstance]);

  const files = useMemo(() => normalizeFiles(diffData, realDiffData), [diffData, realDiffData]);
  const filteredFiles = files.filter((file) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    return file.path?.toLowerCase().includes(query) || file.name?.toLowerCase().includes(query);
  });

  const activeDiffFile = filteredFiles.find((file) => file.path === activeFilePath) || filteredFiles[0];
  const currentPath = activeFilePath || activeDiffFile?.path || '';
  const currentDiff = filteredFiles.find((file) => file.path === currentPath) || activeDiffFile;
  const currentContent = activeFileContent ?? currentDiff?.newValue ?? currentDiff?.content ?? '';
  const summary = useMemo(() => summarizeCode(editorValue || currentContent), [editorValue, currentContent]);

  useEffect(() => {
    setEditorValue(currentContent || '');
  }, [currentContent, currentPath]);

  useEffect(() => {
    if (!currentDiff?.path || activeFilePath === currentDiff.path) return;
    openFile(currentDiff.path, currentDiff.newValue || currentDiff.content || '');
  }, [activeFilePath, currentDiff, openFile]);

  useEffect(() => {
    if (workspaceMode !== 'lens') return;
    let cancelled = false;
    api.mcpDiagnostics()
      .then((response) => {
        if (!cancelled) setMcpDiagnostics(response.diagnostics || response);
      })
      .catch((error) => {
        if (!cancelled) setLensError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceMode]);

  const modeButtons = [
    { id: 'review', label: 'Review', icon: CheckCircle },
    { id: 'editor', label: 'Editor', icon: Code2 },
    { id: 'graph', label: 'Graph', icon: GitBranch },
    { id: 'lens', label: 'Lenses', icon: Sparkles },
  ];

  const editorOptions = {
    minimap: { enabled: experienceMode === 'professional' },
    fontSize: 13,
    wordWrap: 'on',
    readOnly: workspaceMode === 'review',
    scrollBeyondLastLine: false,
    padding: { top: 16, bottom: 16 },
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileCode2 className="text-[#8DA2FF]" size={18} />
              <h2 className="text-sm font-black tracking-tight text-white">Code Workspace</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-white/40">
              {files.length} files changed / {agentLoopStatus.currentIteration || 0} iterations / {experienceMode}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search files"
                className="h-9 w-52 rounded-md border border-white/10 bg-white/[0.045] pl-9 pr-3 text-sm font-medium text-white outline-none transition placeholder:text-white/30 focus:border-[#8DA2FF]/45 focus:bg-white/[0.065]"
              />
            </div>
            <div className="flex rounded-lg border border-white/10 bg-[#151922] p-1">
              {modeButtons.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setWorkspaceMode(id)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-black transition ${
                    workspaceMode === id
                      ? 'bg-[#43F3C5] text-[#07110F]'
                      : 'text-white/45 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  {experienceMode === 'professional' && label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(filteredFiles.length > 0 || openFiles.length > 0) && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            {[...openFiles, ...filteredFiles.filter((file) => !openFiles.some((open) => open.path === file.path))].map((file) => (
              <button
                key={file.path}
                onClick={() => openFile(file.path, file.content || file.newValue || '')}
                className={`group flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-left transition ${
                  currentPath === file.path
                    ? 'border-[#8DA2FF]/35 bg-[#8DA2FF]/10 text-white'
                    : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Braces size={13} className="text-[#8DA2FF]" />
                <span className="max-w-[12rem] truncate text-xs font-bold">{file.name || fileNameFromPath(file.path)}</span>
                {openFiles.some((open) => open.path === file.path) && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeFile(file.path);
                    }}
                    className="rounded px-1 text-white/25 transition hover:bg-white/10 hover:text-white"
                  >
                    x
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!currentPath && workspaceMode !== 'graph' ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/25">
                <FileCode2 size={30} />
              </div>
              <h3 className="text-lg font-black text-white">No file selected</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/40">
                Generated patches, code files, and structure lenses will appear here.
              </p>
            </div>
          </div>
        ) : workspaceMode === 'graph' ? (
          <ToolVisualizer toolGraph={toolGraph} experienceMode={experienceMode} compact />
        ) : workspaceMode === 'lens' ? (
          <div className="h-full overflow-y-auto p-5">
            <div className="grid gap-4 xl:grid-cols-3">
              <LensCard icon={Braces} title="AST Summary">
                <div className="space-y-2 text-sm text-white/60">
                  <p><span className="text-white/35">File:</span> {currentPath || 'No file'}</p>
                  <p><span className="text-white/35">Lines:</span> {summary.lineCount}</p>
                  <p><span className="text-white/35">Functions:</span> {summary.functions.length || 0}</p>
                </div>
                <div className="mt-3 space-y-1 font-mono text-xs text-white/45">
                  {(summary.functions.length ? summary.functions : ['No functions detected']).map((item) => <div key={item}>{item}</div>)}
                </div>
              </LensCard>

              <LensCard icon={Network} title="Dependency Impact">
                <div className="space-y-2">
                  {(summary.imports.length ? summary.imports : ['No imports detected']).map((item) => (
                    <div key={item} className="truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-xs text-white/55">
                      {item}
                    </div>
                  ))}
                </div>
              </LensCard>

              <LensCard icon={Activity} title="MCP Diagnostics">
                {lensError ? (
                  <p className="text-sm text-[#FFB7B7]">{lensError}</p>
                ) : mcpDiagnostics ? (
                  <div className="space-y-2 text-sm text-white/60">
                    <p><span className="text-white/35">Servers:</span> {mcpDiagnostics.serverCount ?? 0}</p>
                    <p><span className="text-white/35">Tools:</span> {mcpDiagnostics.toolCount ?? 0}</p>
                    <p><span className="text-white/35">Last refresh:</span> {mcpDiagnostics.lastRefreshAt || 'Never'}</p>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">Loading MCP diagnostics...</p>
                )}
              </LensCard>
            </div>
          </div>
        ) : workspaceMode === 'review' && currentDiff ? (
          <DiffEditor
            height="100%"
            language={languageFromPath(currentPath)}
            original={currentDiff.oldValue || ''}
            modified={editorValue || currentDiff.newValue || ''}
            theme="vs-dark"
            options={{
              ...editorOptions,
              readOnly: true,
              renderSideBySide: experienceMode === 'professional',
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={languageFromPath(currentPath)}
            value={editorValue}
            theme="vs-dark"
            options={editorOptions}
            onChange={(value) => setEditorValue(value || '')}
          />
        )}
      </div>
    </div>
  );
}
