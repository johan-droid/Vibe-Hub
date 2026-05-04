import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  Code2,
  FileCode2,
  Github,
  Globe,
  Layout,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const features = [
  { title: 'Agent orchestration', desc: 'Coordinate planning, coding, review, and deployment from one workspace.', icon: Brain },
  { title: 'Live workbench', desc: 'Inspect files, terminal output, diffs, and assistant context without switching tools.', icon: Layout },
  { title: 'Guarded execution', desc: 'Keep actions scoped, auditable, and tied to the current project session.', icon: ShieldCheck },
  { title: 'Deploy-ready flow', desc: 'Move from local changes to cloud release with fewer handoffs.', icon: Globe },
];

const previewFiles = [
  ['apps/user-interface', 'root'],
  ['src/pages', 'folder'],
  ['Workspace.jsx', 'file'],
  ['CommandCenterDashboard.jsx', 'active'],
  ['index.css', 'file'],
];

const previewStats = [
  ['Trust', '100%', ShieldCheck],
  ['Latency', '186ms', Activity],
  ['Runs', '4.1k', Zap],
  ['Runtime', 'Ready', Terminal],
];

const codeLines = [
  ['const', ' readiness = await agent.verify(scope);'],
  ['if', ' (readiness.safe) commit.review();'],
  ['return', ' workspace.ship({ guarded: true });'],
];

const runTimeline = [
  ['Plan scoped', '0.2s'],
  ['Patch staged', '1.4s'],
  ['Sandbox passed', '2.1s'],
];

function BrandMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
      <Brain size={21} />
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="panel relative w-full max-w-full overflow-hidden bg-surface-container-lowest shadow-3xl">
      <div className="flex h-11 items-center justify-between border-b border-outline-variant bg-surface-container-low px-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-google-red/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-google-yellow/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-google-green/80" />
        </div>
        <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-normal text-on-surface-variant sm:flex">
          <Lock size={12} />
          Protected branch
        </div>
      </div>

      <div className="grid min-h-[468px] grid-cols-[3.5rem_13rem_minmax(17rem,1fr)_18rem] bg-surface-container-lowest max-xl:grid-cols-[3.5rem_minmax(18rem,1fr)_17rem] max-md:min-h-[360px]">
        <div className="flex flex-col items-center gap-3 border-r border-outline-variant bg-surface-container-low px-2 py-4">
          {[Brain, FileCode2, Activity, Terminal].map((Icon, index) => (
            <div key={index} className={`flex h-9 w-9 items-center justify-center rounded-lg ${index === 0 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}>
              <Icon size={17} />
            </div>
          ))}
        </div>

        <aside className="border-r border-outline-variant bg-surface-container-low p-4 max-xl:hidden">
          <div className="mb-4 flex items-center justify-between">
            <span className="label-medium">Explorer</span>
            <Code2 size={15} className="text-primary" />
          </div>
          <div className="space-y-2">
            {previewFiles.map(([item, type]) => (
              <div key={item} className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium ${type === 'active' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>
                <FileCode2 size={14} />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col border-r border-outline-variant">
          <div className="flex h-12 items-center justify-between border-b border-outline-variant px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-on-surface">CommandCenterDashboard.jsx</p>
              <p className="text-xs font-medium text-on-surface-variant">Safe patch prepared for review</p>
            </div>
            <span className="rounded-full bg-google-green/10 px-2 py-1 text-[10px] font-bold text-google-green">Verified</span>
          </div>

          <div className="grid flex-1 grid-rows-[1fr_auto] gap-4 p-4">
            <section className="min-h-0 rounded-lg border border-outline-variant bg-surface-container-low">
              <div className="flex h-10 items-center justify-between border-b border-outline-variant px-3">
                <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                  <Code2 size={14} className="text-primary" />
                  Patch preview
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant">3 files</span>
              </div>
              <div className="space-y-3 p-4 font-mono text-[12px] leading-6 text-on-surface-variant">
                {codeLines.map(([keyword, line], index) => (
                  <div key={line} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                    <span className="text-right text-on-surface-variant/50">{index + 8}</span>
                    <p className="truncate">
                      <span className="font-bold text-google-yellow">{keyword}</span>
                      <span>{line}</span>
                    </p>
                  </div>
                ))}
                <div className="mt-3 rounded-md border border-google-green/25 bg-google-green/10 px-3 py-2 text-google-green">
                  + Redis VFS ownership check added before commit
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              {runTimeline.map(([label, time]) => (
                <div key={label} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <CheckCircle2 size={15} className="mb-2 text-google-green" />
                  <p className="truncate text-xs font-bold text-on-surface">{label}</p>
                  <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">{time}</p>
                </div>
              ))}
            </section>
          </div>
        </main>

        <aside className="flex min-w-0 flex-col bg-surface-container-lowest max-lg:hidden">
          <div className="flex h-12 items-center justify-between border-b border-outline-variant px-4">
            <div>
              <p className="text-sm font-black text-on-surface">Release Readiness</p>
              <p className="text-xs font-medium text-on-surface-variant">Live control plane</p>
            </div>
            <Button size="sm" variant="tonal">Re-index</Button>
          </div>

          <div className="grid gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {previewStats.map(([label, value, Icon]) => (
                <div key={label} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <Icon size={16} className="mb-3 text-primary" />
                  <p className="text-[11px] font-bold text-on-surface-variant">{label}</p>
                  <p className="mt-1 text-lg font-black text-on-surface">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-black text-on-surface">Guardrail queue</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Live</span>
              </div>
              <div className="space-y-3">
                {['CSRF verified', 'Audit row queued', 'Docker healthy'].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium text-on-surface-variant">
                    <CheckCircle2 size={15} className="text-google-green" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant bg-surface-container-lowest/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-3">
          <BrandMark />
          <div className="text-left">
            <p className="text-lg font-black leading-none tracking-normal text-on-surface">Selina</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-normal text-on-surface-variant">Intelligence Labs</p>
          </div>
        </button>

        <div className="hidden items-center gap-7 md:flex">
          {['Platform', 'Security', 'Workflow'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary">
              {item}
            </a>
          ))}
        </div>

        {user ? (
          <Button variant="filled" size="md" trailingIcon={ArrowRight} onClick={() => navigate('/dashboard')} className="max-sm:h-10 max-sm:w-10 max-sm:px-0">
            <span className="hidden sm:inline">Workspace</span>
          </Button>
        ) : (
          <Button variant="filled" size="md" trailingIcon={ArrowRight} onClick={() => window.location.href = api.getGoogleAuthUrl()} className="max-sm:h-10 max-sm:w-10 max-sm:px-0">
            <span className="hidden sm:inline">Get Started</span>
          </Button>
        )}
      </div>
    </nav>
  );
}

export default function LandingPage() {
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setBackendHealth(await api.health());
      } catch {
        setBackendHealth({ status: 'error' });
      }
    };
    fetchHealth();
  }, []);

  const isOnline = backendHealth?.status === 'active';

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-on-surface">
      <Navbar />

      <main>
        <section className="relative px-5 pb-12 pt-24 md:px-8 md:pb-16 md:pt-28">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <motion.div initial="hidden" animate="show" variants={fadeUp}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5">
                <Sparkles size={14} className="text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-normal text-on-surface-variant">Autonomous engineering workspace</span>
              </div>
              <h1 className="display-large">Selina</h1>
              <p className="mt-5 max-w-[24rem] text-xl font-medium leading-8 text-on-surface-variant md:max-w-2xl">
                A coding agent command center for planning, patching, sandboxing, and shipping with visible control.
              </p>
              <div className="mt-8 flex max-w-[21rem] flex-col gap-3 sm:max-w-none sm:flex-row">
                <Button size="lg" variant="filled" trailingIcon={ArrowRight} onClick={() => window.location.href = api.getGoogleAuthUrl()}>
                  Launch Project
                </Button>
                <Button size="lg" variant="outlined" leadingIcon={Play}>
                  Watch Preview
                </Button>
              </div>
              <div className="mt-8 grid max-w-xl gap-2 text-sm font-semibold text-on-surface-variant sm:grid-cols-3">
                <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"><ShieldCheck size={15} className="text-google-green" /> Guarded sessions</span>
                <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"><Github size={15} /> Git-aware workflow</span>
                <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"><Activity size={15} className="text-primary" /> Live telemetry</span>
              </div>
            </motion.div>

            <motion.div className="hidden min-w-0 md:block" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
              <ProductPreview />
            </motion.div>

            <div className="panel min-w-0 p-4 md:hidden">
              <div className="mb-4 flex items-center justify-between border-b border-outline-variant pb-3">
                <div>
                  <p className="text-sm font-black text-on-surface">System Intelligence</p>
                  <p className="text-xs font-medium text-on-surface-variant">Mobile workspace preview</p>
                </div>
                <Brain size={18} className="text-primary" />
              </div>
              <div className="space-y-3">
                {[
                  ['Active agents', '12', Brain],
                  ['Trust score', '100%', ShieldCheck],
                  ['Runtime', 'Ready', Terminal],
                ].map(([label, value, Icon]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"><Icon size={15} className="text-primary" /> {label}</span>
                    <span className="text-sm font-black text-on-surface">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="border-y border-outline-variant bg-surface-container-lowest px-5 py-14 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="label-large">Platform</p>
                <h2 className="mt-2 headline-large">Built around the workbench.</h2>
              </div>
              <p className="max-w-xl text-base font-medium leading-7 text-on-surface-variant">
                The interface keeps project files, agent reasoning, terminal state, and deployment context close together.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="panel p-5">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon size={18} />
                  </div>
                  <h3 className="text-lg font-black tracking-normal text-on-surface">{feature.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-on-surface-variant">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="px-5 py-14 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="panel p-6 md:p-8">
              <Lock size={24} className="mb-6 text-primary" />
              <h2 className="headline-medium">Security that stays visible.</h2>
              <p className="mt-4 text-base font-medium leading-7 text-on-surface-variant">
                Session state, auth health, runtime connectivity, and workspace readiness are surfaced directly in the product.
              </p>
            </div>
            <div className="panel p-6 md:p-8">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-google-green/10 px-3 py-1.5 text-sm font-bold text-google-green">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-google-green' : 'bg-google-red'}`} />
                {isOnline ? 'Backend online' : 'Backend unavailable'}
              </div>
              <h2 className="headline-medium">A cleaner path from idea to shipped.</h2>
              <p className="mt-4 text-base font-medium leading-7 text-on-surface-variant">
                Selina reduces context switching so teams can ask, inspect, validate, and release from a single controlled surface.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant bg-surface-container-lowest px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-medium text-on-surface-variant md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span>Selina Intelligence Labs</span>
          </div>
          <span>© 2026. Built for focused autonomous engineering.</span>
        </div>
      </footer>
    </div>
  );
}
