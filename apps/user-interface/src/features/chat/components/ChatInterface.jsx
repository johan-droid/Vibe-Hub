import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, User, Brain, Terminal, Sparkles, Code, Fingerprint } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';
import { IconButton } from '../../shared/components/IconButton';
import { Button } from '../../shared/components/Button';

/**
 * ChatInterface — Material 3 Intelligence Conduit
 * The primary channel for autonomous orchestration.
 */
export default function ChatInterface({ onSend }) {
  const [input, setInput] = useState('');
  const { messages, streamingMessage, isThinking, neuralStatus } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 150;
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

  const ThoughtSection = ({ thoughts }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    if (!thoughts || thoughts.length === 0) return null;

    return (
      <div className="mb-4 w-full">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group"
        >
          <Brain size={10} className="text-primary opacity-60" />
          <span className="text-[9px] font-mono font-black text-primary uppercase tracking-widest">Neural_Monologue</span>
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
             <Code size={8} className="text-primary opacity-40" />
          </motion.div>
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2 ml-4 pl-4 border-l border-primary/10"
            >
              <div className="space-y-1.5">
                {thoughts.map((t, i) => (
                  <motion.div 
                    key={i}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary/40" />
                    <span className="leading-tight">{typeof t === 'string' ? t : t.content}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const MessageBubble = useMemo(() => ({ content, role, thoughts = [] }) => {
    const isUser = role === 'user';
    return (
      <div className={`flex flex-col gap-3 max-w-[92%] ${isUser ? "items-end ml-auto" : "items-start mr-auto"}`}>
        <div className={`flex items-center gap-2 px-2 label-small font-bold uppercase tracking-widest opacity-40`}>
          {isUser ? (
            <>
              <span>Command_Origin</span>
              <Fingerprint size={12} className="text-primary" />
            </>
          ) : (
            <>
              <Brain size={12} className="text-primary" />
              <span className="text-primary">Response_Stream</span>
            </>
          )}
        </div>
        
        {!isUser && <ThoughtSection thoughts={thoughts} />}

        <Surface
          elevation={isUser ? 2 : 1}
          shape="xl"
          className={`p-5 body-medium leading-relaxed border transition-all duration-500 emphasized ${
            isUser 
              ? "bg-primary-container text-on-primary-container border-primary/20 rounded-tr-sm" 
              : "bg-surface-container-high text-on-surface border-outline-variant/30 rounded-tl-sm"
          }`}
        >
          <ReactMarkdown
            components={{
              p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <Surface elevation={0} shape="lg" className="my-6 border border-outline-variant/30 overflow-hidden bg-black/20 shadow-inner">
                    <div className="bg-surface-container-highest/50 px-4 py-2.5 flex justify-between items-center border-b border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <Code size={12} className="text-primary" />
                        <span className="label-small text-on-surface-variant font-mono font-bold uppercase tracking-widest">{match[1]}</span>
                      </div>
                    </div>
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="!bg-transparent !m-0 !text-[11px] !p-5 !font-mono"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </Surface>
                ) : (
                  <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono font-bold text-[0.9em]" {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </Surface>
      </div>
    );
  }, []);

  return (
    <Surface elevation={0} className="flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant/20">
      {/* Header */}
      <div className="h-16 px-6 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/30 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Surface elevation={2} shape="full" className="w-10 h-10 flex items-center justify-center bg-surface-container-highest relative">
             <Brain size={20} className={isThinking ? "text-primary" : "text-on-surface-variant opacity-40"} />
             <AnimatePresence>
                {isThinking && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.4, opacity: [0, 0.5, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-primary rounded-full -z-10"
                  />
                )}
             </AnimatePresence>
          </Surface>
          <div className="flex flex-col">
            <h3 className="label-large font-bold text-on-surface uppercase tracking-[0.2em]">
              SELINA_{neuralStatus.expert}_PROTOCOL
            </h3>
            <span className="label-small text-primary opacity-60 font-mono flex items-center gap-2">
              <span className="w-1 h-1 bg-current rounded-full" />
              {neuralStatus.phase}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 h-6">
           {[1,2,3,4,6,8,4,2].map((h, i) => (
             <motion.div 
               key={i} 
               animate={{ height: isThinking ? [`${h*2}px`, `${h*4}px`, `${h*2}px`] : '4px' }}
               transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
               className={`w-1 rounded-full ${isThinking ? "bg-primary" : "bg-outline-variant/30"}`} 
             />
           ))}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-12 scrollbar-none"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={m.id || `msg-${i}`}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
            >
              <MessageBubble content={m.content} role={m.role} thoughts={m.thoughts || []} />
            </motion.div>
          ))}
          
          {streamingMessage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MessageBubble content={streamingMessage} role="assistant" thoughts={useStore.getState().agentThoughts} />
            </motion.div>
          )}

          {isThinking && !streamingMessage && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-6 px-4"
            >
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div 
                    key={i}
                    animate={{ y: [0, -8, 0], opacity: [0.2, 1, 0.2] }} 
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} 
                    className="w-2 h-2 bg-primary rounded-full" 
                  />
                ))}
              </div>
              <span className="label-medium font-bold text-primary uppercase tracking-[0.3em] animate-pulse">Neural_Sync...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-8 bg-surface-container-low/50 backdrop-blur-2xl border-t border-outline-variant/20">
        <Surface elevation={1} shape="2xl" className="relative border border-outline-variant/30 bg-surface-container-highest shadow-2xl focus-within:border-primary/50 transition-all duration-500">
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
            placeholder="Instruct the swarm..." 
            className="w-full bg-transparent text-on-surface pl-6 pr-20 py-5 focus:outline-none body-large font-medium placeholder:text-on-surface-variant/20 resize-none min-h-[64px]"
          />
          <div className="absolute right-3 bottom-3">
             <Button 
                variant="filled"
                size="md"
                disabled={isThinking || !input.trim()}
                onClick={handleSend}
                className="!h-11 !w-11 !p-0 !rounded-xl shadow-lg shadow-primary/20"
             >
                <Send size={18} />
             </Button>
          </div>
        </Surface>
        <div className="mt-4 flex justify-between items-center px-4">
          <div className="flex items-center gap-3 opacity-30">
            <Terminal size={14} />
            <span className="label-small font-bold uppercase tracking-widest">Shift+Enter for newline</span>
          </div>
          <div className="flex gap-4 opacity-10">
             <Sparkles size={16} />
             <Fingerprint size={16} />
          </div>
        </div>
      </div>
    </Surface>
  );
}
