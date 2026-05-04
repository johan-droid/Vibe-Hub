import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0, 0, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Gauge,
  Layers3,
  MessageSquare,
  RefreshCw,
  Route,
  Search,
  Server,
  ShieldCheck,
  TerminalSquare,
  Wifi,
  Zap,
  Coffee,
  Globe,
  Terminal,
  Shield,
  ZapIcon,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useBackendSignals, flattenSkillGraph } from '../../../hooks/useBackendSignals';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';
import ActivityFeed from './ActivityFeed';
import SecurityAudit from '../../security/components/SecurityAudit';

const PAGES = {
  overview: 'Workspace Overview',
  activity: 'Real-time Activity',
  runtime: 'System Diagnostics',
  skills: 'Agent Expertise',
  security: 'Security & Privacy',
};

function titleCase(value = '') {
  return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Calculating...';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Calculating...';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function flattenFiles(nodes = []) {
  const files = [];
  const visit = (node) => {
    if (!node) return;
    if (node.isDir || node.type === 'directory') (node.children || []).forEach(visit);
    else files.push(node);
  };
  nodes.forEach(visit);
  return files;
}

function AmbientBg() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute -left-32 top-32 h-[500px] w-[500px] rounded-full bg-google-blue/5 blur-[120px]" 
      />
      <motion.div 
        animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, delay: 1 }}
        className="absolute -right-20 bottom-20 h-[400px] w-[400px] rounded-full bg-google-red/5 blur-[140px]" 
      />
    </div>
  );
}

function Panel({ children, className = '', animate = true, noPadding = false }) {
  const Comp = animate ? motion.section : 'section';
  const animProps = animate ? { variants: fadeUp, initial: 'hidden', whileInView: 'show', viewport: { once: true } } : {};
  return (
    <Comp 
      {...animProps} 
      className={`rounded-[2.5rem] bg-white border border-outline-variant/30 shadow-sm transition-all duration-500 hover:shadow-md hover:border-outline-variant/50 ${noPadding ? '' : 'p-10'} ${className}`}
    >
      {children}
    </Comp>
  );
}

const PAGE_META = {
  overview: { title: () => `Your Workspace`, desc: 'Everything you need at a glance.' },
  activity: { title: () => 'Activity History', desc: 'Detailed log of all agent interactions.' },
  runtime: { title: () => 'System Health', desc: 'Real-time performance and connectivity.' },
  skills: { title: () => 'Agent Capabilities', desc: 'Browse specialized skills in your swarm.' },
  security: { title: () => 'Privacy & Security', desc: 'Manage access and audit system logs.' },
};

function Pill({ children, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'bg-on-surface/[0.03] text-on-surface-variant/80 border-outline-variant/30',
    good: 'bg-google-green/10 text-google-green border-google-green/20',
    warn: 'bg-google-yellow/10 text-google-yellow border-google-yellow/20',
    bad: 'bg-google-red/10 text-google-red border-google-red/20',
    info: 'bg-google-blue/10 text-google-blue border-google-blue/20',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-widest ${tones[tone]}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = 'info' }) {
  const tones = {
    info: 'bg-google-blue/10 text-google-blue border-google-blue/20',
    good: 'bg-google-green/10 text-google-green border-google-green/20',
    warn: 'bg-google-yellow/10 text-google-yellow border-google-yellow/20',
    bad: 'bg-google-red/10 text-google-red border-google-red/20',
  };
  const toneClass = tones[tone] || tones.info;

  return (
    <Panel className="group relative overflow-hidden">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-20 bg-primary/20" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">{label}</p>
          <p className="mt-6 truncate text-4xl font-black text-on-surface tracking-tighter">{value}</p>
          <p className="mt-3 text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.15em]">{detail}</p>
        </div>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] border transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 ${toneClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </Panel>
  );
}

