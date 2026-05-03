import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
  Cpu,
  Gauge,
  GitBranch,
  LockKeyhole,
  Network,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../../services/api';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';
import SwarmVisualizer from './SwarmVisualizer';
import ActivityFeed from './ActivityFeed';

const formatPhase = (phase = 'idle') => String(phase).replace(/_/g, ' ');

function titleCase(value = '') {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return 'n/a';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function flattenGraph(graph) {
  if (Array.isArray(graph)) return graph;
  if (graph && typeof graph === 'object') return Object.values(graph);
  return [];
}

function ScoreRing({ score = 0, label }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" stroke="hsl(var(--outline-variant) / 0.45)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="50"
          cy="50"
          r="42"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          pathLength="100"
          initial={{ strokeDasharray: '0 100' }}
          animate={{ strokeDasharray: `${pct} 100` }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="text-center">
        <div className="font-display text-2xl font-black tracking-[-0.05em] text-on-surface">{pct}</div>
        <div className="label-small text-primary">{label}</div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary', progress = 0 }) {
  const toneClass = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    secondary: 'text-secondary bg-secondary/10 border-secondary/20',
    tertiary: 'text-tertiary bg-tertiary/10 border-tertiary/20',
    error: 'text-error bg-error/10 border-error/20',
  }[tone];

  return (
    <Surface elevation={0} shape="xl" className="border border-outline-variant/30 bg-surface-container-low/72 p-4 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label-small mb-2 text-on-surface-variant/70">{label}</p>
          <p className="title-large truncate">{value}</p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
          className={`h-full ${tone === 'secondary' ? 'bg-secondary' : tone === 'tertiary' ? 'bg-tertiary' : tone === 'error' ? 'bg-error' : 'bg-primary'}`}
        />
      </div>
    </Surface>
  );
}

function LiveStat({ icon: Icon, label, value, detail, tone = 'primary' }) {
  const toneClass = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    secondary: 'text-secondary bg-secondary/10 border-secondary/20',
    tertiary: 'text-tertiary bg-tertiary/10 border-tertiary/20',
    error: 'text-error bg-error/10 border-error/20',
  }[tone];

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/50 p-3">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="label-small text-on-surface-variant/70">{label}</p>
        <p className="title-small truncate">{value}</p>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{detail}</p>
      </div>
    </div>
  );
}

function Capability({ icon: Icon, title, body }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/55 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={17} />
      </div>
      <div>
        <p className="title-small">{title}</p>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{body}</p>
      </div>
    </div>
  );
}

/**
 * IntelligenceDashboard is the live command center for the authenticated workspace.
 * It combines websocket state, file-system state, workflow state, and backend diagnostics.
 */
