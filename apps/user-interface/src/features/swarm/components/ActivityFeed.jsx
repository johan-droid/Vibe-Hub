import React, { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle2, GitBranch, PenTool, Search, Terminal } from 'lucide-react';
import { useStore } from '../../../store/useStore';

function thoughtText(thought) {
  if (typeof thought === 'string') return thought;
  return thought?.content || thought?.message || '';
}

function thoughtTime(thought) {
  const ts = typeof thought === 'object' ? thought?.timestamp : null;
  if (!ts) return '00:00:00';
  return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function iconFor(text) {
  const value = text.toLowerCase();
  if (value.includes('tool') || value.includes('calling') || value.includes('edit')) return { icon: PenTool, color: 'text-primary' };
  if (value.includes('git') || value.includes('branch') || value.includes('workflow')) return { icon: GitBranch, color: 'text-tertiary' };
  if (value.includes('search') || value.includes('analyz') || value.includes('inspect')) return { icon: Search, color: 'text-on-surface-variant' };
  if (value.includes('fail') || value.includes('error')) return { icon: AlertCircle, color: 'text-error' };
  if (value.includes('success') || value.includes('verified') || value.includes('done')) return { icon: CheckCircle2, color: 'text-tertiary' };
  return { icon: Terminal, color: 'text-secondary' };
}

export default function ActivityFeed() {
  const { agentThoughts } = useStore();
  const scrollRef = useRef(null);
  const entries = useMemo(() => agentThoughts.map((thought) => ({ thought, text: thoughtText(thought) })).filter((entry) => entry.text), [agentThoughts]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      <div className="flex items-center justify-between neural-glass border-x-0 border-t-0 px-5 py-4">
        <div className="flex items-center gap-3">
          <Activity size={14} className="text-primary" />
          <h4 className="label-large uppercase tracking-[0.2em] opacity-80">Logstream</h4>
        </div>
        <span className="label-small text-on-surface-variant/40 font-mono">
          {entries.length.toString().padStart(3, '0')} PKTS
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-none">
        <AnimatePresence initial={false}>
          {entries.length ? (
            <div className="space-y-1">
              {entries.map(({ thought, text }, index) => {
                const { icon: Icon, color } = iconFor(text);
                return (
                  <motion.div
                    key={thought?.id || `${text}-${index}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex gap-4 rounded-lg p-2.5 transition-colors hover:bg-on-surface/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="label-small font-mono opacity-20 shrink-0">{thoughtTime(thought)}</span>
                      <div className="h-4 w-px bg-outline-variant/10 shrink-0" />
                      <Icon size={12} className={`${color} shrink-0 opacity-70`} />
                      <p className="truncate body-small text-on-surface-variant/80 group-hover:text-on-surface transition-colors">{text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-6">
                <Terminal size={24} className="text-primary/20" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} 
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-primary blur-[20px] rounded-full"
                />
              </div>
              <h3 className="label-large uppercase tracking-[0.2em] opacity-30">Waiting for Link</h3>
              <p className="mt-2 label-small text-on-surface-variant/30 leading-relaxed max-w-[200px]">
                Initialize workspace communication to begin data ingestion.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
