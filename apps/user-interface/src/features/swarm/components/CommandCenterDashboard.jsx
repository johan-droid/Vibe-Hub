import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useBackendSignals, flattenSkillGraph } from '../../../hooks/useBackendSignals';
import { useStore } from '../../../store/useStore';
import ActivityFeed from './ActivityFeed';
import SecurityAudit from '../../security/components/SecurityAudit';

const PAGES = {
  overview: 'Overview',
  activity: 'Activity',
  runtime: 'Runtime',
  skills: 'Skills',
  security: 'Security',
};

function titleCase(value = '') {
  return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Not reported';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Not reported';
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

function Panel({ children, className = '' }) {
  return <section className={`rounded-[28px] border border-[#e3d8c5] bg-white shadow-[0_20px_60px_-45px_rgba(27,32,26,0.45)] ${className}`}>{children}</section>;
}

function SoftButton({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-[#1f6f5b] text-white' : 'bg-white text-[#5d6259] ring-1 ring-[#e3d8c5] hover:text-[#17201b]'}`}
    >
      {children}
    </button>
  );
}

function Pill({ children, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'bg-[#f5efe3] text-[#5d6259] ring-[#e3d8c5]',
    good: 'bg-[#e7f4eb] text-[#1f6f5b] ring-[#c5e2ce]',
    warn: 'bg-[#fff2d9] text-[#946020] ring-[#ead6a9]',
    bad: 'bg-[#fee7e2] text-[#a33b2f] ring-[#efc3ba]',
    info: 'bg-[#e6eef4] text-[#315f7b] ring-[#c9d9e4]',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = 'info', action }) {
  const toneClass = {
    info: 'bg-[#e6eef4] text-[#315f7b]',
    good: 'bg-[#e7f4eb] text-[#1f6f5b]',
    warn: 'bg-[#fff2d9] text-[#946020]',
    bad: 'bg-[#fee7e2] text-[#a33b2f]',
  }[tone];

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#6c6f68]">{label}</p>
          <p className="mt-3 truncate text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">{value}</p>
          <p className="mt-2 text-sm leading-6 text-[#62675f]">{detail}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon size={20} />
        </div>
      </div>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}

function Row({ icon: Icon, title, body, meta }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-[#eadfce] bg-[#fbf7ef] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1f6f5b] ring-1 ring-[#e3d8c5]">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-semibold text-[#17201b]">{title}</p>
          {meta && <span className="text-xs font-semibold text-[#7b776d]">{meta}</span>}
        </div>
        <p className="mt-1 text-sm leading-6 text-[#62675f]">{body}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#dfd2bf] bg-[#fbf7ef] p-8 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1f6f5b] ring-1 ring-[#e3d8c5]">
        <Icon size={22} />
      </div>
      <h4 className="text-lg font-semibold text-[#17201b]">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#62675f]">{body}</p>
    </div>
  );
}

function Header({ page, signals, user, providerLabel, online }) {
  const navigate = useNavigate();
  const displayName = user?.name?.split(' ')[0] || user?.email || 'there';

  return (
    <div className="rounded-[34px] border border-[#e3d8c5] bg-[#fffaf2] p-5 shadow-[0_24px_80px_-55px_rgba(27,32,26,0.55)] md:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap gap-2">
            <Pill tone={online ? 'good' : 'warn'} icon={Wifi}>Backend {online ? 'online' : 'checking'}</Pill>
            <Pill tone="info" icon={Cpu}>{providerLabel}</Pill>
            <Pill icon={Clock3}>{signals.lastSyncedAt ? `Synced ${signals.lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}</Pill>
          </div>
          <p className="text-sm font-semibold text-[#8a6a33]">Selina workspace</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-[-0.065em] text-[#17201b] md:text-6xl">
            {page === 'overview' ? `Good to see you, ${displayName}` : PAGES[page]}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#5d6259]">
            A clear view of what is connected, what has changed, and what Selina can safely do next.
          </p>
          {signals.error && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#fee7e2] px-4 py-3 text-sm font-medium text-[#a33b2f] ring-1 ring-[#efc3ba]">
              <AlertCircle size={16} />
              {signals.error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(PAGES).map(([id, label]) => (
            <SoftButton key={id} active={page === id} onClick={() => navigate(id === 'overview' ? '/dashboard' : `/dashboard/${id}`)}>
              {label}
            </SoftButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function Overview({ store, signals, providerLabel, providerConfig, skills, files }) {
  const navigate = useNavigate();
  const recentThoughts = store.agentThoughts.slice(-3).map((item) => item?.content || item?.message || item).filter(Boolean).reverse();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={MessageSquare} label="Conversation" value={`${store.messages.length} turns`} detail={store.messages.length ? 'Chat history is active for this session.' : 'No prompt has been sent yet.'} tone="info" />
        <Metric icon={FileCode2} label="Workspace" value={`${files.length} files`} detail={store.vfsStatus === 'ready' ? 'Local file tree is ready.' : `File system is ${store.vfsStatus || 'idle'}.`} tone={store.vfsStatus === 'ready' ? 'good' : 'warn'} action={<button onClick={() => navigate('/dashboard/editor')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f6f5b]">Open workbench <ArrowRight size={14} /></button>} />
        <Metric icon={Cpu} label="Model" value={providerLabel} detail={providerConfig?.configured === false ? 'Backend key missing.' : providerConfig?.model || 'Waiting for runtime diagnostics.'} tone={providerConfig?.configured === false ? 'bad' : 'good'} />
        <Metric icon={Route} label="Skill routes" value={`${skills.length} skills`} detail={skills.length ? 'Backend skill graph is available.' : 'Skill graph is not loaded yet.'} tone={skills.length ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <Panel className="p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#8a6a33]">Current work</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">What Selina has to work with</h2>
            </div>
            <Pill tone={signals.loading ? 'warn' : 'good'}>{signals.loading ? 'Refreshing' : 'Ready'}</Pill>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Row icon={Activity} title="Activity stream" body={store.agentThoughts.length ? 'Agent events are being recorded.' : 'No agent events yet.'} meta={`${store.agentThoughts.length} events`} />
            <Row icon={TerminalSquare} title="Terminal evidence" body={store.terminalOutput.length ? 'Runtime output is available.' : 'No terminal output captured yet.'} meta={`${store.terminalOutput.length} lines`} />
            <Row icon={GitBranch} title="Workflow" body={store.workflowState?.url || 'No GitHub workflow event has arrived.'} meta={titleCase(store.workflowState?.status || 'standby')} />
            <Row icon={ShieldCheck} title="Session" body={store.user?.email || 'OAuth session is restored locally.'} meta={store.user?.provider ? titleCase(store.user.provider) : 'Protected'} />
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <p className="text-sm font-semibold text-[#8a6a33]">Start here</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Useful next steps</h2>
          <div className="mt-5 space-y-3">
            <button onClick={() => navigate('/dashboard/editor')} className="w-full text-left"><Row icon={FileCode2} title="Open the workbench" body="Use files, terminal, and chat together." /></button>
            <button onClick={() => navigate('/dashboard/runtime')} className="w-full text-left"><Row icon={Gauge} title="Check runtime" body="Review provider keys, uptime, memory, and audit events." /></button>
            <button onClick={() => navigate('/dashboard/skills')} className="w-full text-left"><Row icon={Layers3} title="Inspect skills" body="See the real backend routing graph." /></button>
          </div>
        </Panel>
      </div>

      <Panel className="p-5 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#8a6a33]">Recent movement</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Latest activity</h2>
          </div>
          <button onClick={() => navigate('/dashboard/activity')} className="text-sm font-semibold text-[#1f6f5b]">View feed</button>
        </div>
        {recentThoughts.length ? (
          <div className="space-y-3">
            {recentThoughts.map((thought, index) => <div key={`${thought}-${index}`} className="rounded-2xl bg-[#fbf7ef] p-4 text-sm leading-6 text-[#5d6259] ring-1 ring-[#eadfce]">{thought}</div>)}
          </div>
        ) : (
          <EmptyState icon={Bot} title="No activity yet" body="Ask Selina to inspect the repository or explain a file. Real agent events will appear here." />
        )}
      </Panel>
    </div>
  );
}

function ActivityPage({ store }) {
  return (
    <div className="grid min-h-[620px] gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <Panel className="overflow-hidden"><ActivityFeed /></Panel>
      <Panel className="p-5 md:p-6">
        <p className="text-sm font-semibold text-[#8a6a33]">Session detail</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">What the feed reads</h2>
        <div className="mt-5 space-y-3">
          <Row icon={MessageSquare} title="Messages" body="User and assistant turns stored in local session state." meta={store.messages.length} />
          <Row icon={Activity} title="Agent events" body="Thoughts, tool calls, plans, and status changes." meta={store.agentThoughts.length} />
          <Row icon={TerminalSquare} title="Terminal" body="Shell output captured while Selina works." meta={store.terminalOutput.length} />
        </div>
      </Panel>
    </div>
  );
}

function Runtime({ signals, providerStatus, activeProvider, activeProviderConfig, auditTail }) {
  const providers = ['gemini', 'openai', 'qwen', 'anthropic'];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Wifi} label="Backend" value={titleCase(signals.health?.status || 'Unknown')} detail={`Version ${signals.health?.version || 'not reported'}`} tone={signals.health?.status === 'active' ? 'good' : 'warn'} />
        <Metric icon={Clock3} label="Uptime" value={formatDuration(signals.health?.uptime)} detail="Reported by /health." />
        <Metric icon={Database} label="Memory" value={formatBytes(signals.health?.memory)} detail="Bridge heap usage." tone="warn" />
        <Metric icon={Cpu} label="Active provider" value={activeProvider.toUpperCase()} detail={activeProviderConfig?.model || 'Model not reported'} tone={activeProviderConfig?.configured === false ? 'bad' : 'good'} />
      </div>

      <Panel className="p-5 md:p-6">
        <p className="text-sm font-semibold text-[#8a6a33]">Provider gateway</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Model adapters</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {providers.map((provider) => {
            const config = providerStatus?.[provider] || {};
            const configured = Boolean(config.configured);
            const active = provider === activeProvider;
            return (
              <div key={provider} className={`rounded-2xl p-4 ring-1 ${active ? 'bg-[#e7f4eb] ring-[#bcdcc8]' : 'bg-[#fbf7ef] ring-[#eadfce]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#17201b]">{titleCase(provider)}</p>
                    <p className="mt-1 text-sm text-[#62675f]">{config.model || 'No model selected'}</p>
                  </div>
                  <Pill tone={configured ? 'good' : 'bad'}>{configured ? 'Configured' : 'Missing key'}</Pill>
                </div>
                {config.baseUrl && <p className="mt-3 truncate text-xs text-[#7b776d]">{config.baseUrl}</p>}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <p className="text-sm font-semibold text-[#8a6a33]">Audit trail</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Recent model events</h2>
        <div className="mt-5">
          {auditTail.length ? (
            <div className="space-y-3">
              {auditTail.slice().reverse().map((event, index) => (
                <div key={`${event.ts}-${index}`} className="rounded-2xl bg-[#fbf7ef] p-4 ring-1 ring-[#eadfce]">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Pill tone={event.ok === false ? 'bad' : 'good'} icon={event.ok === false ? AlertCircle : CheckCircle2}>{event.kind || 'event'}</Pill>
                    <span className="text-xs text-[#7b776d]">{event.ts ? new Date(event.ts).toLocaleString() : 'No timestamp'}</span>
                  </div>
                  <p className="text-sm leading-6 text-[#62675f]">Provider {event.provider || 'unknown'} {event.model ? `using ${event.model}` : ''}{Number.isFinite(event.durationMs) ? ` finished in ${event.durationMs}ms` : ''}.</p>
                  {event.error && <p className="mt-2 text-sm text-[#a33b2f]">{event.error}</p>}
                </div>
              ))}
            </div>
          ) : <EmptyState icon={Server} title="No model events yet" body="Once Selina calls a provider, redacted diagnostics will appear here." />}
        </div>
      </Panel>
    </div>
  );
}

function Skills({ skillNodes }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skillNodes;
    return skillNodes.filter((node) => `${node.label} ${node.expertDomain} ${node.id}`.toLowerCase().includes(q));
  }, [query, skillNodes]);
  const domains = useMemo(() => {
    const map = new Map();
    skillNodes.forEach((node) => map.set(node.expertDomain, (map.get(node.expertDomain) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [skillNodes]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
      <Panel className="p-5 md:p-6">
        <p className="text-sm font-semibold text-[#8a6a33]">Routing map</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Skill coverage</h2>
        <div className="mt-5 space-y-3">
          {domains.map(([domain, count]) => <Row key={domain} icon={Route} title={titleCase(domain)} body="Available backend specialist lane." meta={`${count} skills`} />)}
        </div>
      </Panel>
      <Panel className="p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#8a6a33]">Backend graph</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17201b]">Specialist routes</h2>
          </div>
          <div className="relative min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a867c]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" className="h-11 w-full rounded-full bg-[#fbf7ef] pl-10 pr-4 text-sm text-[#17201b] outline-none ring-1 ring-[#e3d8c5] focus:ring-2 focus:ring-[#1f6f5b]" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {visible.length ? visible.map((node) => (
            <div key={node.id} className="rounded-2xl bg-[#fbf7ef] p-4 ring-1 ring-[#eadfce]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#17201b]">{node.label}</p>
                  <p className="mt-1 text-sm text-[#62675f]">{titleCase(node.expertDomain)} lane</p>
                </div>
                <Pill>{node.bridges?.length || 0} bridges</Pill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(node.bridges || []).slice(0, 4).map((bridge) => <span key={bridge} className="rounded-full bg-white px-2.5 py-1 text-xs text-[#62675f] ring-1 ring-[#e3d8c5]">{titleCase(bridge)}</span>)}
              </div>
            </div>
          )) : <EmptyState icon={Search} title="No matching skill" body="Try frontend, backend, security, data, DevOps, or testing." />}
        </div>
      </Panel>
    </div>
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
  const auditTail = Array.isArray(signals.diagnostics?.auditTail) ? signals.diagnostics.auditTail : [];
  const files = flattenFiles(store.vfsTree);
  const currentPage = PAGES[page] ? page : 'overview';
  const online = signals.health?.status === 'active';

  return (
    <div className="h-full overflow-y-auto bg-[#f6f0e6] p-4 text-[#17201b] md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <Header page={currentPage} signals={signals} user={store.user} providerLabel={providerLabel} online={online} />

        {signals.loading && !signals.lastSyncedAt && (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#62675f] ring-1 ring-[#e3d8c5]">
            <RefreshCw size={16} className="animate-spin text-[#1f6f5b]" />
            Loading live backend signals...
          </div>
        )}

        {currentPage === 'overview' && <Overview store={store} signals={signals} providerLabel={providerLabel} providerConfig={activeProviderConfig} skills={skills} files={files} />}
        {currentPage === 'activity' && <ActivityPage store={store} />}
        {currentPage === 'runtime' && <Runtime signals={signals} providerStatus={providerStatus} activeProvider={activeProvider} activeProviderConfig={activeProviderConfig} auditTail={auditTail} />}
        {currentPage === 'skills' && <Skills skillNodes={skills} />}
        {currentPage === 'security' && <Panel className="overflow-hidden"><SecurityAudit signals={signals} /></Panel>}
      </div>
    </div>
  );
}
