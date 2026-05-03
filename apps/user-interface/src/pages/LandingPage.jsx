import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Brain, CheckCircle2, Code2, Database, Github, GitPullRequestArrow,
  Layers3, LockKeyhole, Network, Play, Search, ShieldCheck,
  Sparkles, TerminalSquare, Zap
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';

const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: [0.2, 0, 0, 1] } },
};

const errorCopy = {
  oauth_not_configured: 'OAuth is not configured on the server yet. Add provider credentials and try again.',
  invalid_state: 'Your sign-in request expired. Start a fresh sign-in to continue.',
  missing_code: 'The provider did not return a sign-in code. Please try again.',
  provider_failed: 'The provider sign-in failed. Verify OAuth credentials and callback URLs.',
  profile_failed: 'Selina could not load your profile after sign-in.',
};

const workflows = [
  {
    id: 'plan',
    label: 'Plan',
    icon: Network,
    title: 'Turns messy requests into crisp execution paths.',
    summary: 'Selina reads the workspace, chooses the right skill bridge, and proposes the smallest safe path before touching code.',
    command: 'selina plan "ship auth and dashboard polish"',
    output: ['Maps repo structure', 'Selects UI + backend + security skills', 'Creates a focused implementation plan'],
  },
  {
    id: 'build',
    label: 'Build',
    icon: Code2,
    title: 'Implements with project-aware edits.',
    summary: 'The agent works against real files, keeps context bounded, and uses surgical changes instead of blind rewrites.',
    command: 'selina build --scope frontend --verify',
    output: ['Reads components first', 'Applies targeted patches', 'Keeps interface states intuitive'],
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: TerminalSquare,
    title: 'Finds the failure path, not just the symptom.',
    summary: 'Runtime events, terminal output, model diagnostics, and tests feed the same debugging cockpit.',
    command: 'selina debug --trace websocket',
    output: ['Classifies failure domain', 'Runs verification loop', 'Explains root cause clearly'],
  },
  {
    id: 'secure',
    label: 'Secure',
    icon: ShieldCheck,
    title: 'Hardens the app for real users.',
    summary: 'Auth, token handling, provider routing, audit logs, and secrets stay visible without leaking sensitive data.',
    command: 'selina audit --market-ready',
    output: ['Checks trust boundaries', 'Redacts diagnostics', 'Surfaces release blockers'],
  },
];

const capabilityCards = [
  { icon: Layers3, title: 'MOE skill switching', desc: 'Routes across UI, backend, security, data, DevOps, testing, and AI skill bridges.' },
  { icon: LockKeyhole, title: 'Secure sessions', desc: 'OAuth-first access with protected workspace routes and stale-token cleanup.' },
  { icon: Database, title: 'Context memory', desc: 'Keeps useful project signals while controlling token spend and model context.' },
  { icon: Zap, title: 'Fast feedback loop', desc: 'Streams status, tool calls, terminal output, and verification results back into the cockpit.' },
];

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Workspace', href: '#workspace' },
      { label: 'Agent cockpit', href: '#workspace' },
      { label: 'Skill graph', href: '#capabilities' },
      { label: 'Runtime diagnostics', href: '#security' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'OAuth bridge', href: '#security' },
      { label: 'Model gateway', href: '#capabilities' },
      { label: 'GitHub actions', href: '#how-it-works' },
      { label: 'WebContainer VFS', href: '#workspace' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '#how-it-works' },
      { label: 'Security notes', href: '#security' },
      { label: 'Release checklist', href: '#capabilities' },
      { label: 'API status', href: '#security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Selina', href: '#workspace' },
      { label: 'Roadmap', href: '#capabilities' },
      { label: 'Support', href: '#security' },
      { label: 'Privacy', href: '#security' },
    ],
  },
];

function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-surface-container-lowest">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_82%_12%,hsl(var(--secondary)/0.14),transparent_26%),linear-gradient(180deg,hsl(var(--surface-container-lowest)),hsl(var(--surface))_52%,hsl(var(--surface-container-lowest)))]" />
      <div className="absolute left-[5%] top-24 h-80 w-80 rounded-full bg-primary/10 blur-[130px] animate-drift" />
      <div className="absolute bottom-32 right-[8%] h-96 w-96 rounded-full bg-secondary/10 blur-[150px] animate-drift [animation-delay:3s]" />
      <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
    </div>
  );
}

