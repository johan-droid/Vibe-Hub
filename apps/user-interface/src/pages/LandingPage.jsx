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
  Mail,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';
import { VibeLogoCompact } from '../components/VibeLogo';
import { SELINA_BRAND } from '../brand/selina';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0, 0, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const bentoItem = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.2, 0, 0, 1] } },
};

const features = [
  {
    title: 'Smart Memory',
    desc: 'Persist project decisions, debugging notes, and coding preferences as auditable memory instead of fragile chat-only context.',
    icon: Brain,
    image: '/images/smart_memory.png',
    size: 'large',
    color: 'google-blue'
  },
  {
    title: 'The Universal Link',
    desc: 'Route OpenAI, Anthropic, MCP, GitHub, browser, and terminal capabilities through one governed workspace.',
    icon: Layout,
    image: '/images/connected_tools.png',
    size: 'medium',
    color: 'google-yellow'
  },
  {
    title: 'Safe Playground',
    desc: 'Run generated code in a local Docker sandbox with explicit approval and environment sanitization.',
    icon: ShieldCheck,
    image: '/images/safe_sandbox.png',
    size: 'medium',
    color: 'google-green'
  },
  {
    title: 'Always Protected',
    desc: 'Keep provider secrets out of the browser and require grants before write or execution tools run.',
    icon: Lock,
    size: 'small',
    color: 'google-red'
  },
];