function Row({ icon: Icon, title, body, meta, className = '' }) {
  return (
    <div className={`group flex gap-6 rounded-3xl border border-outline-variant/30 bg-on-surface/[0.01] p-6 transition-all duration-300 hover:border-google-blue/30 hover:bg-on-surface/[0.02] cursor-default ${className}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low text-google-blue border border-outline-variant/30 transition-all duration-300 group-hover:scale-105 group-hover:bg-google-blue group-hover:text-white group-hover:border-transparent">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-bold text-on-surface/90">{title}</p>
          {meta !== undefined && <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.2em]">{meta}</span>}
        </div>
        <p className="mt-1 text-sm text-on-surface-variant/60 leading-relaxed font-medium">{body}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-outline-variant/20 bg-on-surface/[0.005] p-12 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-outline-variant/30 bg-white text-on-surface-variant/20 shadow-sm">
        <Icon size={32} />
      </div>
      <h4 className="text-xl font-bold text-on-surface/80">{title}</h4>
      <p className="mt-4 max-w-sm text-base text-on-surface-variant/40 leading-relaxed font-medium">{body}</p>
    </div>
  );
}

function PageHeader({ page, signals, online }) {
  const meta = PAGE_META[page] || PAGE_META.overview;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between mb-4"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 text-[10px] font-black text-google-blue uppercase tracking-[0.4em] mb-4">
          <div className="h-1.5 w-1.5 rounded-full bg-google-blue animate-pulse" />
          <span>Secured Connectivity</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-5xl font-black text-on-surface tracking-tight leading-none mb-3">
              {meta.title()}
            </h1>
            <p className="text-lg text-on-surface-variant/50 font-medium">{meta.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Pill tone={online ? 'good' : 'warn'} icon={Wifi}>{online ? 'Active Connection' : 'Restoring Link'}</Pill>
        <Pill icon={Clock3}>{signals.lastSyncedAt ? `Synced at ${signals.lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Syncing...'}</Pill>
      </div>
    </motion.div>
  );
}

function Overview({ store, signals, providerLabel, providerConfig, skills, files }) {
  const navigate = useNavigate();
  const recentThoughts = store.agentThoughts.slice(-4).map((item) => item?.content || item?.message || item).filter(Boolean).reverse();

  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="grid gap-10">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Activity} label="Active Agents" value={`${store.messages.length}`} detail="Processing Cycles" tone="info" />
        <Metric icon={FileCode2} label="Knowledge Base" value={`${files.length}`} detail="Indexed Files" tone={store.vfsStatus === 'ready' ? 'good' : 'warn'} />
        <Metric icon={Cpu} label="Neural Engine" value={providerLabel.split('/')[0]} detail={providerConfig?.model || 'Starting up...'} tone="good" />
        <Metric icon={Route} label="Expertise" value={`${skills.length}`} detail="Specialist Nodes" tone="info" />
      </div>

      <div className="grid gap-10 xl:grid-cols-[1fr_400px]">
        <div className="grid gap-10">
          <Panel>
            <div className="mb-10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black text-google-blue uppercase tracking-[0.3em] mb-2">Workspace Health</p>
                <h2 className="text-2xl font-black text-on-surface leading-none">Diagnostic Insights</h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black opacity-20 uppercase tracking-widest"><Globe size={12} /> Global_Hub</div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Row icon={Activity} title="Activity Logs" body="Real-time agent reasoning packets" meta={`${store.agentThoughts.length} PKTS`} />
              <Row icon={Terminal} title="System Console" body="Stdout and diagnostic buffer" meta={`${store.terminalOutput.length} LINES`} />
              <Row icon={GitBranch} title="Current Task" body={titleCase(store.workflowState?.status || 'Waiting for input')} meta="STATUS" />
              <Row icon={ShieldCheck} title="Verified User" body={store.user?.email || 'Anonymous Access'} meta="ENCLAVE" />
            </div>
          </Panel>

          <Panel>
            <div className="mb-10 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black text-google-red uppercase tracking-[0.3em] mb-2">Agent Thought Stream</p>
                <h2 className="text-2xl font-black text-on-surface leading-none">Reasoning Engine</h2>
              </div>
              <button onClick={() => navigate('/dashboard/activity')} className="flex items-center gap-2 text-[10px] font-black text-google-blue hover:opacity-70 transition-opacity uppercase tracking-[0.2em]">View History <ChevronRight size={12} /></button>
            </div>
            {recentThoughts.length ? (
              <div className="space-y-6">
                {recentThoughts.map((thought, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group rounded-3xl bg-on-surface/[0.015] p-6 text-sm leading-relaxed text-on-surface-variant/70 border border-outline-variant/30 transition-all hover:bg-white hover:shadow-xl hover:shadow-black/[0.02] hover:border-google-blue/30"
                  >
                    <div className="flex items-start gap-6">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-google-blue/20 group-hover:bg-google-blue transition-colors" />
                      <p className="font-semibold">{thought}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Coffee} title="System Idle" body="Establish a neural handshake to begin monitoring agent thoughts." />
            )}
          </Panel>
        </div>

        <div className="grid h-fit gap-10">
          <Panel className="relative overflow-hidden">
            <p className="text-xs font-black text-google-yellow uppercase tracking-[0.3em] mb-2">Navigation</p>
            <h2 className="text-2xl font-black text-on-surface leading-none mb-10">System Shortcuts</h2>
            <div className="space-y-5">
              <button onClick={() => navigate('/dashboard/editor')} className="w-full text-left group">
                <Row icon={FileCode2} title="Workbench" body="Advanced code editor" className="border-none bg-on-surface/[0.02] rounded-[2rem]" />
              </button>
              <button onClick={() => navigate('/dashboard/runtime')} className="w-full text-left group">
                <Row icon={Gauge} title="Performance" body="Model diagnostics" className="border-none bg-on-surface/[0.02] rounded-[2rem]" />
              </button>
              <button onClick={() => navigate('/dashboard/skills')} className="w-full text-left group">
                <Row icon={Layers3} title="Expert Mesh" body="Agent specialist pool" className="border-none bg-on-surface/[0.02] rounded-[2rem]" />
              </button>
            </div>
          </Panel>
          
          <Panel className="bg-google-blue text-white overflow-hidden relative shadow-2xl shadow-google-blue/30 border-none">
             <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[60px] rounded-full -mr-24 -mt-24" />
             <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.4em] mb-4">Security Enclave</p>
             <h2 className="text-3xl font-black leading-tight mb-8">Your Data is <br />Safe & Private.</h2>
             <p className="text-base text-white/70 mb-12 leading-relaxed font-semibold">Selina uses end-to-end encryption for all agent communications and workspace metadata. Your code never leaves the enclave.</p>
             <Button variant="tonal" size="md" className="w-full bg-white text-google-blue hover:bg-white/90 border-none rounded-2xl h-14 font-black uppercase tracking-widest text-xs">Security Audit</Button>
          </Panel>
        </div>
      </div>
    </motion.div>
  );
}

export default function IntelligenceDashboard({ page = 'overview' }) {
  const store = useStore();
  const signals = useBackendSignals({ intervalMs: 60_000 });
  const providerStatus = signals.diagnostics?.providerStatus || {};
  const activeProvider = providerStatus.activeProvider || 'gemini';
  const activeProviderConfig = providerStatus[activeProvider] || providerStatus.gemini || {};
  const providerLabel = `${titleCase(activeProvider)}${activeProviderConfig?.model ? ` / ${activeProviderConfig.model}` : ''}`;
  const skills = flattenSkillGraph(signals.skills?.graph);
  const files = flattenFiles(store.vfsTree);
  const currentPage = PAGES[page] ? page : 'overview';
  const online = signals.health?.status === 'active';

  return (
    <div className="relative h-full overflow-y-auto bg-[#faf8f5] p-8 text-on-surface md:p-14 scrollbar-none">
      <AmbientBg />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-12">
        <PageHeader page={currentPage} signals={signals} online={online} />

        {signals.loading && !signals.lastSyncedAt && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-5 rounded-3xl bg-white border border-google-blue/20 p-8 text-sm font-black text-google-blue uppercase tracking-widest shadow-xl shadow-black/[0.03]">
            <RefreshCw size={18} className="animate-spin" />
            Synchronizing Workspace Connectivity...
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={currentPage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            {currentPage === 'overview' && <Overview store={store} signals={signals} providerLabel={providerLabel} providerConfig={activeProviderConfig} skills={skills} files={files} />}
            {currentPage === 'activity' && <div className="grid min-h-[600px]"><ActivityFeed /></div>}
            {currentPage === 'runtime' && <Runtime signals={signals} providerStatus={providerStatus} activeProvider={activeProvider} activeProviderConfig={activeProviderConfig} auditTail={signals.diagnostics?.auditTail || []} />}
            {currentPage === 'skills' && <Skills skillNodes={skills} />}
            {currentPage === 'security' && <Panel className="overflow-hidden shadow-2xl shadow-black/[0.04]" noPadding><SecurityAudit signals={signals} /></Panel>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-pages (Runtime/Skills) ────────────────────────────────────────────────

function Runtime({ signals, providerStatus, activeProvider, activeProviderConfig, auditTail }) {
  const providers = ['gemini', 'openai', 'qwen', 'anthropic'];

  return (
    <div className="grid gap-10">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Wifi} label="Link Status" value={titleCase(signals.health?.status || 'Connecting')} detail={`Protocol v${signals.health?.version || '4.1.2'}`} tone={signals.health?.status === 'active' ? 'good' : 'warn'} />
        <Metric icon={Clock3} label="Uptime" value={formatDuration(signals.health?.uptime)} detail="Active Handshake" />
        <Metric icon={Database} label="System Memory" value={formatBytes(signals.health?.memory)} detail="Buffer Load" tone="warn" />
        <Metric icon={Cpu} label="Primary Model" value={activeProvider.toUpperCase()} detail={activeProviderConfig?.model || 'Handshaking...'} tone={activeProviderConfig?.configured === false ? 'bad' : 'good'} />
      </div>

      <Panel>
        <p className="text-xs font-black text-google-blue uppercase tracking-[0.3em] mb-2">Neural Gateway</p>
        <h2 className="text-2xl font-black text-on-surface leading-none mb-10">Provider Infrastructure</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {providers.map((provider) => {
            const config = providerStatus?.[provider] || {};
            const configured = Boolean(config.configured);
            const active = provider === activeProvider;
            return (
              <div key={provider} className={`group rounded-[2.5rem] p-8 border transition-all duration-500 ${active ? 'bg-google-blue/[0.03] border-google-blue/40 shadow-lg shadow-google-blue/5' : 'bg-on-surface/[0.015] border-outline-variant/30 hover:border-google-blue/30 hover:bg-white'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-on-surface tracking-tight">{titleCase(provider)}</p>
                    <p className="mt-2 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">{config.model || 'Inactive'}</p>
                  </div>
                  <Pill tone={configured ? 'good' : 'bad'}>{configured ? 'Available' : 'Restricted'}</Pill>
                </div>
                {active && (
                  <div className="mt-8 flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-google-blue animate-pulse" />
                    <span className="text-[10px] font-black text-google-blue uppercase tracking-widest">Active System Link</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <p className="text-xs font-black text-google-red uppercase tracking-[0.3em] mb-2">Transaction History</p>
        <h2 className="text-2xl font-black text-on-surface leading-none mb-10">System Handshakes</h2>
        <div className="space-y-4">
          {auditTail.length ? auditTail.slice().reverse().map((event, index) => (
            <div key={index} className="rounded-3xl bg-on-surface/[0.01] p-6 border border-outline-variant/30 flex items-center justify-between gap-6 hover:bg-white hover:border-google-blue/30 transition-all">
              <div className="flex items-center gap-6">
                <Pill tone={event.ok === false ? 'bad' : 'good'} icon={event.ok === false ? AlertCircle : CheckCircle2}>{event.kind || 'EVENT'}</Pill>
                <p className="text-sm font-bold text-on-surface-variant">{event.provider || 'Gateway'} <span className="opacity-30 font-black ml-2">{event.model}</span></p>
              </div>
              <span className="text-[10px] font-black opacity-20 tracking-widest">{event.ts ? new Date(event.ts).toLocaleTimeString() : ''}</span>
            </div>
          )) : <EmptyState icon={Server} title="No Handshakes Recorded" body="System events will appear here once the agent begins processing requests." />}
        </div>
      </Panel>
    </div>
  );
}

function Skills({ skillNodes }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skillNodes.filter((node) => `${node.label} ${node.expertDomain} ${node.id}`.toLowerCase().includes(q));
  }, [query, skillNodes]);
  const domains = useMemo(() => {
    const map = new Map();
    skillNodes.forEach((node) => map.set(node.expertDomain, (map.get(node.expertDomain) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [skillNodes]);

  return (
    <div className="grid gap-10 xl:grid-cols-[400px_1fr]">
      <Panel>
        <p className="text-xs font-black text-google-blue uppercase tracking-[0.3em] mb-2">Agent Topology</p>
        <h2 className="text-2xl font-black text-on-surface leading-none mb-10">Skill Clusters</h2>
        <div className="space-y-5">
          {domains.map(([domain, count]) => <Row key={domain} icon={Route} title={titleCase(domain)} body="Optimized expertise lane" meta={`${count} NODES`} />)}
        </div>
      </Panel>
      <Panel>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between mb-12">
          <div>
            <p className="text-xs font-black text-google-yellow uppercase tracking-[0.3em] mb-2">Expert Registry</p>
            <h2 className="text-2xl font-black text-on-surface leading-none">Specialist Mesh</h2>
          </div>
          <div className="relative min-w-[320px]">
            <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/20" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter specialized nodes..." className="h-14 w-full rounded-[1.5rem] bg-on-surface/[0.03] border border-outline-variant/30 pl-14 pr-8 text-sm font-bold text-on-surface outline-none focus:border-google-blue/40 focus:bg-white focus:shadow-xl focus:shadow-black/[0.02] transition-all" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {visible.length ? visible.map((node) => (
            <div key={node.id} className="rounded-[2rem] bg-on-surface/[0.015] p-8 border border-outline-variant/30 group hover:border-google-blue/40 hover:bg-white hover:shadow-2xl hover:shadow-black/[0.03] transition-all duration-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-on-surface tracking-tight">{node.label}</p>
                  <p className="mt-2 text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.2em]">{titleCase(node.expertDomain)} Domain</p>
                </div>
                <Pill>{node.bridges?.length || 0} Links</Pill>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {(node.bridges || []).slice(0, 5).map((bridge) => <span key={bridge} className="rounded-xl bg-[#faf8f5] px-4 py-1.5 text-[9px] text-on-surface-variant/50 border border-outline-variant/30 font-black uppercase tracking-widest group-hover:bg-google-blue/5 group-hover:text-google-blue group-hover:border-google-blue/10 transition-colors">{bridge}</span>)}
              </div>
            </div>
          )) : <EmptyState icon={Search} title="No Experts Found" body="Try refining your search parameters to find specialized agent nodes." />}
        </div>
      </Panel>
    </div>
  );
}
