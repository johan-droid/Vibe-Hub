import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import {
  Cpu, Zap, Shield, GitBranch, Code2, Eye, Terminal,
  ArrowRight, Sparkles, Brain, MessageSquareMore, FileSearch,
  MemoryStick, Layers, Route, Bot, Workflow, CheckCircle2,
  MousePointer2, Network, Search, Database, Globe
} from 'lucide-react';
import { api } from '../services/api';

// ===== COMPONENTS =====

const SwarmBackground = () => {
  const particles = Array.from({ length: 40 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-blue-500/20"
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: Math.random() * window.innerHeight 
          }}
          animate={{
            x: [null, Math.random() * window.innerWidth],
            y: [null, Math.random() * window.innerHeight],
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            filter: `blur(${Math.random() * 4}px)`,
          }}
        />
      ))}
    </div>
  );
};

const SectionHeader = ({ tag, title, subtitle }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="text-center mb-16"
  >
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">
      <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
      {tag}
    </div>
    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{title}</h2>
    <p className="text-white/30 text-lg max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
  </motion.div>
);

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="group relative p-8 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500"
  >
    <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative z-10">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500/10 transition-all duration-500">
        <Icon size={24} className="text-white/40 group-hover:text-blue-400 transition-colors" />
      </div>
      <h3 className="text-xl font-bold mb-3 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-white/25 group-hover:text-white/40 transition-colors leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const TerminalMockup = () => {
  const [lines, setLines] = useState([]);
  const fullLines = [
    { text: "vibe@brain:~$ ", type: "prompt" },
    { text: "npm install @webcontainer/api", type: "cmd" },
    { text: "📦 Installing dependencies...", type: "system" },
    { text: "✅ node_modules initialized.", type: "success" },
    { text: "vibe@brain:~$ ", type: "prompt" },
    { text: "swarm --task 'add dark mode to header'", type: "cmd" },
    { text: "🧠 Router: Dispatching to UI Expert", type: "brain" },
    { text: "📂 Reading src/components/Header.jsx...", type: "agent" },
    { text: "📝 Applying surgical edit (+12/-4 lines)", type: "agent" },
    { text: "▶️ npm run build", type: "cmd" },
    { text: "✓ built in 1.4s", type: "system" },
    { text: "✅ dark_mode_toggle.js implemented.", type: "success" },
  ];

  useEffect(() => {
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < fullLines.length) {
        setLines(prev => [...prev, fullLines[currentIdx]]);
        currentIdx++;
      } else {
        setTimeout(() => {
          setLines([]);
          currentIdx = 0;
        }, 3000);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-[11px] leading-relaxed h-full overflow-hidden">
      <AnimatePresence>
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-2 mb-1"
          >
            {line.type === "prompt" && <span className="text-emerald-400 font-bold">{line.text}</span>}
            {line.type === "cmd" && <span className="text-white">{line.text}</span>}
            {line.type === "system" && <span className="text-white/20 italic">{line.text}</span>}
            {line.type === "success" && <span className="text-emerald-500/80">{line.text}</span>}
            {line.type === "brain" && <span className="text-blue-400 font-bold">{line.text}</span>}
            {line.type === "agent" && <span className="text-white/40">{line.text}</span>}
            {line.type !== "prompt" && line.type !== "cmd" && line.type !== "system" && line.type !== "success" && line.type !== "brain" && line.type !== "agent" && line.text}
          </motion.div>
        ))}
      </AnimatePresence>
      <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-1.5 h-3.5 bg-blue-500 align-middle ml-1" />
    </div>
  );
};