function BrandMark({ size = 'md' }) {
  const sizes = size === 'lg' ? 'h-14 w-14 rounded-[1.35rem]' : 'h-11 w-11 rounded-2xl';
  const iconSize = size === 'lg' ? 27 : 22;

  return (
    <div className={`${sizes} flex items-center justify-center border border-primary/25 bg-primary/10 text-primary shadow-lg shadow-primary/10`}>
      <Brain size={iconSize} />
    </div>
  );
}

function WorkflowSwitcher({ activeWorkflow, setActiveWorkflow }) {
  return (
    <div className="grid gap-2 rounded-[1.5rem] border border-outline-variant/35 bg-surface-container-low/70 p-2 sm:grid-cols-4">
      {workflows.map((workflow) => {
        const Icon = workflow.icon;
        const isActive = workflow.id === activeWorkflow.id;
        return (
          <button
            key={workflow.id}
            onClick={() => setActiveWorkflow(workflow)}
            className={`relative flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {isActive && <motion.span layoutId="workflow-pill" className="absolute inset-0 rounded-2xl border border-primary/25 bg-primary/10" />}
            <Icon size={16} className="relative z-10" />
            <span className="relative z-10">{workflow.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProductPreview({ activeWorkflow }) {
  const files = ['apps/user-interface/src/App.jsx', 'apps/server-bridge/auth/google.js', 'orchestrator/skill-graph.js'];

  return (
    <motion.div variants={fadeUp} className="relative mx-auto w-full max-w-6xl">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/10 blur-3xl" />
      <div className="app-chrome relative overflow-hidden rounded-[2rem]">
        <div className="flex h-14 items-center justify-between border-b border-outline-variant/35 px-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-error/70" />
            <span className="h-3 w-3 rounded-full bg-secondary/80" />
            <span className="h-3 w-3 rounded-full bg-tertiary/80" />
          </div>
          <div className="hidden rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-on-surface-variant sm:block">
            Selina Workspace
          </div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={14} />
            <span className="label-small">{activeWorkflow.label} mode</span>
          </div>
        </div>

        <div className="grid min-h-[540px] grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)_330px]">
          <aside className="hidden border-r border-outline-variant/30 bg-surface-container-low/70 p-4 md:block">
            <div className="mb-5 flex items-center justify-between">
              <span className="label-small text-on-surface-variant">Workspace map</span>
              <GitPullRequestArrow size={14} className="text-tertiary" />
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={file} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${index === 2 ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>
                  <Code2 size={14} />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
              <p className="label-small mb-4 text-secondary">Skill bridge</p>
              <div className="space-y-3 text-xs text-on-surface-variant">
                {['Frontend', 'Backend', 'Security', 'AI routing'].map((skill, index) => (
                  <div key={skill} className="flex items-center justify-between">
                    <span>{skill}</span>
                    <span className={`h-2 w-2 rounded-full ${index < 3 ? 'bg-tertiary' : 'bg-primary animate-soft-pulse'}`} />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="bg-surface-container-lowest/80 p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="label-small text-primary">Active workflow</p>
                <h3 className="title-large mt-1">{activeWorkflow.title}</h3>
              </div>
              <Button size="sm" variant="tonal" leadingIcon={Play}>Preview run</Button>
            </div>

            <div className="rounded-2xl border border-outline-variant/30 bg-[#070b10]/90 p-5 font-mono text-[12px] leading-7 text-on-surface-variant shadow-inner">
              <p><span className="text-outline">$</span> {activeWorkflow.command}</p>
              <p className="text-primary">Selina: analyzing request...</p>
              {activeWorkflow.output.map((line, index) => (
                <p key={line}><span className="text-outline">0{index + 1}</span> <span className="text-tertiary">ok</span> {line}</p>
              ))}
              <p className="text-secondary">ready for verified action</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {['Plan', 'Patch', 'Verify'].map((label, index) => (
                <div key={label} className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4">
                  <CheckCircle2 size={18} className={`mb-3 ${index === 1 ? 'text-primary' : 'text-tertiary'}`} />
                  <p className="label-small text-on-surface-variant">{label}</p>
                </div>
              ))}
            </div>
          </main>

          <aside className="border-t border-outline-variant/30 bg-surface-container-low/75 p-4 md:border-l md:border-t-0">
            <div className="mb-4 flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="title-small">Selina</p>
                <p className="label-small text-primary">Agent online</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-surface-container p-4 text-sm leading-6 text-on-surface-variant">{activeWorkflow.summary}</div>
              <div className="ml-auto max-w-[88%] rounded-2xl bg-primary/15 p-4 text-sm text-on-surface">Make this production ready.</div>
              <div className="rounded-2xl bg-surface-container p-4 text-sm leading-6 text-on-surface-variant">I will map the work, choose the right skill bridge, edit carefully, and show verification before you ship.</div>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="label-small mb-4 text-primary">{eyebrow}</p>
        <h2 className="headline-large max-w-2xl">{title}</h2>
      </div>
      <p className="max-w-md text-sm leading-7 text-on-surface-variant">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useStore(s => s.user);
  const authError = searchParams.get('error');
  const [activeWorkflow, setActiveWorkflow] = useState(workflows[0]);

  const navItems = useMemo(() => ['Workspace', 'How it works', 'Capabilities', 'Security'], []);

  const handleLaunch = (provider = 'google') => {
    window.location.href = provider === 'github'
      ? api.getGithubAuthUrl()
      : api.getGoogleAuthUrl();
  };

  const openWorkspace = () => navigate('/dashboard');

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface selection:bg-primary/20 selection:text-primary">
      <AmbientBackground />

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/30 bg-surface-container-lowest/72 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left" aria-label="Selina home">
            <BrandMark />
            <div>
              <p className="title-small leading-none">Selina</p>
              <p className="label-small mt-1 text-primary/80">Agentic IDE</p>
            </div>
          </button>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} className="label-small text-on-surface-variant transition hover:text-on-surface">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user && <Button variant="tonal" size="sm" onClick={openWorkspace}>Open dashboard</Button>}
            <Button variant="outlined" size="sm" leadingIcon={Github} className="hidden border-outline-variant/50 text-on-surface sm:flex" onClick={() => handleLaunch('github')}>GitHub</Button>
            <Button variant="filled" size="sm" leadingIcon={GoogleIcon} onClick={() => handleLaunch('google')}>Sign in</Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-40">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="mx-auto max-w-7xl">
            {authError && (
              <motion.div variants={fadeUp} className="mx-auto mb-8 max-w-3xl rounded-2xl border border-error/30 bg-error/10 px-5 py-4 text-sm text-on-error-container">
                {errorCopy[authError] || 'Authentication failed. Please try again.'}
              </motion.div>
            )}

            <div className="mx-auto max-w-5xl text-center">
              <motion.div variants={fadeUp} className="mb-7 inline-flex items-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-low/70 px-4 py-2 text-on-surface-variant shadow-xl shadow-black/20 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-tertiary animate-soft-pulse" />
                <span className="label-small">Meet Selina, your software agent</span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="display-large mx-auto max-w-6xl leading-[0.92]">
                Build, debug, and ship with an agent that understands the whole stack.
              </motion.h1>

              <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-3xl text-base leading-8 text-on-surface-variant md:text-lg">
                Selina is an agentic dashboard for coding teams that plans across disciplines, edits with context, verifies changes, and keeps the interface calm enough for real product work.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                {user && <Button size="lg" variant="tonal" trailingIcon={ArrowRight} onClick={openWorkspace} className="h-14 px-8">Open dashboard</Button>}
                <Button size="lg" leadingIcon={GoogleIcon} trailingIcon={ArrowRight} onClick={() => handleLaunch('google')} className="h-14 px-8">Continue with Google</Button>
                <Button size="lg" variant="elevated" leadingIcon={Github} onClick={() => handleLaunch('github')} className="h-14 px-8 border border-outline-variant/40">Continue with GitHub</Button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-7 flex flex-wrap justify-center gap-3 text-xs text-on-surface-variant">
                {['Skill-switching MOE brain', 'OAuth-secured workspace', 'Debug and audit loop'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low/60 px-3 py-1.5">
                    <CheckCircle2 size={13} className="text-tertiary" /> {item}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div variants={fadeUp} id="workspace" className="mx-auto mt-16 max-w-4xl">
              <WorkflowSwitcher activeWorkflow={activeWorkflow} setActiveWorkflow={setActiveWorkflow} />
            </motion.div>

            <div className="mt-10">
              <ProductPreview activeWorkflow={activeWorkflow} />
            </div>
          </motion.div>
        </section>

        <section id="how-it-works" className="px-5 py-20 md:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="How it works"
              title="A guided loop that feels intuitive from the first prompt."
              body="Selina turns vague work into visible steps, keeps you in control, and makes the next action obvious."
            />
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { icon: Search, title: 'Observe', desc: 'Reads project structure, open files, runtime state, and auth context.' },
                { icon: Network, title: 'Route', desc: 'Chooses the right skill bridge across frontend, backend, security, data, and DevOps.' },
                { icon: Code2, title: 'Act', desc: 'Applies focused edits, streams progress, and keeps failure states readable.' },
                { icon: ShieldCheck, title: 'Verify', desc: 'Runs checks, summarizes evidence, and highlights release blockers.' },
              ].map((step, index) => (
                <motion.div key={step.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="premium-panel rounded-[1.5rem] p-6">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <step.icon size={22} />
                  </div>
                  <p className="label-small mb-3 text-on-surface-variant">0{index + 1}</p>
                  <h3 className="title-large mb-3">{step.title}</h3>
                  <p className="text-sm leading-7 text-on-surface-variant">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="capabilities" className="px-5 py-20 md:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Capabilities"
              title="Designed for real teams, not demo prompts."
              body="The interface explains what the agent is doing, the backend routes to the right skill, and the workspace stays navigable under pressure."
            />
            <div className="bento-grid">
              {capabilityCards.map((feature, index) => (
                <motion.div key={feature.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06, duration: 0.5 }} className="bento-card min-h-[230px]">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/35 bg-surface-container-high text-primary">
                    <feature.icon size={22} />
                  </div>
                  <h3 className="title-large mb-3">{feature.title}</h3>
                  <p className="text-sm leading-7 text-on-surface-variant">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="px-5 pb-24 pt-10 md:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-outline-variant/35 bg-surface-container-low/75 p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl md:p-10">
            <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
              <div>
                <p className="label-small mb-4 text-secondary">Security and trust</p>
                <h2 className="headline-large mb-4">Selina keeps power visible and controlled.</h2>
                <p className="text-sm leading-7 text-on-surface-variant">
                  OAuth sign-in, protected routes, token cleanup, runtime diagnostics, and skill graph visibility create a safer path from idea to deploy.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Google and GitHub OAuth', 'Protected workspace', 'Runtime diagnostics', 'Audit-ready model gateway'].map((item) => (
                  <div key={item} className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
                    <ShieldCheck size={18} className="mb-3 text-tertiary" />
                    <p className="label-small text-on-surface-variant">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-outline-variant/30 px-5 py-12 md:px-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <BrandMark />
                <div>
                  <p className="title-large">Selina</p>
                  <p className="label-small text-primary">Agentic software workspace</p>
                </div>
              </div>
              <p className="max-w-md text-sm leading-7 text-on-surface-variant">
                Selina helps builders move from messy requests to verified software changes with a calm interface and a skill-switching agent brain.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-on-surface-variant">
                <span className="rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1.5">Status: active</span>
                <span className="rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1.5">Version: v4 agent workspace</span>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="label-small mb-4 text-on-surface">{group.title}</h3>
                  <div className="space-y-3">
                    {group.links.map((link) => (
                      <a key={link.label} href={link.href} className="block text-sm text-on-surface-variant transition hover:text-primary">
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col justify-between gap-4 border-t border-outline-variant/30 pt-6 text-xs text-on-surface-variant md:flex-row md:items-center">
            <p>(c) 2026 Selina. Built for focused agentic software work.</p>
            <div className="flex flex-wrap gap-5 label-small">
              <a href="#security" className="hover:text-on-surface">Security</a>
              <a href="#capabilities" className="hover:text-on-surface">Capabilities</a>
              <a href="#how-it-works" className="hover:text-on-surface">How it works</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
