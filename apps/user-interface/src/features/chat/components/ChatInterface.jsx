import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Brain, 
  Terminal, 
  Sparkles, 
  Code, 
  Fingerprint, 
  ChevronRight, 
  Activity, 
  Zap, 
  ShieldCheck, 
  User,
  Paperclip,
  Github,
  Globe,
  Cpu,
  Plus,
  Plug
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';

function ThoughtSection({ thoughts }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="mb-6 w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group inline-flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface-variant shadow-sm transition hover:bg-surface-container-low hover:text-on-surface"
      >
        <div className="relative">
          <Brain size={14} className="text-primary" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Reasoning trace</span>
        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }} className="opacity-20 group-hover:opacity-60 transition-opacity">
          <ChevronRight size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low p-4"
          >
            <div className="space-y-3">
              {thoughts.map((t, i) => (
                <div key={i} className="flex gap-3 text-sm font-medium leading-6 text-on-surface-variant">
                  <div className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                  <span>{typeof t === 'string' ? t : (t.content || t.message)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ content, role, thoughts = [] }) {
  const isUser = role === 'user';

  return (
    <div className={`flex max-w-[90%] flex-col gap-2 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div className={`flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] ${isUser ? 'text-primary' : 'text-on-surface-variant'}`}>
        {isUser ? <User size={12} /> : <ShieldCheck size={12} />}
        <span>{isUser ? 'Operator' : 'System Agent'}</span>
      </div>

      {!isUser && <ThoughtSection thoughts={thoughts} />}

      <div
        className={`relative p-4 text-sm leading-7 shadow-sm transition-all md:p-5 ${
          isUser
            ? 'rounded-xl rounded-tr-sm bg-primary font-medium text-on-primary'
            : 'rounded-xl rounded-tl-sm border border-outline-variant bg-surface-container-lowest font-medium text-on-surface'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-6 last:mb-0 leading-relaxed">{children}</p>,
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="my-5 overflow-hidden rounded-lg border border-outline-variant bg-[#1e1e1e] shadow-sm">
                  <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Code size={14} className="text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">{match[1]}</span>
                    </div>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!m-0 !bg-transparent !p-5 !font-mono !text-[13px] !leading-relaxed"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={`rounded px-1.5 py-0.5 font-mono text-[0.9em] font-bold ${isUser ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function ChatInterface({ onSend }) {
  const [input, setInput] = useState('');
  const { 
    messages, 
    streamingMessage, 
    isThinking, 
    agentThoughts, 
    linkedProjects, 
    uploadedFiles 
  } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 400;
      if (isAtBottom) {
        scrollRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages, streamingMessage]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface relative">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-dot-pattern opacity-5 pointer-events-none" />

      {/* Header Info */}
      <div className="flex h-14 items-center justify-between border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md px-6 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant/40 bg-surface-container-low text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant">
            <Cpu size={12} className="text-primary" />
            Selina v6
          </div>
          <div className="h-4 w-px bg-outline-variant/40" />
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isThinking ? 'bg-primary animate-pulse' : 'bg-google-green shadow-[0_0_8px_rgba(52,168,83,0.4)]'}`} />
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">{isThinking ? 'Thinking' : 'Operational'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40">
             <Activity size={12} /> {agentThoughts.length} TRACE
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/40">
             <Fingerprint size={12} /> ENCRYPTED
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6 md:p-10 relative z-0">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !streamingMessage && !isThinking && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex h-full items-center justify-center text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-outline-variant/20 bg-surface-container-lowest text-primary shadow-2xl shadow-primary/10">
                  <Sparkles size={36} />
                </div>
                <h3 className="mb-4 text-3xl font-black tracking-tight text-on-surface">Universal Agent</h3>
                <p className="text-lg font-medium leading-relaxed text-on-surface-variant/60">
                  Connect repositories, upload assets, and orchestrate MCP tools with the next-gen Vibe engine.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 text-left hover:border-primary/20 transition-all cursor-pointer">
                    <Github size={16} className="mb-2 text-primary" />
                    <p className="text-xs font-bold mb-1">Index Repository</p>
                    <p className="text-[10px] text-on-surface-variant/50 font-medium">Link GitHub for deep AST analysis.</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 text-left hover:border-primary/20 transition-all cursor-pointer">
                    <Plug size={16} className="mb-2 text-google-yellow" />
                    <p className="text-xs font-bold mb-1">MCP Tools</p>
                    <p className="text-[10px] text-on-surface-variant/50 font-medium">Connect external services & APIs.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {messages.map((m, i) => (
            <motion.div key={m.id || `msg-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <MessageBubble content={m.content} role={m.role} thoughts={m.thoughts || []} />
            </motion.div>
          ))}

          {streamingMessage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MessageBubble content={streamingMessage} role="assistant" thoughts={agentThoughts} />
            </motion.div>
          )}

          {isThinking && !streamingMessage && (
            <div className="flex items-center gap-6 py-6 pl-4">
               <div className="flex gap-2">
                 {[0, 1, 2].map((i) => (
                   <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} className="h-2 w-2 rounded-full bg-primary" />
                 ))}
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Neural processing active</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-gradient-to-t from-surface via-surface/95 to-transparent z-10">
        <div className="mx-auto max-w-5xl">
          {/* Context Chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {linkedProjects.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[10px] font-bold text-on-surface-variant">
                <Github size={12} className="text-primary" />
                {p.name}
              </div>
            ))}
            {uploadedFiles.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[10px] font-bold text-on-surface-variant">
                <Paperclip size={12} className="text-google-yellow" />
                {f.name}
              </div>
            ))}
          </div>

          <div className="relative group shadow-2xl shadow-primary/5">
            <textarea
              rows="1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isThinking}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything or orchestrate tools..."
              className="min-h-[64px] w-full resize-none rounded-2xl border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-xl py-5 pl-6 pr-24 text-base font-medium text-on-surface transition-all placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:bg-surface-container-lowest focus:outline-none shadow-sm"
            />
            
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
               <button className="p-2.5 text-on-surface-variant/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="Add Connector or Context">
                <Plus size={22} />
              </button>
              <Button 
                variant="filled" 
                size="lg" 
                disabled={isThinking || !input.trim()} 
                onClick={handleSend} 
                className="!h-10 !w-10 !rounded-xl !p-0 border-none shadow-xl shadow-primary/20"
              >
                <Send size={22} />
              </Button>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
              <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-google-green" /> End-to-End Secure</span>
              <span className="flex items-center gap-1.5"><Globe size={12} /> Local-First Execution</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30">
              <Zap size={10} /> BUS: 4.2 GT/s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
