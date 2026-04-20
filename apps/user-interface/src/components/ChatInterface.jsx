import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Cpu, Sparkles, User, Brain } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInterface({ onSend }) {
  const [input, setInput] = useState('');
  const { messages, isThinking, effortLevel, setEffortLevel } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-900">
      {/* Header */}
      <div className="h-12 px-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/10">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-cyan-500" />
          <h3 className="text-xs font-mono font-bold tracking-tight text-zinc-400">SWARM_LOG</h3>
        </div>
        
        <div className="flex items-center gap-1.5 bg-black rounded-full px-2 py-0.5 border border-zinc-800">
          <div className={`w-1 h-1 rounded-full ${isThinking ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-700'}`} />
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
            {isThinking ? 'Thinking...' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Effort Switcher */}
      <div className="px-4 py-2 border-b border-zinc-900 flex items-center gap-4 bg-zinc-900/5">
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Depth_Scale</span>
        <div className="flex bg-black rounded-lg p-0.5 border border-zinc-800">
          {['quick', 'standard', 'deep'].map(level => (
            <button 
              key={level}
              onClick={() => setEffortLevel(level)}
              className="relative px-3 py-1 text-[9px] uppercase font-mono transition-all z-10"
            >
              <span className={effortLevel === level ? 'text-white' : 'text-zinc-600'}>{level}</span>
              {effortLevel === level && (
                <motion.div 
                  layoutId="active-effort"
                  className="absolute inset-0 bg-cyan-600/20 border border-cyan-500/30 rounded-md -z-10"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div 
              key={`msg-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 opacity-50 px-1">
                {m.role === 'user' ? (
                  <>
                    <span className="text-[9px] font-mono uppercase tracking-widest">User_Cmd</span>
                    <User size={10} />
                  </>
                ) : (
                  <>
                    <Cpu size={10} className="text-cyan-500" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-500">Expert_Res</span>
                  </>
                )}
              </div>
              <div 
                className={`max-w-[90%] p-3 rounded-2xl text-[11px] font-mono leading-relaxed shadow-lg ${
                  m.role === 'user' 
                  ? 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tr-none' 
                  : 'bg-cyan-500/5 text-cyan-100 border border-cyan-500/20 rounded-tl-none'
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
          
          {isThinking && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 px-1"
            >
              <div className="flex gap-1">
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-cyan-500 rounded-full" />
              </div>
              <span className="text-[9px] font-mono text-cyan-500/50 uppercase italic">Computing_Next_State...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-900">
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
            placeholder="Ask Vibe Hub..." 
            className="w-full bg-black text-white border border-zinc-800 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono text-xs placeholder:text-zinc-700 resize-none overflow-hidden"
          />
          <button 
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="absolute right-2 top-2 p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all disabled:bg-zinc-800 disabled:text-zinc-600 disabled:scale-100 btn-hover group"
          >
            <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