// ===== MAIN PAGE =====

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  const agents = [
    { name: 'Code Expert', icon: Code2, color: 'text-blue-400', bg: 'bg-blue-400/10', desc: 'Surgical logic & pattern recognition' },
    { name: 'UI Expert', icon: Eye, color: 'text-purple-400', bg: 'bg-purple-400/10', desc: 'Material You & Motion specialist' },
    { name: 'Debug Expert', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10', desc: 'Root-cause analysis & triage' },
    { name: 'Git Expert', icon: GitBranch, color: 'text-emerald-400', bg: 'bg-emerald-400/10', desc: 'Secure repository orchestration' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 selection:text-blue-200">
      <SwarmBackground />

      {/* ===== NAVIGATION ===== */}
      <nav className="fixed top-0 inset-x-0 z-[100] h-20 border-b border-white/[0.04] backdrop-blur-md bg-black/20">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px]">
              <div className="w-full h-full bg-[#050505] rounded-[11px] flex items-center justify-center">
                <Brain size={20} className="text-blue-400" />
              </div>
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight leading-none mb-1">Vibe Hub</div>
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Autonomous Swarm v3.1</div>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10">
            {['Expertise', 'Intelligence', 'Workflow', 'Open Source'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-white/40 hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <a href="https://github.com" className="p-2 transition-colors hover:text-blue-400 text-white/40">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <button className="h-10 px-6 bg-white text-black rounded-full text-sm font-bold hover:bg-zinc-200 transition-colors">
              Launch IDE
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen pt-40 flex flex-col items-center px-8 overflow-hidden">
        <motion.div style={{ scale, opacity }} className="relative z-10 text-center max-w-5xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold uppercase tracking-widest mb-10"
          >
            <Sparkles size={14} />
            The Autonomous Swarm is here
          </motion.div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
            Code with an <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-500">Autonomous Brain.</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/30 max-w-2xl mx-auto leading-relaxed mb-14">
            Vibe Hub is a browser-native IDE powered by a server-side Mixture of Experts. 
            Four specialist agents, one unified memory, total precision.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <button className="h-14 px-10 bg-blue-600 rounded-full text-lg font-bold hover:bg-blue-500 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] transition-all flex items-center gap-3 group">
              Get Started for Free <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="h-14 px-10 rounded-full border border-white/10 hover:bg-white/5 transition-all text-lg font-bold">
              View on GitHub
            </button>
          </div>
        </motion.div>

        {/* IDE PREVIEW MOCKUP */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="relative w-full max-w-6xl aspect-[16/10] bg-[#0A0A0A] rounded-t-[3rem] p-4 border-x border-t border-white/[0.08] shadow-[0_-20px_100px_-20px_rgba(59,130,246,0.2)]"
        >
          <div className="w-full h-full rounded-[2rem] bg-black overflow-hidden border border-white/[0.05] relative">
            {/* Header */}
            <div className="h-12 border-b border-white/[0.05] flex items-center px-6 gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-4 text-[10px] font-mono text-white/20">
                <div className="flex items-center gap-1.5"><Database size={10} /> Local VFS</div>
                <div className="flex items-center gap-1.5"><Globe size={10} /> server-bridge:3001</div>
              </div>
            </div>
            
            {/* Body */}
            <div className="flex h-[calc(100%-3rem)]">
              <div className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-6">
                <Search size={18} className="text-white/20" />
                <Code2 size={18} className="text-blue-500" />
                <GitBranch size={18} className="text-white/20" />
                <Settings size={18} className="text-white/20" />
              </div>
              <div className="flex-1 p-8">
                <div className="flex gap-8 h-full">
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="h-8 w-48 bg-white/5 rounded-md" />
                    <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/5 p-4 relative overflow-hidden">
                      <TerminalMockup />
                    </div>
                  </div>
                  <div className="w-80 border-l border-white/5 pl-8 flex flex-col gap-4">
                    <div className="h-8 w-full bg-white/5 rounded-md flex items-center px-3 gap-2">
                       <Bot size={14} className="text-blue-400" />
                       <span className="text-[10px] text-white/40">Expert Chat</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                       <div className="p-3 bg-white/[0.03] rounded-lg border border-white/5">
                          <div className="text-[9px] text-white/20 mb-1">CODE EXPERT</div>
                          <div className="text-[10px] text-white/40 leading-relaxed">I've analyzed your component. Applying surgical edits to fix the prop mismatch...</div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===== EXPERTISE SECTION ===== */}
      <section id="expertise" className="py-32 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-8">
          <SectionHeader 
            tag="The Swarm"
            title="A specialized expert for every domain."
            subtitle="Vibe Hub doesn't use a single generic prompt. We route your request to a highly tuned specialist with a focused toolset."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {agents.map((agent, i) => (
              <FeatureCard 
                key={agent.name}
                icon={agent.icon}
                title={agent.name}
                desc={agent.desc}
                delay={i * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTELLIGENCE DEEP DIVE ===== */}
      <section id="intelligence" className="py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[800px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-6">
                Brain v3.1 Logic
              </div>
              <h2 className="text-5xl font-bold tracking-tight mb-8 leading-[1.1]">The Brain iterates, <br/> you orchestrate.</h2>
              
              <div className="space-y-8">
                {[
                  { icon: FileSearch, title: 'Read-First Protocol', desc: 'No expert ever "guesses". Files are indexed and read before any logic is proposed.' },
                  { icon: MessageSquareMore, title: 'Clarification Engine', desc: 'If the goal is ambiguous, the Brain asks for precision instead of hallucinating.' },
                  { icon: Workflow, title: 'Multi-File Planning', desc: 'Tasks spanning multiple files trigger a formal plan. Review the roadmap before the first line is written.' },
                  { icon: MemoryStick, title: 'Pattern Recognition', desc: 'The Brain Journal learns your unique coding style and repository patterns automatically.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/5 flex-shrink-0">
                      <item.icon size={18} className="text-white/40" />
                    </div>
                    <div>
                      <h4 className="font-bold mb-1 text-white/80 group-hover:text-white transition-colors">{item.title}</h4>
                      <p className="text-sm text-white/25 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full lg:w-auto">
              <div className="p-1 rounded-[3rem] bg-gradient-to-br from-blue-500/20 via-white/5 to-purple-500/20 shadow-2xl">
                <div className="bg-[#0A0A0A] rounded-[2.8rem] p-10 relative overflow-hidden">
                   {/* Abstract routing visual */}
                   <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex flex-wrap gap-4">
                         {Array.from({ length: 100 }).map((_, i) => (
                           <div key={i} className="w-2 h-2 rounded-full bg-blue-500" />
                         ))}
                      </div>
                   </div>
                   
                   <div className="relative z-10 text-center">
                      <div className="w-20 h-20 rounded-3xl bg-blue-600 mx-auto flex items-center justify-center mb-6 shadow-[0_0_50px_-10px_rgba(37,99,235,1)]">
                         <Route size={32} />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">MoE Router</h3>
                      <p className="text-white/30 text-sm mb-10">Intelligent Workload Distribution</p>
                      
                      <div className="space-y-4">
                         <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                            <span className="text-xs text-white/40 uppercase tracking-widest">Incoming Prompt</span>
                            <span className="text-xs font-mono text-blue-400">Analyzing...</span>
                         </div>
                         <div className="flex justify-center gap-2">
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-transparent" />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400">UI Expert</div>
                            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-white/10 opacity-30">Code Expert</div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PERSISTENCE & PRIVACY ===== */}
      <section className="py-32 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-8">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 p-12 rounded-[3.5rem] bg-white/[0.02] border border-white/5 overflow-hidden relative group">
                 <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/5 blur-[100px] group-hover:bg-emerald-500/10 transition-colors" />
                 <h3 className="text-4xl font-bold mb-6">Secure by Design. <br/> Private by Default.</h3>
                 <p className="text-xl text-white/30 leading-relaxed mb-10 max-w-xl">
                   Your API keys and code never touch the AI directly. Vibe Hub acts as an encrypted proxy, executing file system operations strictly on your local machine while keeping the Brain centralized for speed.
                 </p>
                 <div className="flex gap-8">
                    <div>
                       <div className="text-emerald-400 font-bold text-3xl mb-1">0ms</div>
                       <div className="text-[10px] text-white/20 uppercase tracking-widest">Key Exposure</div>
                    </div>
                    <div>
                       <div className="text-blue-400 font-bold text-3xl mb-1">End-to-End</div>
                       <div className="text-[10px] text-white/20 uppercase tracking-widest">Communication</div>
                    </div>
                 </div>
              </div>
              <div className="p-12 rounded-[3.5rem] bg-gradient-to-br from-indigo-600 to-blue-700 relative overflow-hidden group">
                 <div className="relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                      <Layers size={28} className="text-white" />
                   </div>
                   <h3 className="text-3xl font-bold mb-4">Surgical <br/> Diff Logic.</h3>
                   <p className="text-white/50 leading-relaxed">
                     The Swarm generates search/replace blocks, reducing token usage by up to 80% compared to full-file writes.
                   </p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* ===== FOOTER CALL TO ACTION ===== */}
      <section id="get-started" className="py-40 relative">
         <div className="max-w-4xl mx-auto px-8 text-center relative z-10">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-10">Ready to Vibe?</h2>
            <p className="text-xl text-white/30 mb-20 leading-relaxed">Join the next generation of engineers working with an autonomous swarm. No more generic chat bots. Real IDE depth.</p>
            
            <div className="max-w-md mx-auto space-y-4">
              <button className="w-full h-16 bg-white text-black rounded-2xl font-bold text-lg flex items-center justify-center gap-4 hover:bg-zinc-200 transition-all active:scale-[0.98]">
                 <svg width="24" height="24" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                 Sign in with Google
              </button>
              <button className="w-full h-16 bg-zinc-900 border border-white/10 rounded-2xl font-bold text-lg flex items-center justify-center gap-4 hover:bg-zinc-800 transition-all active:scale-[0.98]">
                 <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                 Sign in with GitHub
              </button>
            </div>
         </div>
         
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      </section>

      <footer className="py-20 border-t border-white/[0.04]">
         <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-4 grayscale opacity-40">
               <Brain size={24} />
               <span className="font-bold text-xl">Vibe Hub</span>
            </div>
            <div className="flex gap-12 text-sm font-medium text-white/20">
               <a href="#" className="hover:text-white transition-colors">Documentation</a>
               <a href="#" className="hover:text-white transition-colors">Security</a>
               <a href="#" className="hover:text-white transition-colors">Privacy</a>
            </div>
            <div className="text-[10px] font-mono text-white/10 uppercase tracking-[0.3em]">
               State of the Art Agentic Runtime
            </div>
         </div>
      </footer>
    </div>
  );
}

// Sub-components used for visual clarity
const Settings = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
