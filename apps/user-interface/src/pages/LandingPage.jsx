import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowRight, Bot, CheckCircle2, ChevronRight, Github, KeyRound, 
  Layout, ShieldCheck, Zap, Code2, Search, Network, FileCode2, Server, Brain,
  Layers, Lock, Cpu, Globe, Terminal, Activity, MousePointer2, Sparkles, XCircle,
  RefreshCw, MessageSquare, Play, Sparkle, Shield, Command, ZapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.12 } }
};

const features = [
  {
    title: 'Intelligent Swarm',
    desc: 'Specialized AI experts working together to solve complex engineering tasks.',
    icon: Brain,
    color: 'text-google-blue',
    bg: 'bg-google-blue/10'
  },
  {
    title: 'Precision Execution',
    desc: 'Verify every line of code in a secure virtual environment before it hits production.',
    icon: ShieldCheck,
    color: 'text-google-green',
    bg: 'bg-google-green/10'
  },
  {
    title: 'Live Collaboration',
    desc: 'Watch as the AI plans, reasons, and executes your project in real-time.',
    icon: Activity,
    color: 'text-google-yellow',
    bg: 'bg-google-yellow/10'
  },
  {
    title: 'Cloud Ready',
    desc: 'Instantly deploy your applications with native integrations for Render and Vercel.',
    icon: Globe,
    color: 'text-google-red',
    bg: 'bg-google-red/10'
  }
];

function AmbientBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#faf8f5]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-[#faf8f5]" />
      
      {/* Decorative Orbs */}
      <motion.div 
        animate={{ 
          x: [0, 60, 0], 
          y: [0, -40, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-20 top-0 h-[800px] w-[800px] rounded-full bg-google-blue/5 blur-[120px]" 
      />
      <motion.div 
        animate={{ 
          x: [0, -80, 0], 
          y: [0, 60, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -right-40 bottom-0 h-[900px] w-[900px] rounded-full bg-google-red/5 blur-[150px]" 
      />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}

function BrandMark({ size = 'md' }) {
  const sizes = size === 'lg' ? 'h-16 w-16 rounded-3xl' : 'h-12 w-12 rounded-2xl';
  const iconSize = size === 'lg' ? 32 : 24;

  return (
    <div className={`${sizes} flex items-center justify-center bg-primary text-on-primary shadow-2xl shadow-primary/10 relative overflow-hidden group`}>
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
      <Brain size={iconSize} className="relative z-10 transition-transform group-hover:scale-110" />
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const user = useStore(s => s.user);

  const handleLaunch = () => {
    window.location.href = api.getGoogleAuthUrl();
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-24 items-center justify-center px-6">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-[2rem] border border-white/40 bg-white/60 px-8 py-3 backdrop-blur-2xl shadow-xl shadow-black/[0.03]">
        <button onClick={() => navigate('/')} className="flex items-center gap-4 group">
          <BrandMark />
          <div className="text-left">
            <p className="text-xl font-bold tracking-tight text-on-surface">Selina</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-google-blue">Pro Workspace</p>
          </div>
        </button>

        <div className="hidden lg:flex items-center gap-10">
          {['Features', 'Platform', 'Developers', 'Pricing'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-semibold text-on-surface-variant/70 hover:text-google-blue transition-colors">
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Button variant="filled" size="md" onClick={() => navigate('/dashboard')} className="rounded-full px-8 bg-google-blue hover:shadow-lg hover:shadow-google-blue/20 transition-all">
              Go to Workspace
            </Button>
          ) : (
            <>
              <button onClick={handleLaunch} className="hidden sm:block text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors">Sign In</button>
              <Button variant="filled" size="md" onClick={handleLaunch} className="rounded-full px-8 bg-primary shadow-xl shadow-primary/10">
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const health = await api.health();
        setBackendHealth(health);
      } catch (err) {
        setBackendHealth({ status: 'error' });
      }
    };
    fetchHealth();
  }, []);

  const isOnline = backendHealth?.status === 'active';

  return (
    <div className="relative min-h-screen selection:bg-google-blue/10 selection:text-google-blue">
      <AmbientBackground />
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative px-6 pb-24 pt-48 md:px-10 md:pb-40 md:pt-64">
          <motion.div initial="hidden" animate="show" variants={stagger} className="mx-auto max-w-5xl text-center">
            <motion.div variants={fadeUp} className="mb-10 inline-flex items-center gap-3 rounded-full bg-google-blue/5 border border-google-blue/10 px-6 py-2 text-google-blue">
              <Sparkle size={14} className="fill-google-blue" />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">The Next Era of AI Orchestration</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-6xl font-black leading-[1.05] tracking-tight md:text-8xl lg:text-9xl">
              Build everything <br />
              <span className="text-on-surface-variant/20 italic">with confidence.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mx-auto mt-12 max-w-2xl text-lg leading-relaxed text-on-surface-variant/80 md:text-xl font-medium">
              Selina is the world’s most advanced AI-powered workspace. We bridge the gap between complex ideas and production-grade software through an autonomous swarm of specialized experts.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-14 flex flex-col items-center justify-center gap-6 sm:flex-row">
              <Button size="lg" variant="filled" trailingIcon={ArrowRight} onClick={() => window.location.href = api.getGoogleAuthUrl()} className="h-18 px-12 rounded-full text-lg font-bold shadow-2xl shadow-primary/20 bg-primary">
                Try Selina for Free
              </Button>
              <button className="flex items-center gap-3 text-lg font-bold text-on-surface-variant hover:text-on-surface transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg shadow-black/5 ring-1 ring-black/5">
                  <Play size={18} className="ml-1 fill-google-blue text-google-blue" />
                </div>
                Watch Demo
              </button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-20 flex flex-wrap justify-center items-center gap-10 text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant/30">
              <span className="flex items-center gap-2"><Lock size={14} className="text-google-green" /> Military_Grade_Security</span>
              <span className="flex items-center gap-2"><Globe size={14} className="text-google-blue" /> Enterprise_Ready</span>
              <span className="flex items-center gap-2"><Cpu size={14} className="text-google-red" /> Deep_Neural_Processing</span>
            </motion.div>
          </motion.div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="px-6 py-32 md:px-10">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <motion.div 
                  key={i}
                  variants={fadeUp}
                  className="group relative rounded-[3rem] bg-white p-10 shadow-sm ring-1 ring-black/[0.03] transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/[0.05]"
                >
                  <div className={`mb-8 flex h-16 w-16 items-center justify-center rounded-2xl ${f.bg} ${f.color} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                    <f.icon size={28} />
                  </div>
                  <h3 className="text-2xl font-bold text-on-surface mb-4">{f.title}</h3>
                  <p className="text-on-surface-variant/70 leading-relaxed font-medium">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Product Showcase */}
        <section className="px-6 py-20 md:px-10 overflow-hidden">
           <div className="mx-auto max-w-7xl rounded-[4rem] bg-white p-4 shadow-3xl shadow-black/[0.05] ring-1 ring-black/[0.03]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[3.5rem] bg-[#fdfaf5]">
                 {/* Internal Dashboard Mock */}
                 <div className="absolute inset-0 flex flex-col">
                    <div className="flex h-16 items-center justify-between bg-white border-b border-black/[0.03] px-10">
                       <div className="flex gap-2">
                          <div className="h-3 w-3 rounded-full bg-google-red/40" />
                          <div className="h-3 w-3 rounded-full bg-google-yellow/40" />
                          <div className="h-3 w-3 rounded-full bg-google-green/40" />
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="h-2 w-32 rounded-full bg-black/[0.05]" />
                          <div className="h-8 w-8 rounded-full bg-black/[0.05]" />
                       </div>
                    </div>
                    <div className="flex flex-1 p-10 gap-10">
                       <div className="w-1/4 space-y-6">
                          <div className="h-8 w-full rounded-xl bg-black/[0.02]" />
                          <div className="h-8 w-full rounded-xl bg-black/[0.02]" />
                          <div className="h-8 w-full rounded-xl bg-google-blue/10 border border-google-blue/20" />
                          <div className="h-8 w-full rounded-xl bg-black/[0.02]" />
                       </div>
                       <div className="flex-1 rounded-[2.5rem] bg-white shadow-inner flex items-center justify-center">
                          <div className="text-center">
                             <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-google-blue/10 text-google-blue">
                                <Sparkles size={48} />
                             </div>
                             <h4 className="text-2xl font-bold text-on-surface">System Operational</h4>
                             <p className="mt-2 text-on-surface-variant/40 font-medium">Neural gateway v4.1.2 stable</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* CTA Banner */}
        <section className="px-6 py-40 md:px-10">
          <div className="mx-auto max-w-7xl rounded-[4rem] bg-primary p-12 md:p-32 text-center relative overflow-hidden shadow-2xl shadow-primary/20">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]" />
             <div className="relative z-10">
                <h2 className="text-5xl md:text-8xl font-black tracking-tight text-on-primary leading-[0.9] mb-12">The future of software is autonomous.</h2>
                <p className="text-xl text-on-primary/70 mb-16 max-w-2xl mx-auto font-bold uppercase tracking-widest leading-loose">Join thousands of engineers building the next generation of intelligence.</p>
                <Button size="lg" variant="tonal" onClick={() => window.location.href = api.getGoogleAuthUrl()} className="h-22 px-16 rounded-full text-2xl font-bold bg-white text-primary hover:scale-105 transition-all shadow-3xl shadow-white/10">
                  Launch Free Project
                </Button>
             </div>
          </div>
        </section>
      </main>

      {/* Simplified, Premium Footer */}
      <footer className="bg-white border-t border-black/[0.03] px-6 py-32 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-20 lg:grid-cols-[2fr_3fr]">
            <div>
              <div className="mb-12 flex items-center gap-6">
                <BrandMark size="lg" />
                <div>
                  <p className="text-3xl font-black tracking-tighter text-on-surface">Selina</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-google-blue">Advanced Intelligence</p>
                </div>
              </div>
              <p className="max-w-md text-lg leading-relaxed text-on-surface-variant/60 font-medium">
                We are building the infrastructure for autonomous software creation. Join us in redefining what’s possible with artificial intelligence.
              </p>
              <div className="mt-16 flex items-center gap-6">
                 <div className="flex items-center gap-3 rounded-2xl bg-google-green/5 border border-google-green/10 px-5 py-3">
                    <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-google-green animate-pulse' : 'bg-google-red'}`} />
                    <span className="text-xs font-bold text-google-green tracking-widest">{isOnline ? 'OPERATIONAL' : 'SYSTEM_DEGRADED'}</span>
                 </div>
                 <div className="flex items-center gap-3 rounded-2xl bg-black/[0.02] border border-black/[0.05] px-5 py-3">
                    <Command size={14} className="opacity-30" />
                    <span className="text-xs font-bold text-on-surface-variant/40 tracking-widest">v4.1.2_STABLE</span>
                 </div>
              </div>
            </div>

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Solutions',
                  links: ['AI Engineering', 'Workflow Automation', 'Expert Swarms', 'Security Enclaves']
                },
                {
                  title: 'Resources',
                  links: ['Documentation', 'API Reference', 'Community', 'Open Source']
                },
                {
                  title: 'Company',
                  links: ['About Us', 'Careers', 'Privacy Policy', 'Contact']
                }
              ].map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface/40 mb-10">{group.title}</h3>
                  <div className="space-y-6">
                    {group.links.map((link) => (
                      <a key={link} href="#" className="block text-base font-semibold text-on-surface-variant/60 hover:text-google-blue transition-colors">
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-32 flex flex-col justify-between gap-10 border-t border-black/[0.05] pt-14 text-xs font-semibold text-on-surface-variant/30 md:flex-row md:items-center">
            <p>© 2026 Selina Orchestration Labs. Built with Precision.</p>
            <div className="flex gap-10">
              {['Twitter', 'GitHub', 'LinkedIn', 'Discord'].map(i => <a key={i} href="#" className="hover:text-google-blue transition-colors uppercase tracking-[0.2em]">{i}</a>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
