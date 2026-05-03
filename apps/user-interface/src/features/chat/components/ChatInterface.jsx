import React, { useState, useEffect, useRef } from 'react';
import { Send, Brain, Terminal, Sparkles, Code, Fingerprint, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';
import { Button } from '../../shared/components/Button';

function ThoughtSection({ thoughts }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="mb-3 w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary transition hover:bg-primary/15"
      >
        <Brain size={11} />
        <span className="label-small">Reasoning trace</span>
        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }}>
          <ChevronRight size={12} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-low p-3"
          >
            <div className="space-y-2">
              {thoughts.map((t, i) => (
                <div key={i} className="flex gap-2 text-[11px] leading-5 text-on-surface-variant">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
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
    <div className={`flex max-w-[94%] flex-col gap-2 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div className="flex items-center gap-2 px-1 text-[10px] font-mono uppercase tracking-[0.18em] text-on-surface-variant/60">
        {isUser ? <Fingerprint size={12} className="text-secondary" /> : <Brain size={12} className="text-primary" />}
        <span>{isUser ? 'You' : 'Selina'}</span>
      </div>

      {!isUser && <ThoughtSection thoughts={thoughts} />}

      <Surface
        elevation={0}
        shape="xl"
        className={`border p-4 text-sm leading-7 md:p-5 ${
          isUser
            ? 'border-secondary/20 bg-secondary/10 text-on-surface rounded-tr-md'
            : 'border-outline-variant/30 bg-surface-container text-on-surface rounded-tl-md shadow-xl shadow-black/10'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <Surface elevation={0} shape="lg" className="my-5 overflow-hidden border border-outline-variant/30 bg-black/35">
                  <div className="flex items-center gap-2 border-b border-outline-variant/25 bg-surface-container-high/70 px-4 py-2">
                    <Code size={12} className="text-primary" />
                    <span className="label-small text-on-surface-variant">{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    className="!m-0 !bg-transparent !p-4 !font-mono !text-[11px]"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </Surface>
              ) : (
                <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.9em] font-semibold text-primary" {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </Surface>
    </div>
  );
}

export default function ChatInterface({ onSend }) {
  const [input, setInput] = useState('');
  const { messages, streamingMessage, isThinking, neuralStatus, agentThoughts } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 150;
      if (isAtBottom) scrollRef.current.scrollTop = scrollHeight;
    }
  }, [messages, streamingMessage]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input);
    setInput('');
  };

  return (
    <Surface elevation={0} className="flex h-full flex-col border-r border-outline-variant/20 bg-surface-container-lowest">
      <div className="flex h-16 items-center justify-between border-b border-outline-variant/30 bg-surface-container-low/60 px-5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Brain size={19} />
            {isThinking && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface-container-low bg-tertiary animate-soft-pulse" />}
          </div>
          <div className="min-w-0">
            <h3 className="title-small truncate">Selina Protocol</h3>
            <p className="label-small mt-1 truncate text-primary">{neuralStatus.expert} / {neuralStatus.phase}</p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          {[1, 2, 3, 2, 4, 2].map((h, i) => (
            <motion.div
              key={i}
              animate={{ height: isThinking ? [`${h * 3}px`, `${h * 5}px`, `${h * 3}px`] : '5px' }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.08 }}
              className={`w-1 rounded-full ${isThinking ? 'bg-primary' : 'bg-outline-variant/50'}`}
            />
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-8 overflow-y-auto p-5 md:p-7 scrollbar-none">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !streamingMessage && !isThinking && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-full items-center justify-center text-center">
              <div className="max-w-xs">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant/35 bg-surface-container text-primary">
                  <Sparkles size={24} />
                </div>
                <h3 className="title-medium">Ready when you are</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">Ask Selina to inspect, edit, explain, or plan work inside this workspace.</p>
              </div>
            </motion.div>
          )}

          {messages.map((m, i) => (
            <motion.div key={m.id || `msg-${i}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <MessageBubble content={m.content} role={m.role} thoughts={m.thoughts || []} />
            </motion.div>
          ))}

          {streamingMessage && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MessageBubble content={streamingMessage} role="assistant" thoughts={agentThoughts} />
            </motion.div>
          )}

          {isThinking && !streamingMessage && (
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} animate={{ y: [0, -6, 0], opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} className="h-2 w-2 rounded-full bg-primary" />
                ))}
              </div>
              <span className="label-small text-primary">Thinking through the workspace</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-outline-variant/30 bg-surface-container-low/70 p-4 md:p-5 backdrop-blur-xl">
        <Surface elevation={0} shape="2xl" className="relative border border-outline-variant/35 bg-surface-container shadow-xl shadow-black/15 focus-within:border-primary/45 focus-within:ring-4 focus-within:ring-primary/10">
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
            placeholder="Ask Selina to work on this repo..."
            className="min-h-[62px] w-full resize-none bg-transparent py-5 pl-5 pr-16 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/45 focus:outline-none"
          />
          <div className="absolute bottom-3 right-3">
            <Button variant="filled" size="md" disabled={isThinking || !input.trim()} onClick={handleSend} className="!h-10 !w-10 !rounded-xl !p-0" aria-label="Send message" title="Send message">
              <Send size={17} />
            </Button>
          </div>
        </Surface>
        <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-on-surface-variant/55">
          <span className="inline-flex items-center gap-2"><Terminal size={13} /> Shift+Enter for newline</span>
          <span className="hidden sm:inline">Workspace-aware session</span>
        </div>
      </div>
    </Surface>
  );
}
