import React from 'react';
import {
  Activity, Brain, CheckCircle2, Clock3, Cpu, Gauge, GitBranch,
  LockKeyhole, Network, Rocket, ShieldCheck, Sparkles, Zap
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';
import { motion } from 'framer-motion';
import SwarmVisualizer from './SwarmVisualizer';

const formatPhase = (phase = 'idle') => String(phase).replace(/_/g, ' ');

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
 * IntelligenceDashboard presents market-ready runtime posture, model routing,
 * security, and debug readiness without overwhelming the workspace.
 */
export default function IntelligenceDashboard() {
  const {
    neuralStatus,
    workflowState,
    agentState,
    statusMessage,
    effortLevel,
    isThinking,
    vfsStatus,
    messages,
  } = useStore();

  const workflowDone = workflowState?.status === 'completed';
  const workflowFailed = workflowState?.conclusion === 'failure';
  const runtimeScore = isThinking ? 87 : 96;
  const modelLabel = import.meta.env.VITE_AGENT_MODEL_LABEL || 'Multi-model gateway';

  const metrics = [
    {
      icon: Brain,
      label: 'Model Strategy',
      value: modelLabel,
      detail: `${effortLevel || 'standard'} effort / token-aware`,
      tone: 'primary',
      progress: effortLevel === 'deep' ? 92 : effortLevel === 'quick' ? 48 : 72,
    },
    {
      icon: ShieldCheck,
      label: 'Security Posture',
      value: workflowFailed ? 'Action needed' : 'Hardened',
      detail: workflowState?.conclusion || 'OAuth, sandbox, audit hooks',
      tone: workflowFailed ? 'error' : 'tertiary',
      progress: workflowFailed ? 38 : 88,
    },
    {
      icon: GitBranch,
      label: 'Automation Rail',
      value: workflowState?.status === 'triggered' ? 'Queued' : workflowDone ? 'Complete' : 'Standby',
      detail: 'GitHub Actions / PR lifecycle',
      tone: workflowState?.status === 'triggered' ? 'secondary' : 'primary',
      progress: workflowState?.status === 'triggered' ? 56 : workflowDone ? 100 : 28,
    },
    {
      icon: Network,
      label: 'Workspace Link',
      value: vfsStatus === 'ready' ? 'Ready' : vfsStatus === 'booting' ? 'Booting' : 'Idle',
      detail: 'WebContainer + VFS bridge',
      tone: vfsStatus === 'ready' ? 'tertiary' : 'secondary',
      progress: vfsStatus === 'ready' ? 100 : vfsStatus === 'booting' ? 45 : 20,
    },
  ];

  return (
    <div className="h-full overflow-y-auto scrollbar-none bg-surface-container-lowest/35 p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <Surface elevation={0} shape="2xl" className="overflow-hidden border border-outline-variant/30 bg-surface-container-low/80 shadow-2xl shadow-black/15">
          <div className="relative p-5 md:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34%),radial-gradient(circle_at_bottom_left,hsl(var(--secondary)/0.10),transparent_28%)]" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                  <Sparkles size={13} />
                  <span className="label-small">SaaS command center</span>
                </div>
                <h2 className="headline-medium">Intelligence Dashboard</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-on-surface-variant">
                  Production posture for model routing, debugging, sandbox execution, provider health, and audit visibility.
                </p>
              </div>
              <div className="flex items-center gap-5">
                <ScoreRing score={runtimeScore} label="ready" />
                <div className="min-w-[180px] space-y-3">
                  <div className="flex items-center gap-2 text-sm text-on-surface">
                    <span className={`h-2.5 w-2.5 rounded-full ${isThinking ? 'bg-secondary animate-soft-pulse' : 'bg-tertiary'}`} />
                    {isThinking ? 'Processing request' : 'Ready for execution'}
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Surface elevation={0} shape="2xl" className="min-h-[420px] overflow-hidden border border-outline-variant/30 bg-surface-container-low/70 shadow-xl shadow-black/10">
            <SwarmVisualizer />
          </Surface>

          <Surface elevation={0} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5 shadow-xl shadow-black/10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="label-small text-primary">Market readiness</p>
                <h3 className="title-large mt-1">Power stack</h3>
              </div>
              <div className="rounded-full border border-tertiary/20 bg-tertiary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-tertiary">
                Live
              </div>
            </div>

            <div className="space-y-3">
              <Capability icon={Cpu} title="Provider gateway" body="Gemini default with OpenAI-compatible, Qwen, and Claude adapters ready on env keys." />
              <Capability icon={Gauge} title="Token economy" body="History trimming, prompt budgeting, output caps, and audit counters for efficient calls." />
              <Capability icon={LockKeyhole} title="Backend hardening" body="Timeouts, retries, redaction, and structured diagnostics for SaaS operations." />
              <Capability icon={Zap} title="Debug loop" body="Streaming, status phases, sandbox handoff, and peer-review hooks feed the cockpit." />
            </div>

            <div className="mt-5 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/55 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-small text-on-surface-variant">Session signal</p>
                <Clock3 size={14} className="text-secondary" />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="title-large">{messages.length}</p>
                  <p className="label-small text-on-surface-variant/70">Turns</p>
                </div>
                <div>
                  <p className="title-large capitalize">{effortLevel || 'std'}</p>
                  <p className="label-small text-on-surface-variant/70">Effort</p>
                </div>
                <div>
                  <p className="title-large">{isThinking ? 'On' : 'Idle'}</p>
                  <p className="label-small text-on-surface-variant/70">Agent</p>
                </div>
              </div>
            </div>
          </Surface>
        </div>

        <Surface elevation={0} shape="2xl" className="border border-outline-variant/30 bg-surface-container-low/70 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Rocket size={20} />
              </div>
              <div>
                <h3 className="title-medium">Next run posture</h3>
                <p className="text-sm text-on-surface-variant">Audit, debug, implement, verify, and summarize with production telemetry.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Codex-grade routing', 'Claude review', 'Qwen coder', 'Gemini tools'].map((tag) => (
                <span key={tag} className="rounded-full border border-outline-variant/30 bg-surface-container-lowest/55 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
