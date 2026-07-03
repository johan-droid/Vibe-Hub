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
    <div className="panel p-6 group hover:bg-surface-container-low/50 duration-500">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={22} />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-google-green/10 px-3 py-1.5 text-[11px] font-black tracking-wider text-google-green uppercase">
          <ArrowUpRight size={14} />
          {detail}
        </span>
      </div>
      <p className="label-medium opacity-60 mb-2">{label}</p>
      <p className="text-4xl font-black tracking-tight text-on-surface">{value}</p>
    </div>
  );
}

function ExpertCard({ icon: Icon, role, name, status, tone }) {
  return (
    <div className="panel flex items-center gap-5 p-5 group hover:bg-surface-container-low/50 duration-500">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone} shadow-sm group-hover:rotate-6 transition-transform duration-500`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-black text-on-surface tracking-tight">{name}</p>
        <p className="mt-1 text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">{role}</p>
      </div>
      <span className="shrink-0 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary group-hover:border-transparent transition-all duration-300">
        {status}
      </span>
    </div>
  );
}

export default function IntelligenceDashboard({ page = 'overview' }) {
  const { isThinking, agentThoughts, vfsStatus } = useStore();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface pb-20">
      <header className="border-b border-outline-variant/30 bg-surface-container-lowest px-6 py-10 md:px-10 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-outline-variant/60 bg-surface-container-low px-4 py-2">
              <Radio size={14} className="text-google-green animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {page === 'overview' ? 'Operational System' : page}
              </span>
            </div>
            <h1 className="display-small mb-4">System Intelligence</h1>
            <p className="max-w-2xl text-lg font-medium leading-relaxed text-on-surface-variant">
              A real-time view of your AI partners, workspace health, and system readiness.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:flex">
            <div className="panel px-6 py-4 flex flex-col justify-center">
              <p className="label-small mb-1">Workspace</p>
              <p className="text-sm font-black capitalize text-on-surface">{vfsStatus || 'syncing'}</p>
            </div>
            <div className="panel px-6 py-4 flex flex-col justify-center">
              <p className="label-small mb-1">Agent state</p>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isThinking ? 'bg-primary animate-ping' : 'bg-google-green'}`} />
                <p className="text-sm font-black text-on-surface">{isThinking ? 'Thinking' : 'Ready'}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 md:px-10 lg:grid-cols-[1fr_24rem] lg:px-12">
        <section className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <section className="panel p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="title-large mb-2">Expert Partners</h2>
                <p className="text-base font-medium text-on-surface-variant">Specialized agents available to help you build.</p>
              </div>
              <Button variant="tonal" size="md">Refresh Sync</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {experts.map((expert) => (
                <ExpertCard key={expert.name} {...expert} />
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-outline-variant/40 px-8 py-6 bg-surface-container-low/30">
              <h2 className="title-large mb-2">Live Timeline</h2>
              <p className="text-base font-medium text-on-surface-variant">Recent actions and system updates.</p>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {events.map((event) => (
                <div key={`${event.time}-${event.text}`} className="flex items-start gap-6 px-8 py-6 hover:bg-surface-container-low/20 transition-colors duration-300">
                  <span className="w-16 shrink-0 font-black text-xs text-primary/60 tracking-wider uppercase">{event.time}</span>
                  <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
                    <event.icon size={16} />
                  </div>
                  <p className="text-base font-bold leading-relaxed text-on-surface">{event.text}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-8">
          <section className="panel p-8 bg-gradient-to-br from-surface-container-low to-transparent">
            <div className="mb-8 flex items-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-google-green/10 text-google-green shadow-sm">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h2 className="text-lg font-black text-on-surface tracking-tight">System Healthy</h2>
                <p className="text-sm font-medium text-on-surface-variant">All services operational.</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                ['Runtime Connection', 'Active'],
                ['Security Shield', 'Engaged'],
                ['Memory Units', `${agentThoughts.length}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-surface-container-high/40 px-5 py-3 border border-outline-variant/20">
                  <span className="text-sm font-bold text-on-surface-variant">{label}</span>
                  <span className="text-sm font-black text-primary">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel bg-primary p-8 text-on-primary shadow-2xl shadow-primary/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-125 transition-transform duration-1000">
               <Lock size={120} />
            </div>
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <h2 className="title-large text-on-primary mb-4">Secure Perimeter</h2>
            <p className="text-base font-medium leading-relaxed text-on-primary/85">
              Your work is protected by industrial-grade sandboxing. Every action is audited and isolated for your safety.
            </p>
            <Button variant="tonal" size="lg" className="mt-8 w-full bg-white text-primary hover:bg-white/95 border-none shadow-lg">
              Security Audit
            </Button>
          </section>
        </aside>
      </main>
    </div>
  );
}
