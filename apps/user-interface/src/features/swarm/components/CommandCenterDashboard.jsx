import React from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  Gauge,
  Layout,
  Lock,
  Radio,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';

const metrics = [
  { icon: Brain, label: 'Active agents', value: '12', detail: '+3 ready', tone: 'text-primary bg-primary/10' },
  { icon: Zap, label: 'Throughput', value: '4.1k', detail: '+2.4%', tone: 'text-google-yellow bg-google-yellow/10' },
  { icon: ShieldCheck, label: 'Trust score', value: '100%', detail: 'clean', tone: 'text-google-green bg-google-green/10' },
  { icon: BarChart3, label: 'Efficiency', value: '98.2', detail: '+5.1%', tone: 'text-google-red bg-google-red/10' },
];

const experts = [
  { icon: Server, role: 'Architecture', name: 'Selina Core', status: 'Ready', tone: 'text-primary bg-primary/10' },
  { icon: Layout, role: 'Product design', name: 'Nova Vision', status: 'Reviewing', tone: 'text-google-red bg-google-red/10' },
  { icon: Terminal, role: 'Runtime', name: 'Prism Exec', status: 'Active', tone: 'text-google-green bg-google-green/10' },
  { icon: Database, role: 'Context', name: 'Vault Store', status: 'Synced', tone: 'text-google-yellow bg-google-yellow/10' },
];

const events = [
  { time: '14:09', text: 'Workspace topology indexed across 243 assets.', icon: Code2 },
  { time: '14:08', text: 'Security perimeter verified for this session.', icon: ShieldCheck },
  { time: '14:07', text: 'Runtime bridge connected and streaming.', icon: Radio },
  { time: '14:05', text: 'Agent context refreshed from local memory.', icon: Brain },
];

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className="panel p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={19} />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-google-green/10 px-2 py-1 text-[10px] font-bold text-google-green">
          <ArrowUpRight size={12} />
          {detail}
        </span>
      </div>
      <p className="label-medium">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-on-surface">{value}</p>
    </div>
  );
}

function ExpertCard({ icon: Icon, role, name, status, tone }) {
  return (
    <div className="panel flex items-center gap-4 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-on-surface">{name}</p>
        <p className="mt-1 text-xs font-medium text-on-surface-variant">{role}</p>
      </div>
      <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container-low px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
        {status}
      </span>
    </div>
  );
}

export default function IntelligenceDashboard({ page = 'overview' }) {
  const { isThinking, agentThoughts, vfsStatus } = useStore();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface pb-12">
      <header className="border-b border-outline-variant bg-surface-container-lowest px-5 py-6 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5">
              <Radio size={13} className="text-google-green" />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                {page === 'overview' ? 'Operational overview' : page}
              </span>
            </div>
            <h1 className="display-small">System Intelligence</h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-on-surface-variant">
              A focused view of agent readiness, workspace health, runtime state, and recent system activity.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="panel px-4 py-3">
              <p className="label-small">Workspace</p>
              <p className="mt-1 text-sm font-black capitalize text-on-surface">{vfsStatus || 'syncing'}</p>
            </div>
            <div className="panel px-4 py-3">
              <p className="label-small">Agent state</p>
              <p className="mt-1 text-sm font-black text-on-surface">{isThinking ? 'Thinking' : 'Ready'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1fr_22rem] lg:px-10">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <section className="panel p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="title-medium">Expert Swarm</h2>
                <p className="mt-1 text-sm font-medium text-on-surface-variant">Specialized workers available for this workspace.</p>
              </div>
              <Button variant="outlined" size="sm">Re-index</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {experts.map((expert) => (
                <ExpertCard key={expert.name} {...expert} />
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-outline-variant px-5 py-4">
              <h2 className="title-medium">System Events</h2>
              <p className="mt-1 text-sm font-medium text-on-surface-variant">Recent platform activity and verification checkpoints.</p>
            </div>
            <div className="divide-y divide-outline-variant">
              {events.map((event) => (
                <div key={`${event.time}-${event.text}`} className="flex items-start gap-4 px-5 py-4">
                  <span className="w-12 shrink-0 font-mono text-xs font-bold text-on-surface-variant">{event.time}</span>
                  <event.icon size={16} className="mt-0.5 shrink-0 text-primary" />
                  <p className="text-sm font-medium leading-6 text-on-surface">{event.text}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-google-green/10 text-google-green">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-on-surface">Workspace Healthy</h2>
                <p className="text-xs font-medium text-on-surface-variant">All critical services online.</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['Runtime bridge', 'Connected'],
                ['Security boundary', 'Enforced'],
                ['Context packets', `${agentThoughts.length}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
                  <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
                  <span className="text-xs font-black text-on-surface">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel bg-primary p-5 text-on-primary">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
              <Lock size={18} />
            </div>
            <h2 className="title-medium text-on-primary">Secure perimeter</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-on-primary/75">
              Local workspace data stays isolated while runtime actions are audited and scoped to the current session.
            </p>
            <Button variant="tonal" size="md" className="mt-5 w-full border-white/20 bg-white text-primary hover:bg-white/95">
              Audit Security
            </Button>
          </section>

          <section className="panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <Cloud size={17} className="text-primary" />
              <h2 className="text-sm font-black text-on-surface">Deployment Readiness</h2>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full w-[82%] rounded-full bg-primary" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-on-surface-variant">
              <span>Checks complete</span>
              <span>82%</span>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
