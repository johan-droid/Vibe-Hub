import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Activity, FileCode2, FolderOpen, MessageSquare, Terminal, GitBranch, Shield, Cpu, Zap, Sparkles, ChevronRight, Layout, Globe, Search, Play, HelpCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion } from 'framer-motion';

const QuickAction = ({ icon: Icon, label, detail, color }) => (
  <div className="panel flex items-start gap-4 p-5 transition-colors hover:border-primary/30">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-black text-on-surface">{label}</p>
      <p className="mt-1 text-sm font-medium leading-6 text-on-surface-variant">{detail}</p>
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
 * FileViewer — Premium Editor Workspace
 * Refined for a professional "common people" perspective.
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
      <div className="flex h-full flex-col bg-surface">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-google-green" />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">System active</span>
          </div>
          <div className="hidden items-center gap-5 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant sm:flex">
            <span className="flex items-center gap-2"><Globe size={11} /> Global Link</span>
            <span className="flex items-center gap-2"><Shield size={11} /> Encrypted</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-8 md:px-8">
          <div className="mx-auto max-w-5xl">
            <header className="mb-8 max-w-2xl">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-primary shadow-sm">
                <Sparkles size={22} />
              </div>
              <h2 className="headline-medium">Ready to build?</h2>
              <p className="mt-3 text-base font-medium leading-7 text-on-surface-variant">
                Your workspace is optimized and connected. Select an asset from the explorer or use the assistant to generate new ideas.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <QuickAction 
                icon={FolderOpen} 
                label="Asset Library" 
                detail="Navigate your project structure and select files to edit or inspect." 
                color="bg-google-blue/10 text-google-blue"
              />
              <QuickAction 
                icon={MessageSquare} 
                label="Assistant Link" 
                detail="Ask Selina to refactor, explain, or generate complex logic for you." 
                color="bg-google-green/10 text-google-green"
              />
              <QuickAction 
                icon={Terminal} 
                label="Diagnostic Logs" 
                detail={`${terminalOutput.length} output lines available for real-time verification.`} 
                color="bg-google-red/10 text-google-red"
              />
              <QuickAction 
                icon={HelpCircle} 
                label="Support Hub" 
                detail="Need help? Access documentation or system guides instantly." 
                color="bg-google-yellow/10 text-google-yellow"
              />
            </div>
          </div>
        </div>

        <div className="flex h-9 shrink-0 items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-4 md:px-6">
           <div className="flex items-center gap-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                 <GitBranch size={11} /> 
                 <span>Main Instance</span>
              </div>
              <div className="h-3 w-px bg-outline-variant" />
              <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant sm:flex">
                 <Search size={11} /> 
                 <span>Indexing Complete</span>
              </div>
           </div>
           <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant md:inline">Selina Workspace</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 md:px-6">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/10 text-primary">
            <FileCode2 size={16} />
          </div>
          <div className="flex items-center gap-3 min-w-0">
             <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant sm:inline">Path</span>
             <ChevronRight size={10} className="text-on-surface-variant/20" />
             <span className="text-sm font-bold text-on-surface truncate tracking-tight">{path}</span>
          </div>
        </div>
        
        <div className="hidden items-center gap-2 sm:flex">
           <Button variant="tonal" size="sm">Explain</Button>
           <Button variant="filled" size="sm">Optimize</Button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-none bg-white">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines={false}
          customStyle={{
            margin: 0,
            padding: '2rem',
            background: 'transparent',
            fontSize: '14px',
            lineHeight: '1.75',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ 
            color: 'hsl(var(--on-surface))', 
            opacity: 0.1, 
            minWidth: '4em', 
            paddingRight: '2rem', 
            textAlign: 'right', 
            userSelect: 'none',
            fontSize: '11px',
            fontWeight: '900'
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
