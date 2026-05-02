import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, PenTool, GitBranch, Search, AlertCircle, CheckCircle2, Zap, Activity } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';

/**
 * ActivityFeed — Material 3 Telemetry Stream
 * Real-time capture of agent orchestration and tool execution.
 */
export default function ActivityFeed() {
  const { agentThoughts } = useStore();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentThoughts]);

  const getIconConfig = (thought) => {
    const text = thought.toLowerCase();
    if (text.includes('tool') || text.includes('calling')) return { icon: PenTool, color: 'text-primary' };
    if (text.includes('git') || text.includes('clone')) return { icon: GitBranch, color: 'text-tertiary' };
    if (text.includes('searching') || text.includes('analyzing')) return { icon: Search, color: 'text-on-surface-variant' };
    if (text.includes('fail') || text.includes('error')) return { icon: AlertCircle, color: 'text-error' };
    if (text.includes('success') || text.includes('verified')) return { icon: CheckCircle2, color: 'text-secondary' };
    if (text.includes('neural') || text.includes('sync')) return { icon: Zap, color: 'text-primary' };
    return { icon: Terminal, color: 'text-on-surface-variant' };
  };

  return (
    <Surface elevation={0} className="flex flex-col h-full bg-surface-container-lowest border-t border-outline-variant/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/10 bg-surface-container-low/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <Activity size={12} className="text-primary opacity-60" />
           <h4 className="label-small font-bold text-on-surface-variant uppercase tracking-[0.2em]">Activity_Stream</h4>
        </div>
        <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
           <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
           <span className="text-[8px] font-mono font-bold text-primary uppercase">Live</span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none"
      >
        <AnimatePresence initial={false}>
          {agentThoughts.length > 0 ? (
            agentThoughts.map((thought, i) => {
              const { icon: Icon, color } = getIconConfig(thought);
              return (
                <motion.div
                  key={`thought-${i}`}
                  initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  className="flex items-start gap-4 group"
                >
                  <Surface elevation={1} shape="lg" className="mt-1 p-1.5 bg-surface-container-high group-hover:bg-surface-container-highest transition-colors duration-500">
                    <Icon size={12} className={`${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  </Surface>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className="text-[9px] font-mono font-bold text-on-surface-variant opacity-20">
                         {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                       </span>
                    </div>
                    <p className="label-small font-mono text-on-surface-variant leading-relaxed break-words opacity-70 group-hover:opacity-100 transition-opacity">
                      {thought}
                    </p>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="h-full flex items-center justify-center">
               <div className="flex flex-col items-center gap-3 opacity-10">
                  <Terminal size={32} />
                  <span className="label-small font-bold uppercase tracking-widest">Awaiting_Activity...</span>
               </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Surface>
  );
}
