import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CloudCog,
  Code2,
  FileCode2,
  Github,
  Globe,
  LayoutDashboard,
  Lock,
  Mail,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Waypoints,
} from 'lucide-react';
import { Button } from '../features/shared/components/Button';
import { VibeLogoCompact } from '../components/VibeLogo';
import { SELINA_BRAND } from '../brand/selina';
import { flattenSkillGraph, useBackendSignals } from '../hooks/useBackendSignals';
import { useStore } from '../store/useStore';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const principles = [
  {
    icon: Waypoints,
    title: 'Deterministic orchestration',
    description:
      'Selina routes prompts through explicit orchestration layers instead of relying on invisible, one-shot agent behavior.',
    accent: 'text-google-blue',
  },
  {
    icon: FileCode2,
    title: 'Approval-gated VFS',
    description:
      'Generated edits stage inside the guarded virtual file system so operators can review diffs before disk writes happen.',
    accent: 'text-primary',
  },
  {
    icon: ShieldCheck,
    title: 'Local Docker sandbox',
    description:
      'Execution stays inside the local Docker boundary with isolated runtime conditions and explicit approval for risky steps.',
    accent: 'text-google-green',
  },
  {
    icon: CloudCog,
    title: 'MCP-connected tooling',
    description:
      'MCP, GitHub, browser, terminal, and memory surfaces are exposed through one governed workspace instead of scattered plugins.',
    accent: 'text-google-yellow',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Prompt enters the workspace',
    description: 'A request starts as an authenticated run with visible state, not an opaque side channel.',
  },
  {
    step: '02',
    title: 'Selina routes and drafts',
    description: 'The orchestrator selects the right path for code, debugging, review, or multi-step execution.',
  },
  {
    step: '03',
    title: 'Sandbox verifies behavior',
    description: 'Builds, scripts, and generated code execute inside the local Docker execution boundary.',
  },
  {
    step: '04',
    title: 'Diff lands in staged VFS',
    description: 'Edits are staged as reviewable changes instead of writing straight to the host file system.',
  },
  {
    step: '05',
    title: 'Operator approves or rejects',
    description: 'Risky actions pause for human review, preserving control over file, tool, and execution boundaries.',
  },
];

