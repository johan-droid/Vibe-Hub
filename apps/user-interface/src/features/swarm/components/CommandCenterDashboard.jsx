import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Gauge,
  KeyRound,
  Layers3,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  Network,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  TerminalSquare,
  UserCircle,
  Wifi,
  Wrench,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useBackendSignals, flattenSkillGraph } from '../../../hooks/useBackendSignals';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';
import ActivityFeed from './ActivityFeed';
import SecurityAudit from '../../security/components/SecurityAudit';

const DASHBOARD_PAGES = {
  overview: 'Overview',
  activity: 'Activity',
  runtime: 'Runtime',
  skills: 'Skills',
  security: 'Security',
};

function titleCase(value = '') {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Not reported';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
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

function relativeSync(date) {
  if (!date) return 'Not synced yet';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getThoughtText(thought) {
  if (typeof thought === 'string') return thought;
  return thought?.content || thought?.message || '';
}

function flattenTree(nodes = []) {
  const files = [];
  const visit = (node) => {
    if (!node) return;
    if (node.isDir || node.type === 'directory') {
      (node.children || []).forEach(visit);
    } else {
      files.push(node);
    }
  };
  nodes.forEach(visit);
  return files;
}

function ShellButton({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-on-surface text-surface-container-lowest shadow-lg shadow-black/20'
          : 'border border-outline-variant/40 bg-surface-container-low/70 text-on-surface-variant hover:border-outline hover:text-on-surface'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ children, tone = 'neutral', icon: Icon }) {
  const toneClass = {
    neutral: 'border-outline-variant/35 bg-surface-container-low text-on-surface-variant',
    good: 'border-tertiary/25 bg-tertiary/10 text-tertiary',
    warn: 'border-secondary/25 bg-secondary/10 text-secondary',
    bad: 'border-error/30 bg-error/10 text-error',
    info: 'border-primary/25 bg-primary/10 text-primary',
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass}`}>
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

function DataCard({ icon: Icon, label, value, detail, tone = 'info', action }) {
  const iconClass = {
    info: 'bg-primary/10 text-primary border-primary/20',
    good: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    warn: 'bg-secondary/10 text-secondary border-secondary/20',
    bad: 'bg-error/10 text-error border-error/25',
  }[tone];

  return (
    <Surface elevation={0} shape="2xl" className="border border-outline-variant/25 bg-surface-container-low/80 p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
          <p className="mt-3 truncate font-display text-2xl font-semibold tracking-[-0.04em] text-on-surface">{value}</p>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{detail}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${iconClass}`}>
          <Icon size={20} />
        </div>
      </div>
      {action && <div className="mt-5">{action}</div>}
    </Surface>
  );
}

function SectionCard({ eyebrow, title, children, action, className = '' }) {
  return (
    <Surface elevation={0} shape="2xl" className={`border border-outline-variant/25 bg-surface-container-low/80 p-5 shadow-xl shadow-black/10 ${className}`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && <p className="mb-2 text-xs font-semibold text-primary">{eyebrow}</p>}
          <h3 className="font-display text-2xl font-semibold tracking-[-0.04em] text-on-surface">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </Surface>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant/35 bg-surface-container-lowest/45 p-8 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container text-primary">
        <Icon size={22} />
      </div>
      <h4 className="title-medium">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function DashboardNav({ page }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(DASHBOARD_PAGES).map(([id, label]) => (
        <ShellButton key={id} active={page === id} onClick={() => navigate(id === 'overview' ? '/dashboard' : `/dashboard/${id}`)}>
          {label}
        </ShellButton>
      ))}
    </div>
  );
}

function Header({ page, signals, user, providerLabel, isBackendOnline }) {
  return (
    <Surface elevation={0} shape="2xl" className="overflow-hidden border border-outline-variant/25 bg-surface-container-low/85 p-5 shadow-2xl shadow-black/15 md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusPill tone={isBackendOnline ? 'good' : 'warn'} icon={Wifi}>
              Backend {isBackendOnline ? 'online' : 'checking'}
            </StatusPill>
            <StatusPill tone="info" icon={Cpu}>{providerLabel}</StatusPill>
            <StatusPill tone="neutral" icon={Clock3}>Synced {relativeSync(signals.lastSyncedAt)}</StatusPill>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.06em] text-on-surface md:text-5xl">
            {page === 'overview' ? `Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}` : DASHBOARD_PAGES[page]}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant">
            Selina now shows what is actually connected: your session, local workspace, backend runtime, model gateway, and skill graph. No theatre, just the signals you need before asking the agent to work.
          </p>
          {signals.error && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-error-container">
              <AlertCircle size={16} />
              {signals.error}
            </div>
          )}
        </div>
        <DashboardNav page={page} />
      </div>
    </Surface>
  );
}

