import React, { useState, useEffect, useRef } from 'react';
import { Send, Brain, Terminal, Sparkles, Code, Fingerprint, ChevronRight, Activity, Zap, ShieldCheck, User } from 'lucide-react';
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
                  <span>{typeof t === 'string' ? t : t.content}</span>
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
  const { messages, streamingMessage, isThinking, agentThoughts } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 300;
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
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 md:px-5">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-google-green" />
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">Assistant</span>
        </div>
        <div className="hidden items-center gap-4 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant sm:flex">
          <span className="flex items-center gap-2"><Activity size={10} /> {agentThoughts.length} Packets</span>
          <span className="flex items-center gap-2"><Fingerprint size={10} /> Secure</span>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-4 md:p-5">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !streamingMessage && !isThinking && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex h-full items-center justify-center text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-primary shadow-sm">
                  <Sparkles size={22} />
                </div>
                <h3 className="mb-2 text-xl font-black tracking-tight text-on-surface">How can I help?</h3>
                <p className="text-sm font-medium leading-6 text-on-surface-variant">Type a command or question to start your workspace session.</p>
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
                   <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} className="h-2 w-2 rounded-full bg-google-blue" />
                 ))}
               </div>
               <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Processing request</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-outline-variant bg-surface-container-lowest p-4 md:p-5">
        <div className="relative group mx-auto max-w-4xl">
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
            placeholder="Type your message here..."
            className="min-h-[54px] w-full resize-none rounded-xl border border-outline-variant bg-surface-container-low py-4 pl-4 pr-16 text-sm font-medium text-on-surface transition-all placeholder:text-on-surface-variant/55 focus:border-primary/40 focus:bg-surface-container-lowest focus:outline-none"
          />
          <div className="absolute bottom-2.5 right-2.5">
            <Button 
              variant="filled" 
              size="lg" 
              disabled={isThinking || !input.trim()} 
              onClick={handleSend} 
              className="!h-9 !w-9 !rounded-lg !p-0 border-none"
            >
              <Send size={20} />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/60">
          <span>Enterprise Encryption Active</span>
          <span className="flex items-center gap-3"><Terminal size={12} /> System_Core_v4.1.2</span>
        </div>
      </div>
    </div>
  );
}
