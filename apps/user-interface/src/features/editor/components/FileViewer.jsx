import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileCode2, LayoutGrid, Sparkles } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';

/**
 * FileViewer — Core Code Renderer
 * High-fidelity syntax highlighting and neural state visualization for code.
 */
export const FileViewer = React.memo(function FileViewer({ path, content }) {
  const language = useMemo(() => {
    if (!path) return 'text';
    const ext = path.split('.').pop()?.toLowerCase();
    const MAP = { js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
                  json: 'json', css: 'css', scss: 'scss', md: 'markdown',
                  sh: 'bash', py: 'python', html: 'html', go: 'go', rs: 'rust' };
    return MAP[ext] ?? 'text';
  }, [path]);

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8 bg-surface-container-lowest/50">
        <Surface elevation={3} shape="3xl" className="p-12 bg-surface-container-highest relative group overflow-hidden border border-outline-variant/20 shadow-2xl">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
           <LayoutGrid size={64} className="text-primary transition-transform duration-1000 group-hover:rotate-12 group-hover:scale-110" />
        </Surface>
        <div className="flex flex-col items-center gap-3">
          <h2 className="headline-medium font-black tracking-tighter text-on-surface uppercase italic">
            Neural_Core_Active
          </h2>
          <p className="label-large text-on-surface-variant font-bold opacity-40 uppercase tracking-[0.4em] flex items-center gap-3">
            <Sparkles size={16} />
            Await_Input_Stream
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-container-lowest">
      <div className="h-14 border-b border-outline-variant/20 flex items-center px-8 gap-4 bg-surface-container-low/30 backdrop-blur-2xl shrink-0">
        <FileCode2 size={18} className="text-primary opacity-60" />
        <div className="flex flex-col">
          <span className="label-medium font-bold text-on-surface tracking-tight truncate max-w-md">{path.split('/').pop()}</span>
          <span className="text-[8px] font-mono text-on-surface-variant opacity-40 uppercase tracking-widest">{path}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto scrollbar-none">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines={false}
          customStyle={{
            margin: 0,
            padding: '3rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.9',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ color: 'hsl(var(--outline-variant))', opacity: 0.2, minWidth: '4em', paddingRight: '3em', textAlign: 'right' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
