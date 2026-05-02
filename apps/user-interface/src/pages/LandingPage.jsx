import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  Brain, Sparkles, ArrowRight, Cpu, Zap, Shield, GitBranch, 
  MessageSquare, Layout, Terminal, Code2, Globe, Database
} from 'lucide-react';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid';

const SwarmBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-secondary/10 blur-[140px] rounded-full animate-pulse delay-700" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] [background-image:radial-gradient(circle_at_center,var(--primary)_1px,transparent_1px)] [background-size:40px_40px]" />
  </div>
);

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

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
              <span className="font-display text-lg font-bold tracking-tight">Vibe Hub</span>
              <span className="label-large text-primary opacity-60 !text-[8px]">Autonomous_Swarm_v4.0</span>
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
            <Button variant="text" size="sm" className="hidden sm:flex">Sign In</Button>
            <Button variant="filled" size="sm">Launch IDE</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
          className="max-w-5xl"
        >
          <Surface elevation={2} shape="full" className="inline-flex items-center gap-3 px-6 py-2 border border-outline-variant/30 mb-10 bg-surface-container/40">
            <Sparkles size={16} className="text-primary" />
            <span className="label-large text-on-surface-variant">Mixture of Experts: Now Operational</span>
          </Surface>

          <h1 className="display-large md:text-8xl mb-8 leading-[0.95]">
            Architecting <br />
            <span className="text-gradient">Pure Intelligence.</span>
          </h1>

          <p className="text-xl md:text-2xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed mb-12">
            Vibe Hub is a professional-grade agentic IDE. Powered by a specialized swarm of autonomous experts, orchestrated for surgical precision.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button size="lg" trailingIcon={ArrowRight} className="h-16 px-12 text-lg">
              Initialize Project
            </Button>
            <Button variant="outlined" size="lg" className="h-16 px-12 text-lg">
              View Repository
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
      <section id="capabilities" className="py-32 bg-surface-container-lowest/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-20">
            <span className="label-large text-primary mb-4 block">The Expert Swarm</span>
            <h2 className="headline-medium md:text-5xl mb-6">Specialized Intelligence.</h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
              Generic models fail at complex engineering. Vibe Hub uses a Recurrent Mixture of Experts to solve domain-specific problems.
            </p>
          </div>

          <BentoGrid cols={4}>
            {[
              { icon: Code2, title: 'Code Architect', desc: 'Surgical logic implementation and recursive pattern recognition.', span: 2, color: 'text-primary' },
              { icon: Layout, title: 'UX Specialist', desc: 'Material 3 design system architecture and motion engineering.', span: 2, color: 'text-secondary' },
              { icon: Zap, title: 'Debug Engine', desc: 'Root-cause analysis through automated sandbox execution.', span: 2, color: 'text-error' },
              { icon: GitBranch, title: 'Git Orchestrator', desc: 'Secure repository synchronization and conflict resolution.', span: 2, color: 'text-tertiary' },
            ].map((feature, i) => (
              <BentoCard key={i} span={feature.span} className="relative group">
                <Surface elevation={3} shape="lg" className="w-12 h-12 flex items-center justify-center mb-6 bg-on-surface/5 group-hover:scale-110 transition-transform duration-500 emphasized">
                  <feature.icon size={24} className={feature.color} />
                </Surface>
                <h3 className="title-medium text-xl mb-3">{feature.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{feature.desc}</p>
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
            <span className="font-display font-bold text-xl">Vibe Hub</span>
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