const footerColumns = [
  {
    title: 'Platform',
    links: [
      { label: 'Orchestrator Workspace', href: '#workspace', detail: 'Editor, terminal, tool graph, and execution log.' },
      { label: 'Provider MoE', href: '#capabilities', detail: 'Route code, debug, review, and manager experts.' },
      { label: 'MCP Tooling', href: '#capabilities', detail: 'Schema-validated tools with diagnostics and audit events.' },
      { label: 'Local Docker Sandbox', href: '#security', detail: 'Generated code execution stays local by policy.' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Architecture, setup, and release notes.' },
      { label: 'API Reference', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Runtime, MCP, approvals, and run inspection APIs.' },
      { label: 'GitHub Repository', href: 'https://github.com/johan-droid/Vibe-Hub', detail: 'Source, issues, and contribution workflow.' },
      { label: 'Diagnostics', href: '#security', detail: 'Runtime health, MCP state, and sandbox readiness.' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Selina', href: '#capabilities', detail: 'Secure agentic coding for focused teams.' },
      { label: 'Contact', href: 'https://github.com/johan-droid/Vibe-Hub/issues/new', detail: 'Open a repository issue for product and support inquiries.' },
      { label: 'Security Contact', href: 'https://github.com/johan-droid/Vibe-Hub/security', detail: 'Use the repository security channel for responsible disclosure.' },
      { label: 'Status', href: '#status', detail: 'Local runtime and backend readiness signal.' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/login#terms', detail: 'Usage rules, generated code, and user responsibilities.' },
      { label: 'Privacy Notice', href: '/login#privacy', detail: 'Cookie auth, session metadata, and audit events.' },
      { label: 'Security Policy', href: '/login#security-notice', detail: 'Approval gates, local execution, and secret handling.' },
      { label: 'Cookie Policy', href: '/login#privacy', detail: 'HttpOnly auth cookies and non-secret preferences.' },
    ],
  },
];

const footerCommitments = [
  {
    icon: Terminal,
    title: 'Local execution only',
    text: 'Generated code runs in the local Docker sandbox with no cloud runner introduced.',
  },
  {
    icon: ShieldCheck,
    title: 'Approval-gated actions',
    text: 'Write, execution, browser, GitHub, and MCP mutations require explicit grants.',
  },
  {
    icon: Lock,
    title: 'Zero-key browser UI',
    text: 'Provider secrets stay server-side; browser auth uses HttpOnly cookies.',
  },
  {
    icon: FileCode2,
    title: 'Auditable rollouts',
    text: 'Plans, tool calls, edits, terminal output, and outcomes are captured as run artifacts.',
  },
];

const footerSignals = [
  { icon: CheckCircle2, label: 'JSON-RPC event stream' },
  { icon: Activity, label: 'Runtime diagnostics' },
  { icon: Shield, label: 'Sanitized subprocess env' },
  { icon: Globe, label: 'MCP-ready extension layer' },
];

function BrandMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <VibeLogoCompact size={40} />
    </div>
  );
}

function BentoCard({ feature }) {
  const isLarge = feature.size === 'large';
  const Icon = feature.icon;

  return (
    <motion.div
      variants={bentoItem}
      whileHover={{ y: -5 }}
      className={`panel overflow-hidden group relative flex flex-col ${
        isLarge ? 'bento-card-large' : ''
      }`}
    >
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10 flex h-full flex-col p-6 md:p-8">
        <div className={`mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-${feature.color}/10 text-${feature.color}`}>
          <Icon size={20} />
        </div>
        
        <h3 className={`${isLarge ? 'text-2xl' : 'text-xl'} font-black tracking-tight text-on-surface mb-3`}>{feature.title}</h3>
        <p className="text-sm font-medium leading-relaxed text-on-surface-variant/70">{feature.desc}</p>
        
        {isLarge && (
          <div className="mt-auto pt-8">
             <Button variant="tonal" size="md" trailingIcon={ArrowRight} className="group-hover:bg-primary group-hover:text-on-primary transition-colors duration-500">Explore</Button>
          </div>
        )}
      </div>

      {feature.image && (
        <div className={`absolute ${isLarge ? 'right-0 bottom-0 w-2/3 h-2/3' : 'right-[-10%] bottom-[-10%] w-1/2 h-1/2'} opacity-40 group-hover:opacity-100 transition-all duration-700 pointer-events-none group-hover:scale-105`}>
          <img 
            src={feature.image} 
            alt={feature.title}
            className="w-full h-full object-contain object-right-bottom animate-float"
          />
        </div>
      )}
    </motion.div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <nav className="pointer-events-auto flex w-full max-w-4xl items-center justify-between rounded-full border border-outline-variant/30 bg-surface/60 px-4 py-2 shadow-xl shadow-surface-container-lowest/5 backdrop-blur-3xl">
        <button onClick={() => navigate('/')} className="flex items-center gap-3 pl-2 group">
          <BrandMark />
          <div className="text-left hidden sm:block">
            <p className="text-lg font-black leading-none tracking-tight text-on-surface group-hover:text-primary transition-colors duration-300">Selina</p>
          </div>
        </button>

        <div className="hidden items-center gap-8 md:flex">
          {['Capabilities', 'Security', 'Workspace'].map((item) => (
            <a 
              key={item} 
              href={`#${item.toLowerCase()}`} 
              className="relative text-sm font-black uppercase tracking-widest text-on-surface-variant/70 transition-all hover:text-primary group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 pr-1">
          {user ? (
            <Button variant="filled" size="md" trailingIcon={ArrowRight} onClick={() => navigate('/dashboard')} className="rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all">
              Workspace
            </Button>
          ) : (
            <Button variant="filled" size="md" trailingIcon={ArrowRight} onClick={() => navigate('/login')} className="rounded-full px-7 h-11 text-sm font-black shadow-lg shadow-primary/25 hover:shadow-primary/45 hover:scale-[1.03] transition-all duration-300 bg-gradient-to-r from-primary to-primary/90">
              Get Started
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
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
    <div className="min-h-screen overflow-x-hidden bg-surface text-on-surface selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="pt-24 md:pt-32 relative">
        <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
        
        {/* Hero Section */}
        <section className="px-6 pb-20 md:px-10 md:pb-32 relative z-10">
          <div className="mx-auto max-w-7xl text-center">
            <motion.div 
              initial="hidden" 
              animate="show" 
              variants={staggerContainer}
              className="flex flex-col items-center"
            >
              <motion.div 
                variants={fadeUp}
                className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-outline-variant/60 bg-surface-container-low px-4 py-2 backdrop-blur-md"
              >
                <Sparkles size={16} className="text-primary animate-pulse" />
                <span className="text-[12px] font-black uppercase tracking-widest text-on-surface-variant">Your AI Coding Partner</span>
              </motion.div>
              
              <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-black tracking-tight mb-6">
                Build software <br /> 
                <span className="text-gradient-google">with intelligence.</span>
              </motion.h1>
              
              <motion.p variants={fadeUp} className="max-w-xl text-lg font-medium leading-relaxed text-on-surface-variant/80 mb-10">
                Selina brings planning, code review, terminal execution, MCP tools, and approval gates into one local-first agentic coding workspace.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-5">
                <Button size="lg" variant="filled" trailingIcon={ArrowRight} onClick={() => navigate('/login')} className="rounded-full px-10 h-16 text-lg shadow-xl shadow-primary/30 hover:scale-105 transition-transform duration-300">
                  Start Building Now
                </Button>
                <Button
                  size="lg"
                  variant="outlined"
                  leadingIcon={Play}
                  onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}
                  className="rounded-full px-10 h-16 text-lg border-2 hover:bg-surface-container-low transition-colors duration-300"
                >
                  Explore capabilities
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-20 w-full max-w-5xl opacity-90 hover:opacity-100 transition-opacity duration-700">
                 <div className="panel p-2 rounded-[2.5rem] bg-gradient-to-b from-outline-variant/30 to-transparent">
                   <div className="rounded-[2rem] overflow-hidden bg-surface-container-lowest shadow-3xl border border-outline-variant/20">
                      <img 
                        src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=2000" 
                        alt="Workspace Preview" 
                        className="w-full h-auto"
                      />
                   </div>
                 </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section id="capabilities" className="bg-surface-container-lowest py-24 md:py-40 px-6 md:px-10 border-y border-outline-variant/20">
          <div className="mx-auto max-w-7xl">
            <motion.div 
              initial="hidden" 
              whileInView="show" 
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              <div className="mb-16 md:mb-24 max-w-2xl">
                <p className="label-large text-primary mb-4">Capabilities</p>
                <h2 className="headline-large mb-6">Designed to help you <br /> <span className="text-gradient">create, not just code.</span></h2>
                <p className="text-lg font-medium text-on-surface-variant leading-relaxed">
                  We've built Selina around the philosophy of simplicity and power. No technical jargon, just results.
                </p>
              </div>

              <div className="bento-grid">
                {features.map((feature, idx) => (
                  <BentoCard key={idx} feature={feature} />
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Trust Signals Section */}
        <section id="security" className="py-24 md:py-32 px-6 md:px-10 border-y border-outline-variant/20 bg-surface-container-lowest/50">
          <div className="mx-auto max-w-7xl">
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            >
              {[
                { value: 'Local', label: 'Docker sandbox policy' },
                { value: 'Grant', label: 'Risky tool approvals' },
                { value: 'JSON', label: 'RPC event envelopes' },
                { value: 'Audit', label: 'Run artifacts and logs' },
              ].map((stat, idx) => (
                <motion.div 
                  key={idx}
                  variants={fadeUp}
                  className="text-center"
                >
                  <div className="text-4xl md:text-5xl font-black text-gradient-google mb-2">{stat.value}</div>
                  <div className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Workspace Model Section */}
        <section id="workspace" className="py-24 md:py-40 px-6 md:px-10">
          <div className="mx-auto max-w-7xl">
            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="text-center mb-16 md:mb-24"
            >
              <motion.p variants={fadeUp} className="label-large text-primary mb-4">Workspace Model</motion.p>
              <motion.h2 variants={fadeUp} className="headline-large mb-6">
                Built around the way <br />
                <span className="text-gradient">production agents work</span>
              </motion.h2>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: Brain,
                  title: 'Plan before edits',
                  description: 'Selina records plans, implementation notes, and status artifacts so a run can be inspected or resumed without relying on hidden chat state.',
                },
                {
                  icon: Terminal,
                  title: 'Verify locally',
                  description: 'Builds, tests, and generated code execute through the local sandbox boundary with sanitized subprocess environments.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Pause for risk',
                  description: 'Write, browser, GitHub, execution, and unknown MCP mutations require approval grants before they can cross the execution boundary.',
                },
              ].map((workflow, idx) => (
                <motion.div
                  key={idx}
                  variants={bentoItem}
                  className="panel p-8 flex flex-col"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <workflow.icon size={22} />
                  </div>
                  <p className="text-base font-medium text-on-surface leading-relaxed mb-8 flex-grow">
                    {workflow.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-black text-primary">{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-on-surface">{workflow.title}</p>
                      <p className="text-xs font-medium text-on-surface-variant">Selina operating loop</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 md:py-40 px-6 md:px-10">
          <div className="mx-auto max-w-6xl">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="panel relative overflow-hidden bg-gradient-to-br from-surface-container-low to-surface-container-lowest p-8 text-center md:p-16"
            >
              {/* Decorative Background Icons - Even Subtler */}
              <div className="absolute inset-0 z-0 opacity-[0.015] pointer-events-none">
                <Code2 size={100} className="absolute -left-10 top-10 -rotate-12" />
                <Zap size={80} className="absolute right-10 top-20 rotate-12" />
              </div>

              <div className="relative z-10 mx-auto max-w-3xl">
                <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
                  Ready to join the <br /> 
                  <span className="text-gradient-google">next wave of coding?</span>
                </h2>
                <p className="mb-10 text-lg font-medium leading-relaxed text-on-surface-variant/80">
                  Start a governed local workspace for planning, editing, verifying, and reviewing agentic code changes.
                </p>
                <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                  <Button 
                    size="lg" 
                    variant="filled" 
                    trailingIcon={ArrowRight} 
                    onClick={() => navigate('/login')} 
                    className="h-14 rounded-full px-10 text-lg shadow-xl shadow-primary/20 transition-all duration-500 hover:scale-105 hover:-translate-y-1"
                  >
                    Get Started for Free
                  </Button>
                  <a href="https://github.com/johan-droid/Vibe-Hub" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors duration-300">
                    <Github size={20} />
                    View on GitHub
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer id="status" className="border-t border-outline-variant/30 bg-surface-container-lowest">
        <div className="px-6 py-14 md:px-10 md:py-20 border-b border-outline-variant/20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="label-large mb-4 text-primary">Production Posture</p>
              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-on-surface md:text-5xl">
                Agentic coding with the controls teams expect.
              </h2>
              <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-on-surface-variant">
                Selina combines a Monaco workspace, local Docker execution, MCP diagnostics, approval gates, and run-level audit artifacts so the product feels fast without becoming opaque.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {footerSignals.map((signal) => (
                <div key={signal.label} className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3">
                  <signal.icon size={18} className="text-primary" />
                  <span className="text-sm font-black text-on-surface">{signal.label}</span>
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
                    <span className="block text-2xl font-black tracking-tight text-on-surface">{SELINA_BRAND.productName}</span>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">{SELINA_BRAND.tagline}</span>
                  </div>
                </div>

                <p className="mb-6 max-w-sm text-base font-medium leading-relaxed text-on-surface-variant">
                  {SELINA_BRAND.shortDescription} Built for local-first teams that need visibility into every agent decision.
                </p>

                <div className="mb-8 flex flex-wrap gap-3">
                  {[
                    { icon: Github, href: 'https://github.com/johan-droid/Vibe-Hub', label: 'GitHub' },
                    { icon: Mail, href: 'https://github.com/johan-droid/Vibe-Hub/issues/new', label: 'Contact' },
                    { icon: Globe, href: '#capabilities', label: 'Product overview' },
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
                    <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-google-green' : 'bg-google-red'}`} />
                    <span className="text-xs font-black text-on-surface-variant">
                      {isOnline ? 'Backend ready' : 'Backend degraded'}
                    </span>
                  </div>
                  <span className="rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-xs font-black text-on-surface-variant">
                    {SELINA_BRAND.versionLabel}
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
                                <span className="block text-sm font-black text-on-surface-variant transition-colors group-hover:text-primary">{link.label}</span>
                                <span className="mt-1 block text-xs font-medium leading-relaxed text-on-surface-variant/60">{link.detail}</span>
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

            <div className="mt-14 grid gap-4 border-t border-outline-variant/20 pt-10 md:grid-cols-2 xl:grid-cols-4">
              {footerCommitments.map((item) => (
                <div key={item.title} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon size={19} />
                  </div>
                  <h5 className="text-sm font-black text-on-surface">{item.title}</h5>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-on-surface-variant">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-outline-variant/20 bg-surface-container-low/50">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-center md:flex-row md:px-10 md:text-left">
            <div className="text-sm font-medium text-on-surface-variant/70">
              © {new Date().getFullYear()} {SELINA_BRAND.companyName}. All rights reserved.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
              <a href="/login#terms" className="transition-colors hover:text-primary">Terms</a>
              <a href="/login#privacy" className="transition-colors hover:text-primary">Privacy</a>
              <a href="/login#security-notice" className="transition-colors hover:text-primary">Security</a>
              <span>Local Docker only</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
