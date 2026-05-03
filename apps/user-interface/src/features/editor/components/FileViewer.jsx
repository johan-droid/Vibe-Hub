import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileCode2, Sparkles, Terminal, GitBranch, Shield, Cpu } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';

// Partner integration icons/logos as SVG components
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const GeminiIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const OpenAIIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
  </svg>
);

const PartnerBadge = ({ icon: Icon, name, status }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-high/50 border border-outline-variant/20">
    <Icon />
    <span className="text-xs font-medium text-on-surface-variant">{name}</span>
    <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-tertiary' : 'bg-outline-variant'}`} />
  </div>
);

const QuickAction = ({ icon: Icon, label, shortcut }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 hover:bg-surface-container-high/50 transition-colors cursor-pointer group">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
      <Icon size={16} />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-on-surface">{label}</p>
    </div>
    {shortcut && (
      <span className="text-xs text-on-surface-variant/50 font-mono">{shortcut}</span>
    )}
  </div>
);

/**
 * FileViewer renders active files with a professional empty state showing real integrations.
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
      <div className="flex h-full flex-col bg-surface-container-lowest">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-4 border-b border-outline-variant/30 bg-surface-container-low/70 px-5 backdrop-blur-2xl">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary/10 border border-tertiary/20">
            <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Local Session</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Sparkles size={14} className="text-secondary" />
            <span>Selina Agent Ready</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          {/* Active Integrations */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Active Integrations</h3>
              <span className="text-xs text-tertiary">4 Connected</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
              <PartnerBadge icon={GoogleIcon} name="Google" status="active" />
              <PartnerBadge icon={GitHubIcon} name="GitHub" status="active" />
              <PartnerBadge icon={GeminiIcon} name="Gemini" status="active" />
              <PartnerBadge icon={OpenAIIcon} name="OpenAI" status="active" />
            </div>
          </div>

          {/* Center Message */}
          <div className="text-center max-w-md mb-12">
            <Surface elevation={1} shape="2xl" className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
              <Cpu size={32} className="text-primary" />
            </Surface>
            <h2 className="headline-medium mb-3">Ready for Intelligence</h2>
            <p className="text-sm leading-7 text-on-surface-variant mb-6">
              Your agentic workspace is connected and ready. Start by opening a file from the explorer or send a message to Selina.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface-variant">
              <Terminal size={14} />
              <span>Terminal & Runtime Connected</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="w-full max-w-md space-y-2">
            <p className="text-xs font-medium text-on-surface-variant/50 uppercase tracking-wider mb-3 text-center">Quick Actions</p>
            <QuickAction icon={Terminal} label="Open Terminal" shortcut="Ctrl+`" />
            <QuickAction icon={GitBranch} label="View Git Status" shortcut="Ctrl+G" />
            <QuickAction icon={Shield} label="Security Audit" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-12 items-center justify-between border-t border-outline-variant/30 bg-surface-container-low/50 px-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-primary" />
              <span className="text-xs text-on-surface-variant">Runtime</span>
            </div>
            <span className="text-xs text-on-surface-variant/50">|</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              <span className="text-xs text-on-surface-variant font-mono uppercase">IDLE_SYSTEM</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-on-surface-variant/50">
            <span>Model Gateway</span>
            <span>•</span>
            <span>Standard Effort</span>
            <span>•</span>
            <span>Audit Secure</span>
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
