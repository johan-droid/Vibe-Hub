import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileCode2, LayoutGrid, Sparkles } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';

/**
 * FileViewer renders active files with a calm premium editor empty state.
 */
export const FileViewer = React.memo(function FileViewer({ path, content }) {
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
      <div className="flex h-full flex-col items-center justify-center gap-7 bg-surface-container-lowest px-6 text-center">
        <Surface elevation={0} shape="2xl" className="border border-outline-variant/35 bg-surface-container p-10 shadow-2xl shadow-black/20">
          <LayoutGrid size={58} className="text-primary" />
        </Surface>
        <div className="max-w-md">
          <p className="label-small mb-3 text-primary">Workspace idle</p>
          <h2 className="headline-medium">Open a file or ask Selina to begin.</h2>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            The editor will show files, diffs, and generated changes here as the agent works through the repo.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
            <Sparkles size={14} className="text-secondary" /> Ready for context
          </div>
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
          <span className="label-small mt-1 block truncate text-on-surface-variant/70">{path}</span>
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