export default function IntelligenceDashboard() {
  const {
    user,
    neuralStatus,
    workflowState,
    agentState,
    statusMessage,
    effortLevel,
    isThinking,
    vfsStatus,
    messages,
    agentThoughts,
    terminalOutput,
    vfsTree,
    openFiles,
  } = useStore();

  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState(null);
  const [skillGraph, setSkillGraph] = useState(null);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [signalError, setSignalError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadSignals = async () => {
      setLoadingSignals(true);
      try {
        const [diagnostics, skills] = await Promise.all([
          api.runtimeDiagnostics(),
          api.runtimeSkills(),
        ]);

        if (cancelled) return;

        setRuntimeDiagnostics(diagnostics);
        setSkillGraph(skills);
        setSignalError('');
        setLastSyncedAt(new Date());
      } catch (error) {
        if (!cancelled) {
          setSignalError(error?.message || 'Failed to load runtime signals.');
        }
      } finally {
        if (!cancelled) {
          setLoadingSignals(false);
        }
      }
    };

    loadSignals();
    const timer = window.setInterval(loadSignals, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id, refreshTick]);

  const providerStatus = runtimeDiagnostics?.providerStatus || {};
  const activeProvider = providerStatus.activeProvider || 'gemini';
  const activeProviderConfig = providerStatus[activeProvider] || providerStatus.gemini || {};
  const auditTail = Array.isArray(runtimeDiagnostics?.auditTail) ? runtimeDiagnostics.auditTail : [];
  const skillNodes = flattenGraph(skillGraph?.graph);
  const skillCount = skillNodes.length;

  const readinessScore = useMemo(() => {
    let score = 34;

    if (user) score += 8;
    if (vfsStatus === 'ready') score += 18;
    else if (vfsStatus === 'booting') score += 10;

    if (isThinking) score += 6;
    else if (agentState === 'idle') score += 10;
    else score += 8;

    if (workflowState?.status === 'completed' && workflowState?.conclusion !== 'failure') score += 14;
    else if (workflowState?.status === 'triggered') score += 8;
    else if (workflowState?.conclusion === 'failure') score -= 8;

    if (runtimeDiagnostics) score += 8;
    if (messages.length + agentThoughts.length > 0) score += 6;
    if (signalError) score -= 8;

    return Math.max(0, Math.min(100, score));
  }, [agentState, agentThoughts.length, isThinking, messages.length, runtimeDiagnostics, signalError, user, vfsStatus, workflowState]);

  const metrics = useMemo(() => [
    {
      icon: Brain,
      label: 'Agent phase',
      value: titleCase(neuralStatus.phase || agentState || 'idle'),
      detail: statusMessage || neuralStatus.lastAction || 'Awaiting instruction.',
      tone: isThinking ? 'secondary' : 'primary',
      progress: isThinking ? 68 : agentState === 'idle' ? 100 : 82,
    },
    {
      icon: Network,
      label: 'Project surface',
      value: `${openFiles.length} open / ${vfsTree.length} roots`,
      detail: vfsStatus === 'ready' ? 'VFS bridge connected' : vfsStatus === 'booting' ? 'Booting the workspace bridge' : 'No project tree yet',
      tone: vfsStatus === 'ready' ? 'tertiary' : 'secondary',
      progress: vfsStatus === 'ready' ? 100 : vfsStatus === 'booting' ? 45 : 18,
    },
    {
      icon: GitBranch,
      label: 'Workflow rail',
      value: workflowState?.status === 'completed'
        ? titleCase(workflowState.conclusion || 'completed')
        : workflowState?.status === 'triggered'
          ? 'Queued'
          : 'Standby',
      detail: workflowState?.url ? 'GitHub workflow finished' : 'GitHub actions and PR lifecycle',
      tone: workflowState?.conclusion === 'failure' ? 'error' : workflowState?.status === 'triggered' ? 'secondary' : 'primary',
      progress: workflowState?.status === 'completed' ? 100 : workflowState?.status === 'triggered' ? 58 : 28,
    },
    {
      icon: Gauge,
      label: 'Task effort',
      value: titleCase(effortLevel || 'standard'),
      detail: 'Budgeted reasoning lane',
      tone: 'tertiary',
      progress: effortLevel === 'deep' ? 92 : effortLevel === 'quick' ? 48 : 72,
    },
    {
      icon: Cpu,
      label: 'Runtime health',
      value: activeProvider.toUpperCase(),
      detail: activeProviderConfig?.model ? `${activeProviderConfig.model} · ${activeProviderConfig.configured === false ? 'needs key' : 'key ready'}` : 'Provider diagnostics unavailable',
      tone: activeProviderConfig?.configured === false ? 'error' : 'primary',
      progress: activeProviderConfig?.configured === false ? 40 : 84,
    },
    {
      icon: Sparkles,
      label: 'Signal volume',
      value: `${messages.length + agentThoughts.length}`,
      detail: `${messages.length} turns / ${terminalOutput.length} terminal lines`,
      tone: 'secondary',
      progress: Math.min(100, (messages.length + agentThoughts.length + terminalOutput.length) * 5),
    },
  ], [activeProvider, activeProviderConfig?.configured, activeProviderConfig?.model, agentState, agentThoughts.length, effortLevel, isThinking, messages.length, neuralStatus.lastAction, neuralStatus.phase, openFiles.length, statusMessage, terminalOutput.length, vfsStatus, vfsTree.length, workflowState]);

  const summaryTags = [
    user?.name || 'Authenticated session',
    `${auditTail.length} audit events`,
    loadingSignals ? 'refreshing live signals' : `synced ${lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}`,
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-none bg-surface-container-lowest/35 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <Surface elevation={0} shape="2xl" className="overflow-hidden border border-outline-variant/30 bg-surface-container-low/80 shadow-2xl shadow-black/15">
          <div className="relative p-5 md:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_bottom_left,hsl(var(--secondary)/0.10),transparent_28%)]" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                  <Sparkles size={13} />
                  <span className="label-small">Live command center</span>
                </div>
                <div>
                  <h2 className="headline-medium">Dashboard</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-on-surface-variant">
                    The workspace reads the agent stream, file system, workflow state, and runtime diagnostics together so you can operate from one control surface.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summaryTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-outline-variant/30 bg-surface-container-lowest/55 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant">
                      {tag}
                    </span>
                  ))}
                </div>
                {signalError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-error-container">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{signalError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <ScoreRing score={readinessScore} label="readiness" />
                <div className="min-w-[230px] space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm text-on-surface">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${isThinking ? 'bg-secondary animate-soft-pulse' : 'bg-tertiary'}`} />
                      {isThinking ? 'Processing request' : 'Ready for execution'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRefreshTick((value) => value + 1)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-lowest/60 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-on-surface-variant transition hover:text-primary"
                    >
                      <RefreshCw size={11} className={loadingSignals ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/55 p-3">
                    <p className="label-small text-on-surface-variant/70">Current phase</p>
                    <p className="title-small capitalize text-primary">{formatPhase(neuralStatus.phase || agentState)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{statusMessage || neuralStatus.lastAction || 'Awaiting instruction.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <Surface elevation={0} shape="2xl" className="min-h-[520px] overflow-hidden border border-outline-variant/30 bg-surface-container-low/70 shadow-xl shadow-black/10">
            <ActivityFeed />
          </Surface>

          <div className="grid gap-5">
            <Surface elevation={0} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="label-small text-primary">Runtime posture</p>
                  <h3 className="title-large mt-1">System signal</h3>
                </div>
                <div className="rounded-full border border-tertiary/20 bg-tertiary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                  {loadingSignals ? 'Syncing' : 'Live'}
                </div>
              </div>

              <div className="space-y-3">
                <LiveStat icon={Cpu} label="Provider" value={activeProvider.toUpperCase()} detail={activeProviderConfig?.model || 'Provider configuration unavailable'} />
                <LiveStat icon={Clock3} label="Uptime" value={formatDuration(runtimeDiagnostics?.uptime * 1000)} detail={`Audit tail holds ${auditTail.length} events`} tone="secondary" />
                <LiveStat icon={Gauge} label="Memory" value={formatBytes(runtimeDiagnostics?.memory)} detail="Heap usage from the bridge process" tone="tertiary" />
                <LiveStat icon={LockKeyhole} label="Session" value={user?.email ? 'Authenticated' : 'Signed in'} detail={user?.name || 'OAuth-backed route'} tone="primary" />
              </div>

              <div className="mt-5 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/55 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-small text-on-surface-variant">Operational snapshot</p>
                  <Terminal size={14} className="text-secondary" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="title-large">{messages.length}</p>
                    <p className="label-small text-on-surface-variant/70">Turns</p>
                  </div>
                  <div>
                    <p className="title-large">{openFiles.length}</p>
                    <p className="label-small text-on-surface-variant/70">Files</p>
                  </div>
                  <div>
                    <p className="title-large">{terminalOutput.length}</p>
                    <p className="label-small text-on-surface-variant/70">Logs</p>
                  </div>
                </div>
              </div>
            </Surface>

            <Surface elevation={0} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="label-small text-primary">Skill graph</p>
                  <h3 className="title-large mt-1">Routing topology</h3>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
                  {skillCount} nodes
                </div>
              </div>

              <div className="space-y-3">
                <Capability icon={GitBranch} title="Live graph" body={`${skillGraph?.mode || 'Mixture of experts'} with ${skillCount} routing nodes exposed by the backend.`} />
                <Capability icon={CheckCircle2} title="Audit trail" body={`${auditTail.length} recent provider events are available for inspection in the runtime diagnostics card.`} />
                <Capability icon={Zap} title="Action loop" body="The dashboard stays tied to agent activity, workflow updates, and terminal output so it changes as the session changes." />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {skillNodes.slice(0, 6).map((node) => (
                  <span key={node.id} className="rounded-full border border-outline-variant/30 bg-surface-container-lowest/55 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant">
                    {node.label}
                  </span>
                ))}
              </div>
            </Surface>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Surface elevation={0} shape="2xl" className="min-h-[420px] overflow-hidden border border-outline-variant/30 bg-surface-container-low/70 shadow-xl shadow-black/10">
            <SwarmVisualizer />
          </Surface>

          <Surface elevation={0} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="label-small text-primary">Next run posture</p>
                <h3 className="title-large mt-1">What changes next</h3>
              </div>
              <div className="rounded-full border border-tertiary/20 bg-tertiary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                Ready
              </div>
            </div>

            <div className="space-y-3">
              <Capability icon={Rocket} title="Editor handoff" body="Open a file from the explorer to drop into the editing lane without leaving the dashboard route." />
              <Capability icon={ShieldCheck} title="Signal fidelity" body="Use the refresh action to pull the latest runtime diagnostics and skill graph from the backend." />
              <Capability icon={Activity} title="Live feed" body="The activity stream mirrors new thoughts, plans, and tool calls as soon as the websocket pushes them." />
              <Capability icon={Brain} title="Agent focus" body={`Current phase: ${formatPhase(neuralStatus.phase || agentState)}. ${statusMessage || neuralStatus.lastAction || 'No active instruction.'}`} />
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