function OverviewPage({ signals, store, providerLabel, providerConfig, skillNodes, fileCount, isBackendOnline }) {
  const navigate = useNavigate();
  const latestThoughts = store.agentThoughts.slice(-3).map(getThoughtText).filter(Boolean).reverse();

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DataCard
          icon={UserCircle}
          label="Signed in as"
          value={store.user?.name || 'Authenticated user'}
          detail={store.user?.email || 'OAuth session restored from the backend.'}
          tone="good"
        />
        <DataCard
          icon={FileCode2}
          label="Workspace"
          value={`${fileCount} files`}
          detail={store.vfsStatus === 'ready' ? 'Local file tree is available in the explorer.' : `VFS is ${store.vfsStatus || 'idle'}. Open the workbench to boot it.`}
          tone={store.vfsStatus === 'ready' ? 'good' : 'warn'}
          action={<button onClick={() => navigate('/dashboard/editor')} className="text-sm font-semibold text-primary hover:text-on-surface">Open workbench</button>}
        />
        <DataCard
          icon={Cpu}
          label="Model gateway"
          value={providerLabel}
          detail={providerConfig?.configured === false ? 'Provider key is missing in the backend environment.' : providerConfig?.model || 'Waiting for diagnostics.'}
          tone={providerConfig?.configured === false ? 'bad' : 'info'}
          action={<button onClick={() => navigate('/dashboard/runtime')} className="text-sm font-semibold text-primary hover:text-on-surface">View runtime</button>}
        />
        <DataCard
          icon={Route}
          label="Skill graph"
          value={`${skillNodes.length} skills`}
          detail={skillNodes.length ? 'Backend routing topology is loaded.' : 'Skill graph has not been returned yet.'}
          tone={skillNodes.length ? 'good' : 'warn'}
          action={<button onClick={() => navigate('/dashboard/skills')} className="text-sm font-semibold text-primary hover:text-on-surface">Inspect skills</button>}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <SectionCard eyebrow="Current work" title="What Selina knows right now">
          <div className="grid gap-3 md:grid-cols-2">
            <SignalRow icon={MessageSquare} label="Conversation" value={`${store.messages.length} messages`} detail={store.messages.length ? 'The chat history is available to the session.' : 'No prompt has been sent in this session yet.'} />
            <SignalRow icon={Activity} label="Agent stream" value={`${store.agentThoughts.length} events`} detail={store.agentThoughts.length ? 'Recent agent activity is visible in the activity page.' : 'The agent has not emitted activity yet.'} />
            <SignalRow icon={TerminalSquare} label="Terminal" value={`${store.terminalOutput.length} lines`} detail={store.terminalOutput.length ? 'Runtime output is available for debugging.' : 'No terminal output has been captured yet.'} />
            <SignalRow icon={GitBranch} label="Workflow" value={titleCase(store.workflowState?.status || 'Standby')} detail={store.workflowState?.url || 'No GitHub workflow event has arrived.'} />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Start here"
          title="Useful next actions"
          action={<StatusPill tone={isBackendOnline ? 'good' : 'warn'}>{signals.loading ? 'Refreshing' : 'Ready'}</StatusPill>}
        >
          <div className="space-y-3">
            <ActionItem icon={FileCode2} title="Open the workbench" body="Use the explorer, editor, terminal, and Selina chat together." onClick={() => navigate('/dashboard/editor')} />
            <ActionItem icon={Gauge} title="Check runtime health" body="Confirm model keys, memory, uptime, and recent provider events." onClick={() => navigate('/dashboard/runtime')} />
            <ActionItem icon={Layers3} title="Review skill routing" body="See which computer-science skills the backend exposes to the agent." onClick={() => navigate('/dashboard/skills')} />
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Recent activity" title="Latest session movement" action={<button onClick={() => navigate('/dashboard/activity')} className="text-sm font-semibold text-primary hover:text-on-surface">Open activity</button>}>
        {latestThoughts.length ? (
          <div className="space-y-3">
            {latestThoughts.map((thought, index) => (
              <div key={`${thought}-${index}`} className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/50 p-4 text-sm leading-6 text-on-surface-variant">
                {thought}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Bot} title="No agent activity yet" body="Ask Selina to inspect the repository, explain a file, or run a small change. This panel will fill from the live websocket stream." />
        )}
      </SectionCard>
    </div>
  );
}

function SignalRow({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={17} />
        </div>
        <div>
          <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
          <p className="title-small">{value}</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-on-surface-variant">{detail}</p>
    </div>
  );
}

function ActionItem({ icon: Icon, title, body, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full gap-4 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 p-4 text-left transition hover:border-primary/35 hover:bg-surface-container"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15">
        <Icon size={18} />
      </div>
      <div>
        <p className="title-small">{title}</p>
        <p className="mt-1 text-sm leading-6 text-on-surface-variant">{body}</p>
      </div>
    </button>
  );
}

function ActivityPage({ store }) {
  return (
    <div className="grid min-h-[620px] gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <Surface elevation={0} shape="2xl" className="overflow-hidden border border-outline-variant/25 bg-surface-container-low/80 shadow-xl shadow-black/10">
        <ActivityFeed />
      </Surface>

      <SectionCard eyebrow="Session detail" title="What the feed is reading">
        <div className="space-y-3">
          <SignalRow icon={MessageSquare} label="Messages" value={store.messages.length} detail="User and assistant turns stored in the local session." />
          <SignalRow icon={Activity} label="Agent thoughts" value={store.agentThoughts.length} detail="Planning, tool calls, and status updates received through the websocket." />
          <SignalRow icon={TerminalSquare} label="Terminal lines" value={store.terminalOutput.length} detail="Shell output captured while Selina works." />
        </div>
      </SectionCard>
    </div>
  );
}

function RuntimePage({ signals, providerStatus, activeProvider, activeProviderConfig, auditTail }) {
  const providers = ['gemini', 'openai', 'qwen', 'anthropic'];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DataCard icon={Wifi} label="Backend status" value={titleCase(signals.health?.status || 'Unknown')} detail={`Version ${signals.health?.version || 'not reported'}`} tone={signals.health?.status === 'active' ? 'good' : 'warn'} />
        <DataCard icon={Clock3} label="Uptime" value={formatDuration(signals.health?.uptime)} detail="Reported by the Express bridge health endpoint." tone="info" />
        <DataCard icon={Database} label="Memory" value={formatBytes(signals.health?.memory)} detail="Heap usage reported by the bridge process." tone="warn" />
        <DataCard icon={Cpu} label="Active provider" value={activeProvider.toUpperCase()} detail={activeProviderConfig?.model || 'Model not reported'} tone={activeProviderConfig?.configured === false ? 'bad' : 'good'} />
      </div>

      <SectionCard eyebrow="Provider gateway" title="Configured model adapters">
        <div className="grid gap-3 md:grid-cols-2">
          {providers.map((provider) => {
            const config = providerStatus?.[provider] || {};
            const isActive = provider === activeProvider;
            const configured = Boolean(config.configured);
            return (
              <div key={provider} className={`rounded-2xl border p-4 ${isActive ? 'border-primary/35 bg-primary/10' : 'border-outline-variant/25 bg-surface-container-lowest/45'}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-primary">
                      <Cpu size={17} />
                    </div>
                    <div>
                      <p className="title-small">{titleCase(provider)}</p>
                      <p className="text-xs text-on-surface-variant">{config.model || 'No model selected'}</p>
                    </div>
                  </div>
                  <StatusPill tone={configured ? 'good' : 'bad'}>{configured ? 'Configured' : 'Missing key'}</StatusPill>
                </div>
                {config.baseUrl && <p className="truncate text-xs text-on-surface-variant">{config.baseUrl}</p>}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Audit trail" title="Recent provider events">
        {auditTail.length ? (
          <div className="space-y-3">
            {auditTail.slice().reverse().map((event, index) => (
              <div key={`${event.ts}-${index}`} className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusPill tone={event.ok === false ? 'bad' : 'good'} icon={event.ok === false ? AlertCircle : CheckCircle2}>{event.kind || 'event'}</StatusPill>
                  <span className="text-xs text-on-surface-variant">{event.ts ? new Date(event.ts).toLocaleString() : 'No timestamp'}</span>
                </div>
                <p className="text-sm leading-6 text-on-surface-variant">
                  Provider {event.provider || 'unknown'} {event.model ? `using ${event.model}` : ''}{Number.isFinite(event.durationMs) ? ` finished in ${event.durationMs}ms` : ''}.
                </p>
                {event.error && <p className="mt-2 text-sm text-error">{event.error}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={ListChecks} title="No provider events yet" body="Once Selina calls a model, timeout/retry/token estimates and redacted provider diagnostics will appear here." />
        )}
      </SectionCard>
    </div>
  );
}

function SkillsPage({ skillNodes }) {
  const [query, setQuery] = useState('');
  const visibleNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skillNodes;
    return skillNodes.filter((node) => `${node.label} ${node.expertDomain} ${node.id}`.toLowerCase().includes(q));
  }, [query, skillNodes]);

  const domains = useMemo(() => {
    const counts = new Map();
    skillNodes.forEach((node) => counts.set(node.expertDomain, (counts.get(node.expertDomain) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [skillNodes]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
      <SectionCard eyebrow="Routing map" title="Skill coverage">
        <div className="space-y-3">
          {domains.map(([domain, count]) => (
            <div key={domain} className="flex items-center justify-between rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Route size={17} />
                </div>
                <span className="title-small">{titleCase(domain)}</span>
              </div>
              <StatusPill tone="info">{count} skills</StatusPill>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Backend skill graph"
        title="Available specialist routes"
        action={
          <div className="relative min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills"
              className="h-10 w-full rounded-full border border-outline-variant/35 bg-surface-container-lowest pl-9 pr-4 text-sm text-on-surface outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        }
      >
        {visibleNodes.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleNodes.map((node) => (
              <div key={node.id} className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest/45 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="title-small">{node.label}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{titleCase(node.expertDomain)} lane</p>
                  </div>
                  <StatusPill tone="neutral">{node.bridges?.length || 0} bridges</StatusPill>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(node.bridges || []).slice(0, 4).map((bridge) => (
                    <span key={bridge} className="rounded-full border border-outline-variant/25 bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant">
                      {titleCase(bridge)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Search} title="No matching skill" body="Try searching for frontend, backend, security, database, DevOps, testing, or AI." />
        )}
      </SectionCard>
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
  const skillNodes = flattenSkillGraph(signals.skills?.graph);
  const auditTail = Array.isArray(signals.diagnostics?.auditTail) ? signals.diagnostics.auditTail : [];
  const files = flattenTree(store.vfsTree);
  const currentPage = DASHBOARD_PAGES[page] ? page : 'overview';
  const isBackendOnline = signals.health?.status === 'active';

  return (
    <div className="h-full overflow-y-auto bg-surface-container-lowest p-4 text-on-surface md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto flex max-w-7xl flex-col gap-5"
      >
        <Header page={currentPage} signals={signals} user={store.user} providerLabel={providerLabel} isBackendOnline={isBackendOnline} />

        {signals.loading && !signals.lastSyncedAt && (
          <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-low/80 px-4 py-3 text-sm text-on-surface-variant">
            <RefreshCw size={16} className="animate-spin text-primary" />
            Loading live backend signals...
          </div>
        )}

        {currentPage === 'overview' && (
          <OverviewPage
            signals={signals}
            store={store}
            providerLabel={providerLabel}
            providerConfig={activeProviderConfig}
            skillNodes={skillNodes}
            fileCount={files.length}
            isBackendOnline={isBackendOnline}
          />
        )}
        {currentPage === 'activity' && <ActivityPage store={store} />}
        {currentPage === 'runtime' && <RuntimePage signals={signals} providerStatus={providerStatus} activeProvider={activeProvider} activeProviderConfig={activeProviderConfig} auditTail={auditTail} />}
        {currentPage === 'skills' && <SkillsPage skillNodes={skillNodes} />}
        {currentPage === 'security' && (
          <Surface elevation={0} shape="2xl" className="min-h-[620px] overflow-hidden border border-outline-variant/25 bg-surface-container-low/80 shadow-xl shadow-black/10">
            <SecurityAudit signals={signals} />
          </Surface>
        )}
      </motion.div>
    </div>
  );
}
