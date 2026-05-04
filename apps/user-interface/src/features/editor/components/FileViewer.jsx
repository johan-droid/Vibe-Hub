import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Activity, FileCode2, FolderOpen, MessageSquare, Terminal, GitBranch, Shield, Cpu, Zap, Sparkles, ChevronRight, Layout, Globe, Search, Play, HelpCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion } from 'framer-motion';

const QuickAction = ({ icon: Icon, label, detail, color }) => (
  <div className="flex flex-col gap-6 rounded-[2.5rem] bg-white p-8 border border-black/[0.03] shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/[0.04] group relative overflow-hidden">
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${color} shadow-lg shadow-black/[0.02] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface/40 mb-3">{label}</p>
      <p className="text-sm font-semibold text-on-surface-variant/60 leading-relaxed">{detail}</p>
    </div>
    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-black/[0.01] rounded-full blur-2xl group-hover:bg-black/[0.02] transition-colors" />
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
      <div className="flex h-full flex-col bg-[#faf8f5]">
        {/* Header Segment */}
        <div className="h-14 shrink-0 flex items-center justify-between border-b border-black/[0.03] px-10 bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-google-green animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">System Core Active</span>
          </div>
          <div className="flex items-center gap-8 text-[9px] font-black opacity-20 tracking-widest uppercase">
            <span className="flex items-center gap-2"><Globe size={11} /> Global Link</span>
            <span className="flex items-center gap-2"><Shield size={11} /> Encrypted</span>
          </div>
        </div>

        {/* Empty State / Welcome Surface */}
        <div className="flex-1 overflow-y-auto px-10 py-16 scrollbar-none">
          <div className="mx-auto max-w-5xl">
            <header className="mb-20 text-center space-y-6">
              <div className="relative mx-auto mb-10 flex h-24 w-24 items-center justify-center rounded-[3rem] bg-white shadow-2xl shadow-black/[0.04] ring-1 ring-black/[0.02]">
                <Sparkles size={40} className="text-google-blue transition-transform hover:scale-110" />
                <motion.div 
                  animate={{ opacity: [0.1, 0.3, 0.1] }} 
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-google-blue blur-[40px] rounded-full"
                />
              </div>
              <h2 className="text-4xl font-black text-on-surface tracking-tighter leading-none">Ready to Build?</h2>
              <p className="mx-auto max-w-2xl text-lg font-semibold text-on-surface-variant/40 leading-relaxed">
                Your workspace is optimized and connected. Select an asset from the explorer or use the assistant to generate new ideas.
              </p>
            </header>

            <div className="grid gap-10 md:grid-cols-2">
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

        {/* Footer Meta */}
        <div className="h-10 shrink-0 flex items-center justify-between border-t border-black/[0.03] px-10 bg-white/50 backdrop-blur-sm">
           <div className="flex items-center gap-10">
              <div className="flex items-center gap-3 text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest">
                 <GitBranch size={11} /> 
                 <span>Main Instance</span>
              </div>
              <div className="h-3 w-px bg-black/[0.05]" />
              <div className="flex items-center gap-3 text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest">
                 <Search size={11} /> 
                 <span>Indexing Complete</span>
              </div>
           </div>
           <span className="text-[9px] font-black text-on-surface-variant/10 uppercase tracking-[0.4em]">Selina_Workspace_v4.1</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Editor Header */}
      <div className="h-14 shrink-0 flex items-center justify-between border-b border-black/[0.03] px-10 bg-[#faf8f5]/50 backdrop-blur-md">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-google-blue/5 text-google-blue border border-google-blue/10">
            <FileCode2 size={16} />
          </div>
          <div className="flex items-center gap-3 min-w-0">
             <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] shrink-0">Path</span>
             <ChevronRight size={10} className="text-on-surface-variant/20" />
             <span className="text-sm font-bold text-on-surface truncate tracking-tight">{path}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <Button variant="tonal" size="sm" className="h-8 rounded-lg text-[9px] px-4">Explain Code</Button>
           <Button variant="filled" size="sm" className="h-8 rounded-lg text-[9px] px-4 bg-google-blue border-none">Optimize</Button>
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
            padding: '3rem',
            background: 'transparent',
            fontSize: '14px',
            lineHeight: '1.9',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ 
            color: 'hsl(var(--on-surface))', 
            opacity: 0.1, 
            minWidth: '4em', 
            paddingRight: '3rem', 
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
