import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Activity, FileCode2, FolderOpen, MessageSquare, Terminal, GitBranch, Shield, Cpu, Zap, Sparkles } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { motion } from 'framer-motion';

const QuickAction = ({ icon: Icon, label, detail }) => (
  <div className="flex items-start gap-4 rounded-xl border border-outline-variant/10 bg-on-surface/[0.015] p-5 transition-all hover:bg-on-surface/[0.03] hover:border-primary/20 group">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container border border-outline-variant/10 text-primary/40 group-hover:text-primary transition-colors">
      <Icon size={18} />
    </div>
    <div>
      <p className="label-large text-on-surface/90 uppercase tracking-widest">{label}</p>
      <p className="mt-2 body-small text-on-surface-variant/40 leading-relaxed">{detail}</p>
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
        <div className="flex h-10 shrink-0 items-center justify-between neural-glass border-x-0 border-t-0 px-6">
          <div className="flex items-center gap-3">
            <Zap size={12} className="text-primary opacity-60" />
            <span className="label-small uppercase tracking-[0.2em] opacity-60 font-bold">Workbench Hub</span>
          </div>
          <span className="label-small opacity-30 uppercase tracking-widest font-mono">
            {vfsStatus === 'ready' ? `VFS: ${fileCount} PKTS` : `VFS: ${vfsStatus?.toUpperCase() || 'OFFLINE'}`}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10 scrollbar-none">
          <div className="w-full max-w-4xl">
            <div className="mb-12 text-center">
              <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant/10 bg-on-surface/[0.01]">
                <Sparkles size={28} className="text-primary/20" />
                <motion.div 
                  animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }} 
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="absolute inset-0 bg-primary/10 blur-[30px] rounded-full"
                />
              </div>
              <h2 className="title-large text-on-surface/90 uppercase tracking-[0.15em]">Neural Link Standby</h2>
              <p className="mx-auto mt-4 max-w-2xl body-small text-on-surface-variant/40 leading-relaxed">
                The workbench surface is currently in high-fidelity standby. 
                Establish a context link by selecting a node from the explorer or dispatching a command to Selina.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <QuickAction icon={FolderOpen} label="Node Selection" detail="Navigate the project VFS and select a core asset for inspection." />
              <QuickAction icon={MessageSquare} label="Command Surface" detail="Dispatch a directive to the expert swarm via the chat terminal." />
              <QuickAction icon={Terminal} label="System Stdout" detail={`${terminalOutput.length} output lines available for diagnostic ingestion.`} />
              <QuickAction icon={Activity} label="Stream Telemetry" detail={`${messages.length} chat cycles recorded in the current session buffer.`} />
            </div>
          </div>
        </div>

        <div className="flex h-9 shrink-0 items-center justify-between border-t border-outline-variant/10 bg-on-surface/[0.01] px-6">
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2 label-small opacity-30 uppercase tracking-widest"><GitBranch size={10} /> Local Link</span>
            <span className="inline-flex items-center gap-2 label-small opacity-30 uppercase tracking-widest"><Shield size={10} /> Secure Layer</span>
          </div>
          <span className="label-small opacity-30 uppercase tracking-widest font-mono">NEURAL_OS_V2.4.0</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      <div className="flex h-10 shrink-0 items-center gap-4 neural-glass border-x-0 border-t-0 px-6">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
          <FileCode2 size={12} className="text-primary" />
        </div>
        <div className="min-w-0">
          <span className="label-small font-bold truncate block tracking-widest uppercase opacity-80">{path.split('/').pop()}</span>
          <span className="label-small truncate block opacity-30 font-mono text-[9px] -mt-0.5">{path}</span>
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
            padding: '2rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.8',
            fontFamily: 'JetBrains Mono, monospace',
            minHeight: '100%',
          }}
          lineNumberStyle={{ color: 'hsl(var(--outline-variant))', opacity: 0.25, minWidth: '3.5em', paddingRight: '2em', textAlign: 'right', userSelect: 'none' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
