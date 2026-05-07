import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Package,
  Terminal,
  Workflow,
} from 'lucide-react';
import { SELINA_BRAND } from '../../../brand/selina';

function toDate(timestamp) {
  if (!timestamp) return new Date();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatTimeAgo(timestamp) {
  const date = toDate(timestamp);
  const diff = Date.now() - date.getTime();

  if (diff < 60_000) return `${Math.max(0, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function detailText(details) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function activityIcon(type, source) {
  if (type === 'command_run') return Terminal;
  if (type === 'error') return AlertTriangle;
  if (type === 'success') return CheckCircle;
  if (type === 'package_install') return Package;
  if (['reasoning', 'tool_call', 'mcp_tool', 'plan_request'].includes(type)) return Workflow;
  if (source === 'terminal') return Terminal;
  return FileText;
}

function activityTone(type, exitCode, status, source) {
  if (type === 'error' || status === 'failed' || (exitCode !== undefined && exitCode !== null && exitCode !== 0)) {
    return 'border-[#FF6B6B]/25 bg-[#FF6B6B]/10 text-[#FF8F8F]';
  }
  if (type === 'success' || status === 'completed' || status === 'approved') return 'border-[#43F3C5]/25 bg-[#43F3C5]/10 text-[#43F3C5]';
  if (status === 'approval_required' || source === 'mcp') return 'border-[#F7C35F]/25 bg-[#F7C35F]/10 text-[#F7C35F]';
  if (type === 'tool_call') return 'border-[#8DA2FF]/25 bg-[#8DA2FF]/10 text-[#8DA2FF]';
  if (source === 'terminal') return 'border-[#43F3C5]/25 bg-[#43F3C5]/10 text-[#43F3C5]';
  if (type === 'reasoning') return 'border-[#8DA2FF]/25 bg-[#8DA2FF]/10 text-[#8DA2FF]';
  return 'border-white/10 bg-white/[0.04] text-white/55';
}

function groupActivities(activities) {
  return activities.reduce((groups, activity) => {
    const key = activity.command
      ? `cmd:${activity.command.split(' ')[0]}`
      : activity.tool
        ? `tool:${activity.tool}`
        : `item:${activity.id || groups.length}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(activity);
      return groups;
    }
    groups.push({ key, items: [activity] });
    return groups;
  }, []);
}

const filters = [
  { id: 'all', label: 'All' },
  { id: 'tool_call', label: 'Tools' },
  { id: 'terminal_output', label: 'Terminal' },
  { id: 'plan_request', label: 'Approvals' },
  { id: 'error', label: 'Errors' },
];

export default function ActivityFeed({ agentLoopStatus, vfsInstance, onExpandTerminal, events = [], experienceMode = 'professional' }) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [realTimeActivities, setRealTimeActivities] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const feedRef = useRef(null);

  const rawActivities = events.length > 0
    ? events
    : agentLoopStatus.history?.length > 0
    ? agentLoopStatus.history
    : realTimeActivities;
  const activities = rawActivities.filter((activity) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'error') return activity.type === 'error' || activity.status === 'failed';
    return activity.type === activeFilter;
  });

  useEffect(() => {
    if (!vfsInstance) return;
    if (agentLoopStatus.history?.length > 0) {
      setRealTimeActivities(agentLoopStatus.history);
    }
  }, [vfsInstance, agentLoopStatus.history]);

  const groupedItems = useMemo(() => groupActivities(activities), [activities]);

  const toggleExpanded = (id) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={17} className="text-[#F7C35F]" />
              <h2 className="text-sm font-black tracking-tight text-white">Execution Timeline</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-white/40">{SELINA_BRAND.agentName} activity</p>
          </div>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
            {rawActivities.length} events
          </span>
        </div>
        {experienceMode === 'professional' && rawActivities.length > 0 && (
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                  activeFilter === filter.id
                    ? 'border-[#43F3C5]/30 bg-[#43F3C5]/10 text-[#43F3C5]'
                    : 'border-white/10 bg-white/[0.035] text-white/35 hover:text-white/70'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {activities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/25">
              <Clock size={30} />
            </div>
            <h3 className="text-lg font-black text-white">No activity yet</h3>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/40">
              Build steps, sandbox checks, and file operations will stream here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map((group) => (
              <div key={group.key} className="space-y-2">
                {group.items.length > 1 && (
                  <div className="flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/30">
                    <Workflow size={12} />
                    {group.items.length} related attempts
                  </div>
                )}

                {group.items.map((activity, index) => {
                  const itemId = activity.id || `${group.key}-${index}`;
                  const isExpanded = expandedItems.has(itemId);
                  const Icon = activityIcon(activity.type, activity.source);
                  const tone = activityTone(activity.type, activity.exitCode, activity.status, activity.source);
                  const expandedDetail = detailText(activity.details);

                  return (
                    <motion.article
                      key={itemId}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.2) }}
                      className={`overflow-hidden rounded-lg border transition ${
                        isExpanded
                          ? 'border-white/15 bg-white/[0.045]'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.045]'
                      }`}
                    >
                      <button
                        onClick={() => toggleExpanded(itemId)}
                        className="flex w-full items-start gap-3 p-3 text-left"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${tone}`}>
                          <Icon size={15} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="truncate text-sm font-bold text-white/85">
                            {activity.title || activity.command || activity.tool || 'Workspace event'}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                              {formatTimeAgo(activity.timestamp)}
                            </span>
                          </span>
                          <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-white/40">
                            {activity.summary || activity.message || 'Execution event received.'}
                          </span>

                          {activity.command && (
                            <span className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-white/10 bg-[#080A0F]/80 px-2 py-1 font-mono text-[11px] text-white/60">
                              <Terminal size={12} className="shrink-0 text-[#43F3C5]" />
                              <span className="truncate">{activity.command}</span>
                            </span>
                          )}
                        </span>

                        <span className="mt-1 shrink-0 text-white/30">
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/10"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="space-y-3 bg-[#080A0F]/55 p-3">
                              {activity.command && expandedDetail && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Terminal output</span>
                                    {onExpandTerminal && (
                                      <button
                                        onClick={onExpandTerminal}
                                        className="text-xs font-bold text-[#43F3C5] transition hover:text-[#6FF8D4]"
                                      >
                                        Expand
                                      </button>
                                    )}
                                  </div>
                                  <pre className="max-h-48 overflow-y-auto rounded-md border border-white/10 bg-black/35 p-3 font-mono text-xs leading-5 text-[#A7FFE9]">
                                    {expandedDetail}
                                  </pre>
                                </>
                              )}

                              {!activity.command && expandedDetail && (
                                <pre className="max-h-48 overflow-y-auto rounded-md border border-white/10 bg-black/25 p-3 font-mono text-xs leading-5 text-white/65">
                                  {expandedDetail}
                                </pre>
                              )}

                              {!expandedDetail && (
                                <p className="text-xs leading-relaxed text-white/40">No expanded detail for this event.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
