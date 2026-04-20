import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, PenTool, GitBranch, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ActivityFeed() {
  const { agentThoughts } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentThoughts]);

  const getIcon = (thought) => {
    const text = thought.toLowerCase();
    if (text.includes('tool') || text.includes('calling')) return <PenTool size={12} className="text-cyan-400" />;
    if (text.includes('git') || text.includes('clone')) return <GitBranch size={12} className="text-purple-400" />;
    if (text.includes('searching') || text.includes('analyzing')) return <Search size={12} className="text-zinc-400" />;
    if (text.includes('fail') || text.includes('error')) return <AlertCircle size={12} className="text-red-400" />;
    if (text.includes('success') || text.includes('verified')) return <CheckCircle2 size={12} className="text-emerald-400" />;
    return <Terminal size={12} className="text-zinc-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-t border-zinc-900 overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-900 bg-zinc-900/20 flex items-center justify-between">
        <h4 className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-tighter">Activity_Live</h4>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 font-mono scroll-smooth scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {agentThoughts.length > 0 ? (
            agentThoughts.map((thought, i) => (
              <motion.div
                key={`thought-${i}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 group"
              >
                <div className="mt-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  {getIcon(thought)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-400 leading-relaxed break-words">
                    <span className="text-zinc-700 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                    {thought}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-800 italic text-[10px]">
              awaiting_activity...
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
