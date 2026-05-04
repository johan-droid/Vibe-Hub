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
        className="inline-flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-white/50 px-5 py-3 text-on-surface-variant transition hover:bg-white hover:text-on-surface group shadow-sm"
      >
        <div className="relative">
          <Brain size={14} className="text-google-blue" />
          <motion.div animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-google-blue blur-[8px] rounded-full" />
        </div>
        <span className="text-[10px] font-black tracking-[0.3em] opacity-40 uppercase">View Reasoning Trace</span>
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
            className="mt-4 overflow-hidden rounded-[2.5rem] border-l-2 border-google-blue/10 bg-on-surface/[0.01] pl-8 py-4"
          >
            <div className="space-y-5">
              {thoughts.map((t, i) => (
                <div key={i} className="flex gap-5 text-sm text-on-surface-variant/60 leading-relaxed font-medium">
                  <div className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-google-blue/10" />
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
    <div className={`flex max-w-[85%] flex-col gap-3 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div className={`flex items-center gap-3 px-2 text-[9px] font-black tracking-[0.4em] ${isUser ? 'text-google-blue' : 'text-google-red'} opacity-30 uppercase`}>
        {isUser ? <User size={12} /> : <ShieldCheck size={12} />}
        <span>{isUser ? 'Operator' : 'System Agent'}</span>
      </div>

      {!isUser && <ThoughtSection thoughts={thoughts} />}

      <div
        className={`relative p-8 text-base leading-relaxed shadow-sm transition-all duration-500 ${
          isUser
            ? 'bg-google-blue text-white rounded-[2.5rem] rounded-tr-sm shadow-xl shadow-google-blue/10 font-medium'
            : 'bg-white border border-outline-variant/30 text-on-surface rounded-[2.5rem] rounded-tl-sm font-medium'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-6 last:mb-0 leading-relaxed">{children}</p>,
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="my-8 overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-[#1e1e1e] shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Code size={14} className="text-google-blue" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{match[1]}</span>
                    </div>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!m-0 !bg-transparent !p-8 !font-mono !text-[13px] !leading-relaxed"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={`rounded-lg px-2 py-1 font-mono text-[0.9em] font-bold ${isUser ? 'bg-white/20 text-white' : 'bg-google-blue/10 text-google-blue'}`} {...props}>
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
    <div className="flex h-full flex-col bg-[#faf8f5] overflow-hidden">
      {/* Header */}
      <div className="h-16 flex items-center justify-between border-b border-black/[0.03] px-10 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-google-green animate-pulse" />
          <span className="text-[10px] font-black tracking-[0.4em] text-on-surface/40 uppercase">Link Active</span>
        </div>
        <div className="flex items-center gap-6 text-[9px] font-black opacity-20 tracking-[0.3em] uppercase">
          <span className="flex items-center gap-2"><Activity size={10} /> {agentThoughts.length} Packets</span>
          <span className="flex items-center gap-2"><Fingerprint size={10} /> Secure</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-12 overflow-y-auto p-10 md:p-14 scrollbar-none">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !streamingMessage && !isThinking && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex h-full items-center justify-center text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-10 flex h-24 w-24 items-center justify-center rounded-[3rem] bg-white shadow-2xl shadow-black/[0.05] ring-1 ring-black/[0.03] relative overflow-hidden group">
                  <motion.div className="absolute inset-0 bg-google-blue opacity-5 blur-[25px] animate-pulse" />
                  <Sparkles size={32} className="text-google-blue relative z-10 transition-transform group-hover:scale-110" />
                </div>
                <h3 className="text-2xl font-black text-on-surface tracking-tight mb-4">How can I help today?</h3>
                <p className="text-base text-on-surface-variant/40 font-semibold uppercase tracking-widest leading-relaxed">Type a command or question to start your workspace session.</p>
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
               <span className="text-[10px] font-black text-google-blue uppercase tracking-[0.4em]">Processing Request</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-10 md:p-14 bg-white border-t border-black/[0.03]">
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
            className="min-h-[72px] w-full resize-none rounded-[2.5rem] border border-outline-variant/30 bg-[#faf8f5] py-6 pl-10 pr-20 text-base text-on-surface placeholder:text-on-surface-variant/30 focus:border-google-blue/30 focus:bg-white focus:shadow-2xl focus:shadow-black/[0.03] focus:outline-none transition-all duration-500 font-medium"
          />
          <div className="absolute bottom-3.5 right-3.5">
            <Button 
              variant="filled" 
              size="lg" 
              disabled={isThinking || !input.trim()} 
              onClick={handleSend} 
              className="!h-12 !w-12 !rounded-[1.5rem] !p-0 shadow-2xl shadow-google-blue/20 bg-google-blue hover:brightness-110 active:scale-90 transition-all border-none"
            >
              <Send size={20} />
            </Button>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between px-6 text-[9px] font-black opacity-10 tracking-[0.4em] uppercase">
          <span>Enterprise Encryption Active</span>
          <span className="flex items-center gap-3"><Terminal size={12} /> System_Core_v4.1.2</span>
        </div>
      </div>
    </div>
  );
}
