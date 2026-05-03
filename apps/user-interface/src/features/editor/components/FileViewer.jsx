import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Activity, FileCode2, FolderOpen, MessageSquare, Terminal, GitBranch, Shield, Cpu } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';
import { useStore } from '../../../store/useStore';

const QuickAction = ({ icon: Icon, label, detail }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/60 p-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon size={17} />
    </div>
    <div>
      <p className="title-small">{label}</p>
      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{detail}</p>
    </div>
  </div>
);

function countFiles(nodes = []) {
  let total = 0;
  const visit = (node) => {
    if (!node) return;
    if (node.isDir || node.type === 'directory') {
      (node.children || []).forEach(visit);
    } else {
      total += 1;
    }
  };
  nodes.forEach(visit);
  return total;
}

/**
 * FileViewer renders active files and a practical empty workbench state.
 */
export const FileViewer = React.memo(function FileViewer({ path, content }) {
  const { vfsStatus, vfsTree, openFiles, messages, terminalOutput } = useStore();
  const fileCount = countFiles(vfsTree);
  const language = useMemo(() => {
    if (!path) return 'text';
    const ext = path.split('.').pop()?.toLowerCase();
    const MAP = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      json: 'json', css: 'css', scss: 'scss', md: 'markdown',
      sh: 'bash', py: 'python', html: 'html', go: 'go', rs: 'rust',
    };
    return MAP[ext] ?? 'text';
  }, [path]);

  if (!content) {
    return (
      <div className="flex h-full flex-col bg-surface-container-lowest">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container-low/70 px-5 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <FolderOpen size={18} className="text-primary" />
            <div>
              <p className="title-small">Workbench</p>
              <p className="text-xs text-on-surface-variant">Open a file or ask Selina to inspect the project.</p>
            </div>
          </div>
          <span className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
            {vfsStatus === 'ready' ? `${fileCount} files indexed` : `VFS ${vfsStatus || 'idle'}`}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <div className="w-full max-w-4xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-primary">
                <FileCode2 size={28} />
              </div>
              <h2 className="headline-medium">No file is open yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                This surface stays empty until there is real code to show. Use the explorer to open a file, or ask Selina in chat to inspect the repository and create a focused change.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <QuickAction icon={FolderOpen} label="Open from explorer" detail="Browse the local VFS tree and choose a source file to review." />
              <QuickAction icon={MessageSquare} label="Ask Selina" detail="Send a concrete task in chat, like 'inspect auth restore' or 'explain the dashboard route'." />
              <QuickAction icon={Terminal} label="Use terminal evidence" detail={`${terminalOutput.length} terminal lines are available for debugging this session.`} />
              <QuickAction icon={Activity} label="Watch activity" detail={`${messages.length} chat turns and ${openFiles.length} open files are currently in local state.`} />
            </div>
          </div>
        </div>

        <div className="flex h-12 shrink-0 items-center justify-between border-t border-outline-variant/30 bg-surface-container-low/50 px-5 text-xs text-on-surface-variant">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2"><GitBranch size={14} className="text-primary" /> Local workspace</span>
            <span className="inline-flex items-center gap-2"><Shield size={14} className="text-tertiary" /> OAuth protected</span>
          </div>
          <span className="hidden items-center gap-2 sm:inline-flex"><Cpu size={14} className="text-secondary" /> Model gateway attached through backend diagnostics</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-outline-variant/30 bg-surface-container-low/70 px-5 backdrop-blur-2xl md:px-7">
        <FileCode2 size={18} className="text-primary" />
        <div className="min-w-0">
          <span className="title-small block truncate">{path.split('/').pop()}</span>
          <span className="mt-1 block truncate text-xs font-medium text-on-surface-variant">{path}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-none">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines={false}
          customStyle={{
            margin: 0,
            padding: '2.25rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.85',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ color: 'hsl(var(--outline-variant))', opacity: 0.35, minWidth: '3.75em', paddingRight: '2.5em', textAlign: 'right' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
