import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowRight, Bot, CheckCircle2, ChevronRight, Github, KeyRound, 
  Layout, ShieldCheck, Zap, Code2, Search, Network, FileCode2, Server, Brain,
  Layers, Lock, Cpu, Globe, Terminal, Activity, MousePointer2, Sparkles, XCircle,
  RefreshCw, MessageSquare, Play, Shield, Command, Heart, 
  Users, Rocket, Fingerprint, ActivitySquare, Star, ArrowUpRight, Monitor, Laptop
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Button } from '../features/shared/components/Button';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.15 } }
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

const values = [
  { icon: Heart, title: 'Human Centric', desc: 'Designed to augment human creativity, not replace it.' },
  { icon: Shield, title: 'Privacy First', desc: 'Your code and data are isolated in your own secure enclave.' },
  { icon: Rocket, title: 'Zero Friction', desc: 'Move from idea to deployment in minutes, not weeks.' }
];

function AmbientBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#faf8f5]">
      <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-[#faf8f5]" />
      
      {/* Decorative Orbs */}
      <motion.div 
        animate={{ 
          x: [0, 80, 0], 
          y: [0, -60, 0],
          scale: [1, 1.3, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-40 top-0 h-[1000px] w-[1000px] rounded-full bg-google-blue/[0.04] blur-[150px]" 
      />
      <motion.div 
        animate={{ 
          x: [0, -100, 0], 
          y: [0, 80, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute -right-60 bottom-0 h-[1100px] w-[1100px] rounded-full bg-google-red/[0.04] blur-[180px]" 
      />
      
      {/* Texture & Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.12] mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}

function BrandMark({ size = 'md' }) {
  const sizes = size === 'lg' ? 'h-20 w-20 rounded-[2rem]' : 'h-14 w-14 rounded-2xl';
  const iconSize = size === 'lg' ? 40 : 28;

  return (
    <div className={`${sizes} flex items-center justify-center bg-google-blue text-white shadow-3xl shadow-google-blue/20 relative overflow-hidden group`}>
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
      <Brain size={iconSize} className="relative z-10 transition-transform group-hover:scale-110 group-hover:rotate-6" />
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const user = useStore(s => s.user);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex h-32 items-center justify-center px-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-[3rem] border border-white/40 bg-white/60 px-12 py-4 backdrop-blur-3xl shadow-2xl shadow-black/[0.03]">
        <button onClick={() => navigate('/')} className="flex items-center gap-6 group">
          <BrandMark />
          <div className="text-left">
            <p className="text-3xl font-black tracking-tighter text-[#1a1a1a] leading-none">Selina</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-google-blue">Intelligence Labs</p>
          </div>
        </button>

        <div className="hidden lg:flex items-center gap-14">
          {['Platform', 'Experts', 'Security', 'Pricing'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-semibold uppercase tracking-[0.15em] text-[#555555] hover:text-google-blue transition-all">
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <Button variant="filled" size="md" onClick={() => navigate('/dashboard')} className="rounded-2xl px-10 h-14 bg-google-blue shadow-xl shadow-google-blue/10">
              Workspace
            </Button>
          ) : (
            <>
              <button className="hidden sm:block text-sm font-semibold uppercase tracking-wider text-[#666666] hover:text-[#1a1a1a] transition-colors">Sign In</button>
              <Button variant="filled" size="md" onClick={() => window.location.href = api.getGoogleAuthUrl()} className="rounded-2xl px-10 h-14 bg-google-blue shadow-xl shadow-google-blue/20 text-white">
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
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

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
    <div className="relative min-h-screen selection:bg-google-blue/10 selection:text-google-blue font-sans overflow-x-hidden">
      <AmbientBackground />
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative px-10 pb-32 pt-64 md:pb-48 md:pt-80">
          <motion.div style={{ scale: heroScale, opacity: heroOpacity }} initial="hidden" animate="show" variants={stagger} className="mx-auto max-w-7xl text-center relative z-10">
            <motion.div variants={fadeUp} className="mb-16 inline-flex items-center gap-4 rounded-full bg-white shadow-2xl shadow-black/[0.02] border border-black/[0.03] px-10 py-4 text-google-blue">
              <Sparkles size={18} className="fill-google-blue animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em]">The Operating System for Autonomous Engineering</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-8xl font-black leading-[0.9] tracking-tighter md:text-[11rem] lg:text-[13rem] text-[#1a1a1a]">
              Build anything <br />
              <span className="text-google-blue italic">with precision.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mx-auto mt-20 max-w-4xl text-2xl leading-relaxed text-[#4a4a4a] md:text-3xl font-medium">
              Selina coordinates a specialized swarm of autonomous experts to plan, design, and deploy your most ambitious software projects.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-24 flex flex-col items-center justify-center gap-10 sm:flex-row">
              <Button size="lg" variant="filled" trailingIcon={ArrowRight} onClick={() => window.location.href = api.getGoogleAuthUrl()} className="h-24 px-20 rounded-[2rem] text-2xl font-black bg-google-blue shadow-3xl shadow-google-blue/20 hover:scale-105 transition-all">
                Launch Free Project
              </Button>
              <button className="flex items-center gap-6 text-2xl font-bold text-[#666666] hover:text-[#1a1a1a] transition-all group">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-white shadow-3xl shadow-black/[0.05] ring-1 ring-black/[0.02] transition-transform group-hover:scale-110">
                  <Play size={32} className="ml-1 fill-google-blue text-google-blue" />
                </div>
                See how it works
              </button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-40 flex flex-wrap justify-center items-center gap-20 text-[11px] font-bold uppercase tracking-[0.3em] text-[#888888]">
              <span className="flex items-center gap-4 hover:text-on-surface/60 transition-colors"><ShieldCheck size={20} /> Verified Security</span>
              <span className="flex items-center gap-4 hover:text-on-surface/60 transition-colors"><Globe size={20} /> Edge Infrastructure</span>
              <span className="flex items-center gap-4 hover:text-on-surface/60 transition-colors"><Star size={20} /> Global Ranking</span>
            </motion.div>
          </motion.div>
        </section>

        {/* Feature Grid */}
        <section id="platform" className="px-10 py-40 bg-white/40">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid gap-16 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <motion.div 
                  key={i}
                  variants={fadeUp}
                  className="group relative rounded-[4.5rem] bg-white p-14 shadow-sm border border-black/[0.02] transition-all duration-700 hover:-translate-y-4 hover:shadow-3xl hover:shadow-black/[0.06]"
                >
                  <div className={`mb-12 flex h-24 w-24 items-center justify-center rounded-[2.5rem] ${f.bg} ${f.color} transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 shadow-2xl shadow-black/[0.03]`}>
                    <f.icon size={36} />
                  </div>
                  <h3 className="text-4xl font-black text-[#1a1a1a] tracking-tighter mb-8">{f.title}</h3>
                  <p className="text-xl text-[#555555] leading-relaxed font-medium">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Product Spotlight / Showcase */}
        <section className="px-10 py-40 overflow-hidden relative">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[800px] bg-google-blue/[0.02] blur-[150px] rounded-full pointer-events-none" />
           <motion.div 
             initial={{ opacity: 0, y: 100 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
             className="mx-auto max-w-7xl rounded-[6rem] bg-white p-8 shadow-4xl shadow-black/[0.06] border border-black/[0.03] relative z-10"
           >
              <div className="relative aspect-[16/10] overflow-hidden rounded-[5.5rem] bg-[#faf8f5] group">
                 {/* Internal Dashboard Mock */}
                 <div className="absolute inset-0 flex flex-col">
                    <div className="flex h-24 items-center justify-between bg-white border-b border-black/[0.02] px-16">
                       <div className="flex gap-4">
                          <div className="h-4 w-4 rounded-full bg-google-red/40" />
                          <div className="h-4 w-4 rounded-full bg-google-yellow/40" />
                          <div className="h-4 w-4 rounded-full bg-google-green/40" />
                       </div>
                       <div className="flex items-center gap-12">
                          <div className="h-4 w-64 rounded-full bg-black/[0.04]" />
                          <div className="h-12 w-12 rounded-[1.2rem] bg-google-blue/10" />
                       </div>
                    </div>
                    <div className="flex flex-1 p-16 gap-16">
                       <div className="w-1/4 space-y-10">
                          <div className="h-12 w-full rounded-[1.2rem] bg-black/[0.02]" />
                          <div className="h-12 w-full rounded-[1.2rem] bg-black/[0.02]" />
                          <div className="h-12 w-full rounded-[1.2rem] bg-google-blue text-white shadow-2xl shadow-google-blue/20" />
                          <div className="h-12 w-full rounded-[1.2rem] bg-black/[0.02]" />
                       </div>
                       <div className="flex-1 rounded-[4.5rem] bg-white shadow-3xl shadow-black/[0.03] flex items-center justify-center relative overflow-hidden group/inner">
                          <div className="absolute inset-0 bg-gradient-to-br from-google-blue/[0.02] to-transparent opacity-0 group-hover/inner:opacity-100 transition-opacity duration-1000" />
                          <div className="text-center relative z-10">
                             <div className="mx-auto mb-12 flex h-40 w-40 items-center justify-center rounded-[3.5rem] bg-[#faf8f5] text-google-blue shadow-2xl shadow-black/[0.02] border border-black/[0.03] group-hover/inner:scale-110 transition-transform duration-1000">
                                <Sparkles size={72} className="animate-pulse" />
                             </div>
                             <h4 className="text-5xl font-black text-[#1a1a1a] tracking-tighter">Performance Optimal</h4>
                             <p className="mt-6 text-2xl text-[#777777] font-bold uppercase tracking-[0.2em]">Core nodes healthy</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </motion.div>
        </section>

        {/* Values Section */}
        <section className="px-10 py-64 bg-white relative overflow-hidden">
           <div className="absolute bottom-0 right-0 w-1/2 h-[600px] bg-google-red/[0.01] blur-[120px] rounded-full" />
           <div className="mx-auto max-w-7xl relative z-10">
              <div className="text-center mb-32 space-y-8">
                 <h2 className="text-6xl font-black tracking-tighter text-[#1a1a1a]">Built for the next generation.</h2>
                 <p className="text-2xl text-[#555555] font-medium max-w-3xl mx-auto leading-relaxed">We combine autonomous intelligence with professional-grade security to redefine the boundaries of software creation.</p>
              </div>
              <div className="grid gap-20 md:grid-cols-3">
                 {values.map((v, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ y: -10 }}
                      className="flex flex-col items-center text-center space-y-10 p-14 rounded-[4rem] hover:bg-[#faf8f5] transition-all duration-700"
                    >
                       <div className="w-24 h-24 flex items-center justify-center rounded-[2.5rem] bg-white text-google-blue shadow-xl shadow-black/[0.02] border border-black/[0.03]">
                          <v.icon size={40} />
                       </div>
                       <div className="space-y-6">
                          <h3 className="text-3xl font-black text-[#1a1a1a] tracking-tight">{v.title}</h3>
                          <p className="text-xl text-[#555555] font-medium leading-relaxed">{v.desc}</p>
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>
        </section>

        {/* CTA Banner */}
        <section className="px-10 py-40">
          <div className="mx-auto max-w-7xl rounded-[6rem] bg-google-blue p-20 md:p-40 text-center relative overflow-hidden shadow-4xl shadow-google-blue/30 group">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent)] transition-transform duration-1000 group-hover:scale-110" />
             <div className="relative z-10">
                <h2 className="text-7xl md:text-[10rem] font-black tracking-tighter text-white leading-[0.85] mb-20">The future of software is here.</h2>
                <p className="text-3xl text-white/95 mb-24 max-w-4xl mx-auto font-bold uppercase tracking-[0.15em] leading-relaxed">Join thousands of teams building the autonomous era with Selina.</p>
                <Button size="lg" variant="tonal" onClick={() => window.location.href = api.getGoogleAuthUrl()} className="h-28 px-24 rounded-[2.5rem] text-3xl font-black bg-white text-google-blue hover:scale-105 transition-all shadow-4xl shadow-white/20">
                  Launch Your First Project
                </Button>
             </div>
          </div>
        </section>
      </main>

      {/* Professional SaaS Footer */}
      <footer className="bg-[#faf8f5] border-t border-black/[0.03] px-10 py-48 md:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-32 lg:grid-cols-[2fr_3fr]">
            <div className="space-y-16">
              <div className="flex items-center gap-10">
                <BrandMark size="lg" />
                 <div>
                  <p className="text-5xl font-black tracking-tighter text-[#1a1a1a] leading-none">Selina</p>
                  <p className="mt-3 text-[12px] font-black uppercase tracking-[0.6em] text-google-blue">Intelligence Infrastructure</p>
                </div>
              </div>
              <p className="max-w-md text-2xl leading-relaxed text-[#555555] font-medium">
                We are building the definitive operating system for autonomous engineering. Secure, scalable, and stunningly precise.
              </p>
              <div className="flex flex-wrap gap-8">
                 <div className="flex items-center gap-5 rounded-[1.5rem] bg-white border border-black/[0.04] px-8 py-5 shadow-sm group hover:border-google-green/20 transition-all">
                    <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-google-green animate-pulse shadow-[0_0_12px_rgba(52,168,83,0.5)]' : 'bg-google-red'}`} />
                    <span className="text-[11px] font-bold text-google-green tracking-[0.2em]">SYSTEM_OPERATIONAL</span>
                 </div>
                 <div className="flex items-center gap-5 rounded-[1.5rem] bg-white border border-black/[0.04] px-8 py-5 shadow-sm group hover:border-google-blue/20 transition-all">
                    <Fingerprint size={18} className="text-[#777777] group-hover:text-google-blue transition-colors" />
                    <span className="text-[11px] font-bold text-[#666666] tracking-[0.2em]">SECURE_INSTANCE_V4.1</span>
                 </div>
              </div>
            </div>

            <div className="grid gap-20 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Platform',
                  links: ['Architecture', 'Expert Swarms', 'Live Debugging', 'Security Protocols']
                },
                {
                  title: 'Ecosystem',
                  links: ['Documentation', 'API Access', 'Global Nodes', 'Partnerships']
                },
                {
                  title: 'Company',
                  links: ['Mission', 'Privacy Policy', 'Terms Center', 'Support']
                }
              ].map((group) => (
                <div key={group.title}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#888888] mb-14">{group.title}</h3>
                   <div className="space-y-10">
                    {group.links.map((link) => (
                      <a key={link} href="#" className="block text-xl font-semibold text-[#555555] hover:text-google-blue transition-all hover:translate-x-2">
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-48 flex flex-col justify-between gap-16 border-t border-black/[0.08] pt-20 text-xs font-semibold text-[#777777] md:flex-row md:items-center">
            <p className="uppercase tracking-[0.4em]">© 2026 Selina Intelligence Labs. Built with Precision.</p>
            <div className="flex gap-16">
              {['Twitter', 'GitHub', 'LinkedIn', 'Discord'].map(i => <a key={i} href="#" className="hover:text-google-blue transition-colors uppercase tracking-[0.4em] font-black">{i}</a>)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
