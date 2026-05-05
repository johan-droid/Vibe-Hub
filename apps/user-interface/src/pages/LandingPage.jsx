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
import { VibeLogoCompact } from '../components/VibeLogo';

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
    desc: 'Selina remembers how you code and what you like. It gets smarter with every project, just like a real partner.',
    icon: Brain,
    image: '/images/smart_memory.png',
    size: 'large',
    color: 'google-blue'
  },
  {
    title: 'The Universal Link',
    desc: 'Connect to Claude, Cursor, and your favorite tools in seconds.',
    icon: Layout,
    image: '/images/connected_tools.png',
    size: 'medium',
    color: 'google-yellow'
  },
  {
    title: 'Safe Playground',
    desc: 'Run and test code in a secure, private space where nothing can go wrong.',
    icon: ShieldCheck,
    image: '/images/safe_sandbox.png',
    size: 'medium',
    color: 'google-green'
  },
  {
    title: 'Always Protected',
    desc: 'Industrial-grade security keeps your code and data safe 24/7.',
    icon: Lock,
    size: 'small',
    color: 'google-red'
  },
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
                Selina learns your style, connects your tools, and handles the hard parts of building software. It's not just an agent; it's an extension of your mind.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-5">
                <Button size="lg" variant="filled" trailingIcon={ArrowRight} onClick={() => navigate('/login')} className="rounded-full px-10 h-16 text-lg shadow-xl shadow-primary/30 hover:scale-105 transition-transform duration-300">
                  Start Building Now
                </Button>
                <Button size="lg" variant="outlined" leadingIcon={Play} className="rounded-full px-10 h-16 text-lg border-2 hover:bg-surface-container-low transition-colors duration-300">
                  See it in Action
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
                  Join thousands of developers who are already building faster, <br className="hidden md:block" /> 
                  smarter, and with more vibe using Selina.
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
                  <a href="https://github.com/vibe-platform/vibe-hub" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors duration-300">
                    <Github size={20} />
                    View on GitHub
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 bg-surface-container-lowest px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-7xl grid gap-12 md:grid-cols-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-8">
              <BrandMark />
              <span className="text-2xl font-black tracking-tight text-on-surface">Selina</span>
            </div>
            <p className="text-base font-medium text-on-surface-variant max-w-sm leading-relaxed mb-8">
              The agentic workspace built for creators. Ship faster, safer, and with more joy.
            </p>
            <div className="flex gap-5 text-on-surface-variant">
              <a href="https://github.com/vibe-platform/vibe-hub" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors"><Github size={24} /></a>
              <a href="#" className="hover:text-primary transition-colors"><Globe size={24} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-on-surface mb-6">Product</h4>
            <ul className="space-y-4 text-base font-medium text-on-surface-variant">
              <li><a href="#capabilities" className="hover:text-primary transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-on-surface mb-6">Resources</h4>
            <ul className="space-y-4 text-base font-medium text-on-surface-variant">
              <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">API</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-on-surface mb-6">Company</h4>
            <ul className="space-y-4 text-base font-medium text-on-surface-variant">
              <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl mt-24 pt-12 border-t border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-sm font-medium text-on-surface-variant/60">© {new Date().getFullYear()} Selina Intelligence Labs. All rights reserved.</span>
          <div className="flex items-center gap-2 text-sm font-bold text-google-green">
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-google-green' : 'bg-google-red'}`} />
            {isOnline ? 'All systems operational' : 'Partial outage'}
          </div>
        </div>
      </footer>
    </div>
  );
}
