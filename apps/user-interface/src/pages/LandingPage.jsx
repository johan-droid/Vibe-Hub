import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  Brain, Sparkles, ArrowRight, Cpu, Zap, Shield, GitBranch, 
  MessageSquare, Layout, Terminal, Code2, Globe, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid';

const SwarmBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
    <motion.div 
      animate={{ 
        scale: [1, 1.1, 1],
        rotate: [0, 5, 0],
        opacity: [0.3, 0.5, 0.3]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-primary/5 blur-[120px] rounded-full" 
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, -10, 0],
        opacity: [0.2, 0.4, 0.2]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
      className="absolute -bottom-[10%] -right-[10%] w-[70%] h-[70%] bg-secondary/5 blur-[160px] rounded-full" 
    />
    <div className="absolute inset-0 opacity-[0.02] [background-image:linear-gradient(to_right,#888_1px,transparent_1px),linear-gradient(to_bottom,#888_1px,transparent_1px)] [background-size:40px_40px]" />
  </div>
);

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
  
  const navigate = useNavigate();
  const user = useStore(s => s.user);

  const handleLaunch = (provider = 'google') => {
    if (localStorage.getItem('vibe_token')) {
      navigate('/workspace');
    } else {
      window.location.href = provider === 'github' 
        ? api.getGithubAuthUrl() 
        : api.getGoogleAuthUrl();
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      <SwarmBackground />

      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-[100] h-20 glass border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Surface elevation={3} shape="lg" className="w-10 h-10 bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Brain size={22} className="text-on-primary" />
            </Surface>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight">Selina</span>
              <span className="label-large text-primary opacity-60 !text-[8px]">Autonomous_Intelligence_v4.0</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {['Capabilities', 'Intelligence', 'Protocol'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-xs font-mono font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="text" size="sm" className="hidden sm:flex" onClick={() => handleLaunch('google')}>Sign In</Button>
            <Button variant="filled" size="sm" onClick={() => handleLaunch()}>Launch IDE</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-8 flex flex-col items-center text-center">
        <motion.div
          style={{ opacity, scale }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <Surface elevation={1} shape="full" className="inline-flex items-center gap-2.5 px-4 py-1.5 border border-outline-variant/20 mb-8 bg-surface-container-low/40 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="label-medium text-on-surface-variant font-mono uppercase tracking-[0.2em] text-[10px]">Neural_Swarm_Operational</span>
          </Surface>

          <h1 className="display-medium md:text-7xl mb-6 leading-[1.1] tracking-tight font-black">
            The Agentic <br />
            <span className="text-gradient italic">Operating System.</span>
          </h1>

          <p className="text-lg md:text-xl text-on-surface-variant max-w-xl mx-auto leading-relaxed mb-10 opacity-70">
            Selina is a professional-grade autonomous workspace. Powered by a specialized swarm of experts, orchestrated for surgical precision.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" trailingIcon={ArrowRight} className="h-14 px-10 text-base rounded-2xl" onClick={() => handleLaunch()}>
              Get Started
            </Button>
            <Button variant="outlined" size="lg" className="h-14 px-10 text-base rounded-2xl border-outline-variant/50" onClick={() => window.open('https://github.com/johan-droid/Vibe-Hub', '_blank')}>
              View Protocol
            </Button>
          </div>
        </motion.div>

        {/* IDE Preview Bento */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.2, 0, 0, 1] }}
          className="mt-32 w-full max-w-6xl"
        >
          <Surface elevation={1} shape="2xl" className="p-2 border border-outline-variant/30 shadow-2xl bg-surface-container-low/40 backdrop-blur-2xl">
            <Surface elevation={4} shape="xl" className="aspect-[16/9] overflow-hidden border border-outline-variant/20">
               <div className="w-full h-full flex flex-col">
                  {/* Mock IDE Header */}
                  <div className="h-12 border-b border-outline-variant/20 flex items-center px-6 gap-3 bg-surface-container/50">
                    <div className="flex gap-1.5">
                      {[1,2,3].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-on-surface/10" />)}
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 label-large text-primary opacity-40"><Database size={12} /> Local_VFS</div>
                       <div className="flex items-center gap-2 label-large text-secondary opacity-40"><Globe size={12} /> Neural_Sync</div>
                    </div>
                  </div>
                  {/* Mock IDE Body */}
                  <div className="flex-1 flex p-6 gap-6 bg-surface-container-lowest/30">
                    <Surface elevation={1} shape="lg" className="w-64 border border-outline-variant/10 p-4 bg-surface-container/20">
                       <div className="space-y-3">
                          {[1,2,3,4,5].map(i => <div key={i} className="h-2 w-full bg-on-surface/5 rounded-full" />)}
                       </div>
                    </Surface>
                    <div className="flex-1 flex flex-col gap-6">
                       <Surface elevation={1} shape="lg" className="flex-1 border border-outline-variant/10 p-6 bg-surface-container/20">
                          <div className="font-mono text-xs text-primary/40 space-y-2">
                             <div>vibe@hub:~$ agent --init --bento</div>
                             <div className="text-on-surface/30">Initializing Material 3 protocol...</div>
                             <div className="text-secondary/60">✓ Design system generated.</div>
                          </div>
                       </Surface>
                       <Surface elevation={1} shape="lg" className="h-32 border border-outline-variant/10 p-4 bg-surface-container/20" />
                    </div>
                  </div>
               </div>
            </Surface>
          </Surface>
        </motion.div>
      </section>

      {/* Expertise Section */}
      <section id="capabilities" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="headline-small md:text-4xl mb-4 font-bold tracking-tight">Selina: Expert Orchestration.</h2>
            <p className="text-on-surface-variant max-w-lg mx-auto text-base opacity-60">
              Generic models fail at scale. Selina uses a specialized swarm to handle domain-specific logic.
            </p>
          </motion.div>

          <BentoGrid cols={4}>
            {[
              { icon: Code2, title: 'Logic Architect', desc: 'Surgical code generation and recursive pattern analysis.', span: 2, color: 'text-primary' },
              { icon: Layout, title: 'UX Architect', desc: 'Material 3 design systems and motion engineering.', span: 2, color: 'text-secondary' },
              { icon: Zap, title: 'Neural Debugger', desc: 'Root-cause isolation through automated sandboxing.', span: 2, color: 'text-error' },
              { icon: GitBranch, title: 'Git Master', desc: 'Secure repository sync and conflict resolution.', span: 2, color: 'text-tertiary' },
            ].map((feature, i) => (
              <BentoCard key={i} span={feature.span} className="group hover:bg-surface-container-high transition-colors duration-500">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-10 h-10 flex items-center justify-center mb-5 bg-on-surface/5 rounded-xl group-hover:scale-110 transition-transform duration-500">
                    <feature.icon size={20} className={feature.color} />
                  </div>
                  <h3 className="title-small text-lg mb-2 font-bold">{feature.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed opacity-60">{feature.desc}</p>
                </motion.div>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-outline-variant/30 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-4 opacity-50">
            <Brain size={24} className="text-primary" />
            <span className="font-display font-bold text-xl">Selina</span>
          </div>
          <div className="flex gap-12 label-large text-on-surface-variant">
            <a href="#" className="hover:text-primary transition-colors">Documentation</a>
            <a href="#" className="hover:text-primary transition-colors">Security</a>
            <a href="#" className="hover:text-primary transition-colors">API</a>
          </div>
          <div className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-[0.3em] opacity-30">
            © 2026 Agentic Design Systems
          </div>
        </div>
      </footer>
    </div>
  );
}
