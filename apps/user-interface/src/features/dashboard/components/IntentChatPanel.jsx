import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Bot, CornerDownLeft, MessageSquare, User } from 'lucide-react';
import { SelinaLogoCompact } from '../../../components/VibeLogo';
import { SELINA_BRAND } from '../../../brand/selina';

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
          isUser
            ? 'border-[#F7C35F]/25 bg-[#F7C35F]/10 text-[#F7C35F]'
            : 'border-[#43F3C5]/25 bg-[#43F3C5]/10 text-[#43F3C5]'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      <div className={`min-w-0 flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
        <div className={`mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span>{isUser ? 'You' : SELINA_BRAND.agentName}</span>
          <span>{formatTime(message.timestamp)}</span>
        </div>
        <div
          className={`inline-block max-w-full rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'border-[#F7C35F]/20 bg-[#F7C35F]/10 text-white'
              : 'border-white/10 bg-white/[0.045] text-white/80'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function IntentChatPanel({ messages, onSendMessage, isThinking }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!input.trim() || isThinking) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare size={17} className="text-[#43F3C5]" />
              <h2 className="text-sm font-black tracking-tight text-white">Intent Studio</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-white/40">Project brief and product decisions</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
            Live
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5">
              <SelinaLogoCompact size={64} />
            </div>
            <h3 className="text-lg font-black tracking-tight text-white">Start with an outcome</h3>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/45">
              Name the product, workflow, or screen you want Selina to shape.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message, index) => (
              <MessageBubble key={message.id || index} message={message} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-5 flex gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#43F3C5]/25 bg-[#43F3C5]/10 text-[#43F3C5]">
                <Bot size={15} />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.045] px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((delay) => (
                    <motion.span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-[#43F3C5]"
                      animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: delay * 0.12 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the build..."
                disabled={isThinking}
                className="max-h-32 min-h-11 w-full resize-none rounded-lg border border-white/10 bg-white/[0.045] px-3.5 py-3 pr-10 text-sm font-medium leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[#43F3C5]/45 focus:bg-white/[0.065] disabled:opacity-50"
              />
              <CornerDownLeft size={14} className="pointer-events-none absolute bottom-3.5 right-3 text-white/25" />
            </div>
            <motion.button
              type="submit"
              disabled={!input.trim() || isThinking}
              whileHover={!input.trim() || isThinking ? undefined : { y: -1 }}
              whileTap={!input.trim() || isThinking ? undefined : { scale: 0.96 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#43F3C5] text-[#07110F] transition hover:bg-[#6FF8D4] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/30"
              aria-label="Send message"
            >
              <ArrowUp size={18} />
            </motion.button>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
            <span>Secure session</span>
            <span>Cmd/Ctrl Enter</span>
          </div>
        </form>
      </div>
    </div>
  );
}
