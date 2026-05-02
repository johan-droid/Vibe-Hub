import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Cpu, User, Brain, Terminal, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * ChatInterface — Principal UX/UI Implementation
 * 
 * Engineered for zero-latency vibe coding.
 * Optimized with useMemo and atomic streaming updates to prevent UI stutter on Ryzen 5500U.
 */
export default function ChatInterface({ onSend }) {
  const [input, setInput] = useState('');
  const { messages, streamingMessage, isThinking, neuralStatus } = useStore();
  const scrollRef = useRef(null);

  // Auto-scroll logic: Throttled and respects manual user scrolling
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
      if (isAtBottom) {
        scrollRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages, streamingMessage]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input);
    setInput('');
  };

  const renderMessage = useMemo(() => (content, role) => (
    <div className={twMerge(
      "flex flex-col gap-2 max-w-[85%]",
      role === 'user' ? "items-end ml-auto" : "items-start mr-auto"
    )}>
      <div className="flex items-center gap-2 opacity-40 px-1">
        {role === 'user' ? (
          <>
            <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">User_Cmd</span>
            <User size={10} className="text-zinc-400" />
          </>
        ) : (
          <>
            <Brain size={10} className="text-cyan-500" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-500">Expert_Res</span>
          </>
        )}
      </div>
      
      <div className={twMerge(
        "p-4 rounded-2xl text-[11px] font-mono leading-relaxed border shadow-2xl",
        role === 'user' 
          ? "bg-zinc-900 text-zinc-200 border-zinc-800 rounded-tr-none" 
          : "bg-black text-cyan-50 border-cyan-500/10 rounded-tl-none"
      )}>
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="my-3 rounded-lg overflow-hidden border border-zinc-800/50">
                  <div className="bg-zinc-900 px-3 py-1.5 flex justify-between items-center border-b border-zinc-800/50">
                    <span className="text-[9px] text-zinc-500 font-mono uppercase">{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!bg-black !m-0 !text-[10px]"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="bg-zinc-800 px-1 rounded text-cyan-400" {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  ), []);

  return (
    <div className="flex flex-col h-full bg-black border-r border-zinc-900">
      {/* Neural Header */}
      <div className="h-14 px-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={clsx(
              "w-2 h-2 rounded-full",
              isThinking ? "bg-cyan-500 animate-ping" : "bg-zinc-700"
            )} />
            <div className={clsx(
              "absolute inset-0 w-2 h-2 rounded-full",
              isThinking ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" : "bg-zinc-700"
            )} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
              {neuralStatus.expert}_PROTOCOL
            </h3>
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">
              State: {neuralStatus.phase}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
             {[1,2,3,4,5].map(i => (
               <div key={i} className={clsx("w-0.5 h-3 rounded-full", isThinking && i <= 3 ? "bg-cyan-500 animate-pulse" : "bg-zinc-800")} />
             ))}
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide scroll-smooth selection:bg-cyan-500/30"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              // BUG #9 FIX: key={`msg-${i}`} uses array index — any insertion shifts
              // all subsequent keys, causing React to unmount+remount every motion.div
              // in AnimatePresence. This re-triggers enter animations for ALL historical
              // messages whenever a new one arrives. Use a stable id stamped on addMessage.
              key={m.id ?? `msg-fallback-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {renderMessage(m.content, m.role)}
            </motion.div>
          ))}
          
          {streamingMessage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {renderMessage(streamingMessage, 'assistant')}
            </motion.div>
          )}

          {isThinking && !streamingMessage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-2 py-4"
            >
              <div className="flex gap-1.5">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
              </div>
              <span className="text-[9px] font-mono text-cyan-500/50 uppercase italic tracking-tighter">Neural_Pathway_Active...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Module */}
      <div className="p-5 bg-black/80 backdrop-blur-xl border-t border-zinc-900">
        <div className="relative group">
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
            placeholder="Command Vibe Hub..." 
            className="w-full bg-zinc-900/50 text-zinc-100 border border-zinc-800 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/5 transition-all font-mono text-xs placeholder:text-zinc-700 resize-none overflow-hidden"
          />
          <button 
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="absolute right-2.5 top-2.5 p-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 active:scale-95 transition-all disabled:bg-zinc-800 disabled:text-zinc-600 disabled:scale-100 group shadow-lg shadow-cyan-900/20"
          >
            <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
        <div className="mt-3 flex justify-between items-center px-1">
          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
            <Terminal size={10} /> Shift + Enter for new line
          </span>
          <div className="flex gap-3">
             <Sparkles size={10} className="text-zinc-800" />
             <Cpu size={10} className="text-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
