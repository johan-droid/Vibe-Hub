import React, { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle2, GitBranch, PenTool, Search, Terminal } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';

function thoughtText(thought) {
  if (typeof thought === 'string') return thought;
  return thought?.content || thought?.message || '';
}

function thoughtTime(thought) {
  const ts = typeof thought === 'object' ? thought?.timestamp : null;
  if (!ts) return 'just now';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

/**
 * ActivityFeed renders the real agent stream without decorative filler.
 */
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
    <Surface elevation={0} className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      <div className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-low/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <Activity size={16} className="text-primary" />
          <div>
            <h4 className="title-small">Activity</h4>
            <p className="text-xs text-on-surface-variant">Live thoughts, tool calls, plans, and errors from Selina.</p>
          </div>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {entries.length ? `${entries.length} events` : 'Waiting'}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-none">
        <AnimatePresence initial={false}>
          {entries.length ? (
            <div className="space-y-3">
              {entries.map(({ thought, text }, index) => {
                const { icon: Icon, color } = iconFor(text);
                return (
                  <motion.div
                    key={thought?.id || `${text}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-surface-container-low/65 p-4"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant">
                      <Icon size={16} className={color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-on-surface-variant">{thoughtTime(thought)}</span>
                      </div>
                      <p className="break-words text-sm leading-6 text-on-surface">{text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container text-primary">
                  <Terminal size={22} />
                </div>
                <h3 className="title-medium">No activity yet</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Send a prompt from the chat or open a file in the workbench. This feed will show the actual agent stream, not placeholder telemetry.
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Surface>
  );
}