const footerColumns = [
  {
    title: 'Platform',
    links: [
      { label: 'Architecture', href: '#architecture', detail: 'How orchestration, sandboxing, and review fit together.' },
      { label: 'Security', href: '#security', detail: 'Approval gates, local execution, and secret handling posture.' },
      { label: 'Live status', href: '#platform-status', detail: 'Backend readiness, diagnostics, and runtime signals.' },
      { label: 'Workspace flow', href: '#how-it-works', detail: 'Prompt to approval in one visible loop.' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'GitHub repository', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Source, issues, and contribution flow.' },
      { label: 'Docs', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Architecture, setup, and release notes.' },
      { label: 'API reference', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Runtime, MCP, approvals, and run inspection APIs.' },
      { label: 'Product overview', href: '#capabilities', detail: 'Core platform principles and operator controls.' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Selina', href: '#platform', detail: 'Agentic software workspace for serious coding sessions.' },
      { label: 'Contact', href: 'https://github.com/johan-droid/Vibe-Hub/issues/new', detail: 'Open a repository issue for product questions.' },
      { label: 'Security contact', href: 'https://github.com/johan-droid/Vibe-Hub/security', detail: 'Use the repository security channel for disclosure.' },
      { label: 'Dashboard', href: '/dashboard', detail: 'Jump straight into the authenticated workspace.' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of service', href: '/agreement', detail: 'Usage, generated code, and operator responsibilities.' },
      { label: 'Privacy notice', href: '/agreement', detail: 'Cookie auth, session metadata, and stored preferences.' },
      { label: 'Security policy', href: '/agreement', detail: 'Approval gates, local execution, and audit posture.' },
      { label: 'Cookie policy', href: '/agreement', detail: 'HttpOnly cookies and browser-visible CSRF tokens.' },
    ],
  },
];

const footerCommitments = [
  {
    icon: Terminal,
    title: 'Local execution only',
    text: 'Generated code stays on the local Docker execution boundary instead of being sent to a hosted runner.',
  },
  {
    icon: ShieldCheck,
    title: 'Approval before mutation',
    text: 'Writes, browser actions, GitHub mutations, execution, and risky tool calls stop for review.',
  },
  {
    icon: Lock,
    title: 'Zero-key browser model',
    text: 'Provider credentials stay server-side while the UI authenticates through secure cookie sessions.',
  },
  {
    icon: Activity,
    title: 'Run artifacts preserved',
    text: 'Plans, tool calls, staged edits, and operational traces stay visible for inspection and follow-up.',
  },
];

function BrandMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant/40 bg-surface-container-low">
      <VibeLogoCompact size={34} />
    </div>
  );
}

function signalFromHealth(health) {
  if (!health) return { label: 'Waiting for backend', tone: 'text-on-surface-variant', dot: 'bg-google-yellow' };
  if (health.ready === true || health.status === 'active') {
    return { label: 'Backend ready', tone: 'text-google-green', dot: 'bg-google-green' };
  }
  if (health.ready === false || health.status === 'error') {
    return { label: 'Backend degraded', tone: 'text-google-red', dot: 'bg-google-red' };
  }
  return { label: 'Backend reachable', tone: 'text-google-blue', dot: 'bg-google-blue' };
}

function diagnosticsSummary(diagnostics) {
  if (!diagnostics) return 'Awaiting runtime diagnostics';
  if (diagnostics.mode) return String(diagnostics.mode).replaceAll('_', ' ');
  if (diagnostics.provider) return `${diagnostics.provider} provider online`;
  if (diagnostics.ready === true) return 'runtime ready';
  return 'diagnostics available';
}

function skillsSummary(skills) {
  const entries = flattenSkillGraph(skills?.graph || skills?.skills || skills);
  const visible = entries
    .map((entry) => entry?.name || entry?.domain || entry?.title || entry?.label)
    .filter(Boolean)
    .slice(0, 4);

  return {
    count: entries.length,
    labels: visible.length ? visible : ['code', 'debug', 'ui', 'security'],
  };
}

function LandingNav({ authenticated, onPrimaryCta }) {
  const navItems = [
    { label: 'Platform', href: '#platform' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Security', href: '#security' },
    { label: 'Status', href: '#platform-status' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant/30 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="text-lg font-black tracking-tight text-on-surface">Vibe Hub</div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant">
                {SELINA_BRAND.agentName}
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[11px] font-black uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <Button
          variant="filled"
          size="md"
          trailingIcon={authenticated ? LayoutDashboard : Play}
          onClick={onPrimaryCta}
          className="rounded-full px-5 shadow-lg shadow-google-blue/20"
        >
          {authenticated ? 'Open Workspace' : 'Start Workspace'}
        </Button>
      </div>
    </header>
  );
}

function HeroTerminalPreview({ onPrimaryCta, onSecondaryCta, authenticated, statusPill, diagnosticsText, skillInfo }) {
  return (
    <section id="platform" className="relative overflow-hidden px-6 pb-24 pt-16 md:px-10 md:pb-32 md:pt-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent" />

      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div initial="hidden" animate="show" variants={staggerContainer} className="relative z-10">
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low px-4 py-2"
          >
            <span className={`h-2 w-2 rounded-full ${statusPill.dot}`} />
            <span className={`text-[11px] font-black uppercase tracking-[0.16em] ${statusPill.tone}`}>
              {statusPill.label}
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="display-medium mb-6 max-w-3xl">
            Secure AI coding
            <br />
            <span className="text-on-surface-variant">without surrendering control.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mb-8 max-w-2xl text-lg font-medium leading-relaxed text-on-surface-variant">
            {SELINA_BRAND.productName} gives teams a sharper execution environment for agentic work: deterministic orchestration,
            approval-gated diffs, local Docker sandboxing, and auditable run diagnostics in one workspace.
          </motion.p>

          <motion.div variants={fadeUp} className="mb-8 flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              variant="filled"
              trailingIcon={authenticated ? LayoutDashboard : ArrowRight}
              onClick={onPrimaryCta}
              className="h-14 rounded-full px-8 shadow-xl shadow-google-blue/20"
            >
              {authenticated ? 'Open Workspace' : 'Start Workspace'}
            </Button>
            <Button
              size="lg"
              variant="outlined"
              leadingIcon={ChevronRight}
              onClick={onSecondaryCta}
              className="h-14 rounded-full px-8"
            >
              View Architecture
            </Button>
          </motion.div>

          <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Runtime', value: diagnosticsText },
              { label: 'Execution', value: 'local Docker boundary' },
              { label: 'Mutation model', value: 'approval before write' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/70">{item.label}</div>
                <div className="mt-2 text-sm font-black text-on-surface">{item.value}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <div className="panel overflow-hidden rounded-[2rem] border border-outline-variant/50 bg-surface-container-lowest shadow-3xl">
            <div className="flex items-center gap-2 border-b border-outline-variant/30 bg-surface px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-google-red" />
              <span className="h-3 w-3 rounded-full bg-google-yellow" />
              <span className="h-3 w-3 rounded-full bg-google-green" />
              <div className="ml-3 text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                selina-execution-env / secure session
              </div>
            </div>

            <div className="relative overflow-hidden px-5 py-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/10 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 top-[-20%] h-28 bg-gradient-to-b from-transparent via-primary/10 to-transparent opacity-70 blur-md" />

              <div className="relative space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-on-surface-variant/75">
                      Live workspace signals
                    </div>
                    <div className="mt-1 text-sm font-medium text-on-surface-variant">
                      This panel reflects backend reachability and current runtime configuration instead of seeded sample output.
                    </div>
                  </div>
                  <Button variant="tonal" size="sm" className="rounded-full px-4" onClick={onPrimaryCta}>
                    {authenticated ? 'Open Dashboard' : 'Sign In'}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Backend', value: statusPill.label },
                    { label: 'Runtime', value: diagnosticsText },
                    { label: 'Capabilities', value: `${skillInfo.count || 0} routed skills` },
                    { label: 'Access', value: authenticated ? 'authenticated session available' : 'sign-in required' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-outline-variant/40 bg-surface px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/70">{item.label}</div>
                      <div className="mt-2 text-sm font-black text-on-surface">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-outline-variant/40 bg-surface px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant/70">Top skill routes</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skillInfo.labels.map((label) => (
                      <span key={label} className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TrustStrip({ skillInfo }) {
  const items = [
    { icon: ShieldCheck, label: 'Approval-gated writes' },
    { icon: Terminal, label: 'Local Docker sandbox' },
    { icon: Bot, label: `${skillInfo.count || 0} routed capabilities` },
    { icon: Globe, label: 'MCP-aware workspace' },
  ];

  return (
    <section className="border-y border-outline-variant/30 bg-surface/70 px-6 py-7 md:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="mb-5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Operating constraints surfaced in the product
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm font-black text-on-surface-variant">
              <item.icon size={16} className="text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrinciplesGrid() {
  return (
    <section id="capabilities" className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.div variants={fadeUp} className="mb-12 max-w-3xl">
            <p className="label-large mb-4 text-primary">Core Principles</p>
            <h2 className="headline-large mb-5">Built for teams that want visible control over agent behavior.</h2>
            <p className="body-medium text-on-surface-variant">
              The workspace is designed around execution boundaries, not just prompt ergonomics. Every major capability answers the
              same operator question: what ran, what changed, and who approved it?
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            {principles.map((item) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                className="panel group rounded-[1.75rem] p-7 hover:-translate-y-1"
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low ${item.accent}`}>
                  <item.icon size={22} />
                </div>
                <h3 className="mb-3 text-xl font-black tracking-tight text-on-surface">{item.title}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-outline-variant/30 bg-surface-container-low/30 px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.div variants={fadeUp} className="mb-12 max-w-3xl">
            <p className="label-large mb-4 text-primary">How It Works</p>
            <h2 className="headline-large mb-5">A visible request pipeline from prompt to approved change.</h2>
            <p className="body-medium text-on-surface-variant">
              Vibe Hub keeps the core loop simple: route the task, verify behavior, stage the diff, then stop for human approval
              before mutation.
            </p>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-5">
            {howItWorks.map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="panel rounded-[1.5rem] p-6">
                <div className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-primary">
                  {item.step}
                </div>
                <h3 className="mb-3 text-base font-black text-on-surface">{item.title}</h3>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PlatformStatusPanel({ health, diagnostics, skillInfo, loading, error, lastSyncedAt, onRefresh }) {
  const statusPill = signalFromHealth(health);

  const cards = [
    {
      title: 'Backend readiness',
      value: statusPill.label,
      meta: health?.ready === false ? 'review infrastructure state' : 'control plane reachable',
      tone: statusPill.tone,
    },
    {
      title: 'Runtime diagnostics',
      value: diagnosticsSummary(diagnostics),
      meta: diagnostics?.ready === true ? 'runtime reports ready' : 'runtime signal loaded',
      tone: diagnostics?.ready === false ? 'text-google-red' : 'text-google-blue',
    },
    {
      title: 'Capability routing',
      value: `${skillInfo.count || 0} surfaced capabilities`,
      meta: skillInfo.labels.join(' / '),
      tone: 'text-primary',
    },
  ];

  return (
    <section id="platform-status" className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
          <motion.div variants={fadeUp} className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="label-large mb-4 text-primary">Live Platform Status</p>
              <h2 className="headline-large mb-5">Runtime and capability signals straight from the backend.</h2>
              <p className="body-medium text-on-surface-variant">
                The landing page uses the same app client surface the workspace uses: health, runtime diagnostics, routed skills, and
                auth state all load live instead of being hardcoded.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-black text-on-surface-variant">
                {lastSyncedAt ? `Updated ${lastSyncedAt.toLocaleTimeString()}` : 'Waiting for sync'}
              </div>
              <Button
                variant="outlined"
                size="sm"
                leadingIcon={RefreshCw}
                onClick={onRefresh}
                className="rounded-full px-4"
                disabled={loading}
              >
                {loading ? 'Refreshing' : 'Refresh'}
              </Button>
            </div>
          </motion.div>

          {error ? (
            <motion.div variants={fadeUp} className="mb-6 rounded-2xl border border-google-red/20 bg-google-red/10 px-5 py-4 text-sm font-medium text-google-red">
              {error}
            </motion.div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div variants={fadeUp} className="panel rounded-[1.75rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Activity size={21} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface">Operational snapshot</h3>
                  <p className="text-sm font-medium text-on-surface-variant">Live signals loaded through the frontend API client.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {cards.map((card) => (
                  <div key={card.title} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-on-surface-variant/70">{card.title}</div>
                    <div className={`mt-3 text-lg font-black ${card.tone}`}>{card.value}</div>
                    <div className="mt-2 text-xs font-medium leading-relaxed text-on-surface-variant">{card.meta}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="panel rounded-[1.75rem] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-google-blue/10 text-google-blue">
                  <Sparkles size={21} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface">Surfaced capability labels</h3>
                  <p className="text-sm font-medium text-on-surface-variant">Representative runtime domains exposed to the workspace.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {skillInfo.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-on-surface"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FinalCta({ onPrimaryCta, authenticated }) {
  return (
    <section className="px-6 pb-24 pt-4 md:px-10 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="panel relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-surface-container-low to-surface-container-lowest p-8 md:p-14"
        >
          <div className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-20" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="mb-5 text-4xl font-black tracking-tight text-on-surface md:text-5xl">
              Bring agentic coding into a workspace your team can actually govern.
            </h2>
            <p className="mb-9 text-base font-medium leading-relaxed text-on-surface-variant md:text-lg">
              Start with live routing, controlled execution, and reviewable diffs instead of hidden mutation paths.
            </p>
            <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
              <Button
                size="lg"
                variant="filled"
                trailingIcon={authenticated ? LayoutDashboard : ArrowRight}
                onClick={onPrimaryCta}
                className="h-14 rounded-full px-9 shadow-xl shadow-google-blue/20"
              >
                {authenticated ? 'Open Workspace' : 'Start Workspace'}
              </Button>
              <a
                href="https://github.com/johan-droid/Vibe-Hub"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-on-surface-variant transition-colors hover:text-primary"
              >
                <Github size={18} />
                View on GitHub
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function LandingFooter({ authenticated, statusPill }) {
  return (
    <footer className="border-t border-outline-variant/30 bg-surface-container-lowest">
      <div className="border-b border-outline-variant/20 px-6 py-14 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="label-large mb-4 text-primary">Production posture</p>
            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-on-surface md:text-5xl">
              Technical posture first. Marketing second.
            </h2>
            <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-on-surface-variant">
              Selina combines an authenticated workspace, local Docker execution, runtime diagnostics, MCP-aware routing, and staged
              review so the system remains fast without becoming unaccountable.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {footerCommitments.map((item) => (
              <div key={item.title} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon size={18} />
                </div>
                <h3 className="text-sm font-black text-on-surface">{item.title}</h3>
                <p className="mt-2 text-xs font-medium leading-relaxed text-on-surface-variant">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-6 flex items-center gap-3">
                <BrandMark />
                <div>
                  <div className="text-2xl font-black tracking-tight text-on-surface">{SELINA_BRAND.productName}</div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">{SELINA_BRAND.tagline}</div>
                </div>
              </div>

              <p className="mb-6 max-w-sm text-base font-medium leading-relaxed text-on-surface-variant">
                {SELINA_BRAND.shortDescription} Built for teams that want code generation, verification, and operator review inside one
                governed loop.
              </p>

              <div className="mb-8 flex flex-wrap gap-3">
                {[
                  { icon: Github, href: 'https://github.com/johan-droid/Vibe-Hub', label: 'GitHub' },
                  { icon: Mail, href: 'https://github.com/johan-droid/Vibe-Hub/issues/new', label: 'Contact' },
                  { icon: Globe, href: '#platform', label: 'Platform' },
                ].map((social) => {
                  const external = social.href.startsWith('http');
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface-variant transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      aria-label={social.label}
                    >
                      <social.icon size={18} />
                    </a>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${statusPill.dot}`} />
                  <span className={`text-xs font-black ${statusPill.tone}`}>{statusPill.label}</span>
                </div>
                <span className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-black text-on-surface-variant">
                  {SELINA_BRAND.versionLabel}
                </span>
                <span className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-black text-on-surface-variant">
                  {authenticated ? 'Authenticated session detected' : 'Guest view'}
                </span>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
                {footerColumns.map((column) => (
                  <div key={column.title}>
                    <h4 className="mb-5 text-sm font-black uppercase tracking-widest text-on-surface">{column.title}</h4>
                    <ul className="space-y-4">
                      {column.links.map((link) => {
                        const external = link.href.startsWith('http');
                        return (
                          <li key={link.label}>
                            <a
                              href={link.href}
                              target={external ? '_blank' : undefined}
                              rel={external ? 'noreferrer' : undefined}
                              className="group block"
                            >
                              <span className="block text-sm font-black text-on-surface-variant transition-colors group-hover:text-primary">
                                {link.label}
                              </span>
                              <span className="mt-1 block text-xs font-medium leading-relaxed text-on-surface-variant/60">
                                {link.detail}
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-outline-variant/20 bg-surface-container-low/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-center md:flex-row md:px-10 md:text-left">
          <div className="text-sm font-medium text-on-surface-variant/70">
            © {new Date().getFullYear()} {SELINA_BRAND.companyName}. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
            <a href="/agreement" className="transition-colors hover:text-primary">Terms</a>
            <a href="/agreement" className="transition-colors hover:text-primary">Privacy</a>
            <a href="/agreement" className="transition-colors hover:text-primary">Security</a>
            <span>Local Docker only</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const { health, diagnostics, skills, profile, loading, error, lastSyncedAt, refresh } = useBackendSignals();

  const authenticated = Boolean(user) || profile?.authenticated === true;

  const statusPill = useMemo(() => signalFromHealth(health), [health]);
  const diagnosticsText = useMemo(() => diagnosticsSummary(diagnostics), [diagnostics]);
  const skillInfo = useMemo(() => skillsSummary(skills), [skills]);

  const handlePrimaryCta = () => {
    navigate(authenticated ? '/dashboard' : '/agreement');
  };

  const handleArchitectureCta = () => {
    document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface">
      <LandingNav authenticated={authenticated} onPrimaryCta={handlePrimaryCta} />

      <main>
        <HeroTerminalPreview
          authenticated={authenticated}
          onPrimaryCta={handlePrimaryCta}
          onSecondaryCta={handleArchitectureCta}
          statusPill={statusPill}
          diagnosticsText={diagnosticsText}
          skillInfo={skillInfo}
        />
        <TrustStrip skillInfo={skillInfo} />
        <div id="architecture">
          <PrinciplesGrid />
        </div>
        <div id="security">
          <HowItWorks />
        </div>
        <PlatformStatusPanel
          health={health}
          diagnostics={diagnostics}
          skillInfo={skillInfo}
          loading={loading}
          error={error}
          lastSyncedAt={lastSyncedAt}
          onRefresh={refresh}
        />
        <FinalCta authenticated={authenticated} onPrimaryCta={handlePrimaryCta} />
      </main>

      <LandingFooter authenticated={authenticated} statusPill={statusPill} />
    </div>
  );
}
