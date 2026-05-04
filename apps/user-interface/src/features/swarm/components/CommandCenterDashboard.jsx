import React, { useState, useEffect } from 'react';
import { 
  Activity, Cpu, ShieldCheck, Zap, Brain, Globe, Lock, Terminal, 
  Layers, Code2, Sparkles, ChevronRight, User, Fingerprint, 
  ActivitySquare, Layout, HardDrive, Shield, Network, CheckCircle2,
  Clock, Gauge, ArrowUpRight, BarChart3, Radio,
  Server, Database, Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';

// ─── Refined Metric Card (Premium Dashboard) ──────────────────────────────────
function MetricCard({ icon: Icon, label, value, status, color, trend }) {
  return (
    <div className="relative group rounded-[3.5rem] bg-white p-12 border border-black/[0.03] shadow-sm hover:shadow-3xl hover:shadow-black/[0.05] transition-all duration-700 overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-10">
          <div className={`flex h-16 w-16 items-center justify-center rounded-[2rem] ${color} shadow-lg shadow-black/[0.02] transition-all duration-700 group-hover:scale-110 group-hover:rotate-6`}>
            <Icon size={28} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-google-green/5 border border-google-green/10">
             <div className="h-1.5 w-1.5 rounded-full bg-google-green animate-pulse" />
             <span className="text-[10px] font-black text-google-green uppercase tracking-widest">{status}</span>
          </div>
        </div>
        <div className="space-y-4">
           <p className="text-[11px] font-black text-on-surface-variant/30 uppercase tracking-[0.4em]">{label}</p>
           <div className="flex items-end justify-between">
              <h3 className="text-5xl font-black text-on-surface tracking-tighter leading-none">{value}</h3>
              {trend && (
                <div className="flex items-center gap-1 text-google-green text-xs font-black">
                   <ArrowUpRight size={14} />
                   <span>{trend}%</span>
                </div>
              )}
           </div>
        </div>
      </div>
      {/* Interactive Background Element */}
      <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-black/[0.01] blur-3xl group-hover:bg-black/[0.02] transition-all duration-700" />
    </div>
  );
}

// ─── Expert Card (Human-Centric Specialization) ───────────────────────────────
function ExpertCard({ icon: Icon, role, name, status, color }) {
  return (
    <div className="group relative rounded-[3rem] bg-white p-10 border border-black/[0.03] shadow-sm hover:shadow-3xl hover:shadow-black/[0.06] transition-all duration-700 flex flex-col items-center text-center">
      <div className={`mb-10 flex h-24 w-24 items-center justify-center rounded-[2.5rem] ${color} transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 shadow-2xl shadow-black/[0.04]`}>
        <Icon size={40} />
      </div>
      <div className="space-y-4">
        <p className="text-[10px] font-black text-google-blue uppercase tracking-[0.4em]">{role}</p>
        <h4 className="text-2xl font-black text-on-surface tracking-tight leading-none">{name}</h4>
        <div className="flex items-center justify-center gap-3 pt-2">
           <div className="h-2 w-2 rounded-full bg-google-green shadow-[0_0_8px_rgba(52,168,83,0.4)]" />
           <span className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-widest">{status}</span>
        </div>
      </div>
      <motion.div 
        className="absolute inset-0 rounded-[3rem] bg-google-blue/[0.02] opacity-0 group-hover:opacity-100 transition-opacity"
        initial={false}
      />
    </div>
  );
}

export default function IntelligenceDashboard() {
  const { isThinking, agentThoughts, vfsStatus } = useStore();
  
  return (
    <div className="flex h-full flex-col bg-[#faf8f5] overflow-y-auto scrollbar-none pb-20">
      {/* Hero / Header Section */}
      <header className="px-16 pt-24 pb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-16 bg-white/40 border-b border-black/[0.02] backdrop-blur-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-google-blue/[0.02] to-transparent pointer-events-none" />
        <div className="space-y-8 relative z-10">
          <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white shadow-xl shadow-black/[0.02] border border-black/[0.03] text-google-blue">
            <Sparkles size={16} className="fill-google-blue animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em]">Operational Control Center</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-on-surface leading-[0.9]">
            System <br />
            <span className="text-on-surface-variant/20 italic">Intelligence.</span>
          </h1>
          <p className="text-xl text-on-surface-variant/60 font-semibold max-w-2xl leading-relaxed">
            Your workspace is performing at peak efficiency. Our autonomous swarm has indexed your project and is standing by for instructions.
          </p>
        </div>
        
        <div className="flex items-center gap-12 pb-6 relative z-10">
           <div className="text-right space-y-2">
              <p className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.4em]">Network Link</p>
              <div className="flex items-center gap-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-google-green/5 text-google-green">
                    <Radio size={20} className="animate-pulse" />
                 </div>
                 <p className="text-3xl font-black text-on-surface tracking-tight">Active</p>
              </div>
           </div>
           <div className="h-16 w-px bg-black/[0.05]" />
           <div className="text-right space-y-2">
              <p className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.4em]">Session Security</p>
              <div className="flex items-center gap-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-google-blue/5 text-google-blue">
                    <Shield size={20} />
                 </div>
                 <p className="text-3xl font-black text-on-surface tracking-tight">Enforced</p>
              </div>
           </div>
        </div>
      </header>

      <div className="flex-1 p-16 space-y-20 max-w-8xl mx-auto w-full">
        {/* Key Metrics Grid */}
        <section className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard 
            icon={Brain} 
            label="Active Reasoners" 
            value="12" 
            status="Ready" 
            trend="14"
            color="bg-google-blue/10 text-google-blue"
          />
          <MetricCard 
            icon={Zap} 
            label="Throughput" 
            value="4.1k" 
            status="Optimal" 
            trend="2"
            color="bg-google-yellow/10 text-google-yellow"
          />
          <MetricCard 
            icon={ShieldCheck} 
            label="Trust Score" 
            value="100%" 
            status="Secured" 
            color="bg-google-green/10 text-google-green"
          />
          <MetricCard 
            icon={BarChart3} 
            label="Efficiency" 
            value="98.2" 
            status="Stable" 
            trend="5"
            color="bg-google-red/10 text-google-red"
          />
        </section>

        {/* Specialized Swarm Section */}
        <section className="space-y-16">
          <div className="flex items-center justify-between px-8">
            <div className="space-y-3">
               <h2 className="text-4xl font-black tracking-tight text-on-surface">The Expert Swarm</h2>
               <p className="text-[11px] font-black text-on-surface-variant/30 uppercase tracking-[0.5em]">Real-time Autonomous Specialization</p>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-black text-on-surface-variant/20 uppercase tracking-widest">Last Update: 2m ago</span>
               <Button variant="tonal" size="sm" className="rounded-2xl px-8 h-12 bg-white shadow-sm border border-black/[0.03]">Re-index Nodes</Button>
            </div>
          </div>
          
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <ExpertCard 
              icon={Server} 
              role="Software Architect" 
              name="Selina_Core" 
              status="Standby" 
              color="bg-google-blue/10 text-google-blue"
            />
            <ExpertCard 
              icon={Layout} 
              role="Product Designer" 
              name="Nova_Vision" 
              status="Ready" 
              color="bg-google-red/10 text-google-red"
            />
            <ExpertCard 
              icon={Terminal} 
              role="Runtime Engine" 
              name="Prism_Execution" 
              status="Active" 
              color="bg-google-green/10 text-google-green"
            />
            <ExpertCard 
              icon={Database} 
              role="Context Manager" 
              name="Vault_Storage" 
              status="Synced" 
              color="bg-google-yellow/10 text-google-yellow"
            />
          </div>
        </section>

        {/* Detailed Insights & Infrastructure */}
        <section className="grid gap-12 lg:grid-cols-[2fr_1fr]">
           <div className="rounded-[4rem] bg-white p-14 border border-black/[0.03] shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="flex items-center justify-between mb-14">
                    <div className="space-y-2">
                       <h3 className="text-3xl font-black text-on-surface tracking-tight">System Events</h3>
                       <p className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-[0.4em]">Live Stream Diagnostic</p>
                    </div>
                    <div className="flex items-center gap-6 px-6 py-3 rounded-2xl bg-[#faf8f5] border border-black/[0.02]">
                       <div className="h-2 w-2 rounded-full bg-google-green animate-pulse shadow-[0_0_8px_rgba(52,168,83,0.4)]" />
                       <span className="text-[10px] font-black text-on-surface-variant/40 tracking-widest uppercase">Stream Active</span>
                    </div>
                 </div>
                 
                 <div className="space-y-8">
                    {[
                      { time: '14:09:18', msg: 'Neural handshake established with global West-1 node.', type: 'info', icon: Globe },
                      { time: '14:08:45', msg: 'Workspace security perimeter successfully enforced.', type: 'success', icon: ShieldCheck },
                      { time: '14:08:22', msg: 'System topology successfully indexed across 243 assets.', type: 'info', icon: Network },
                      { time: '14:07:50', msg: 'Intelligence engine initialized in professional mode.', type: 'system', icon: Sparkles }
                    ].map((log, i) => (
                      <div key={i} className="flex gap-10 items-start group/log">
                         <div className="flex flex-col items-center gap-3 pt-1">
                            <span className="text-[11px] font-mono font-black text-on-surface-variant/20">{log.time.split(':')[1]}:{log.time.split(':')[2]}</span>
                            <div className="w-[1px] h-full bg-black/[0.03] group-last/log:hidden" />
                         </div>
                         <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-4">
                               <log.icon size={14} className="text-on-surface-variant/20" />
                               <span className="text-[15px] font-bold text-on-surface leading-tight group-hover/log:text-google-blue transition-colors duration-500">{log.msg}</span>
                            </div>
                            <div className="mt-6 h-[1px] w-full bg-black/[0.02] group-last/log:hidden" />
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="absolute -left-32 -bottom-32 h-80 w-80 bg-google-blue/5 blur-[100px] rounded-full group-hover:scale-110 transition-transform duration-1000" />
           </div>

           <div className="rounded-[4rem] bg-google-blue p-16 text-white flex flex-col justify-between relative overflow-hidden shadow-3xl shadow-google-blue/20 group">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] group-hover:scale-110 transition-transform duration-1000" />
              <div className="relative z-10 space-y-12">
                 <div className="flex items-center gap-6 opacity-60">
                    <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
                       <Lock size={28} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.5em]">Secure Perimeter</span>
                 </div>
                 <div className="space-y-6">
                    <h3 className="text-4xl font-black tracking-tight leading-tight">Your data is isolated.</h3>
                    <p className="text-lg font-semibold text-white/60 leading-relaxed">
                      We utilize dedicated, encrypted compute clusters to ensure your intellectual property remains private.
                    </p>
                 </div>
                 <Button variant="tonal" size="lg" className="bg-white text-google-blue rounded-[1.5rem] w-full h-18 font-black text-lg shadow-2xl shadow-black/10 hover:scale-105 transition-all">Audit Security</Button>
              </div>
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/5 blur-[80px] rounded-full" />
           </div>
        </section>
      </div>

      {/* Global Metadata Footer */}
      <footer className="h-32 px-16 border-t border-black/[0.02] flex items-center justify-between bg-white/40 backdrop-blur-3xl">
         <div className="flex items-center gap-12">
            <div className="flex items-center gap-4">
               <div className="h-2.5 w-2.5 rounded-full bg-google-green animate-pulse shadow-[0_0_10px_rgba(52,168,83,0.3)]" />
               <span className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em]">Environment Optimized</span>
            </div>
            <div className="h-6 w-px bg-black/[0.05]" />
            <div className="flex items-center gap-4">
               <Cloud size={16} className="text-google-blue opacity-30" />
               <span className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em]">Cloud Sync Active</span>
            </div>
         </div>
         <div className="flex items-center gap-10">
            <div className="text-right">
               <p className="text-[9px] font-black text-on-surface-variant/20 uppercase tracking-widest">Workspace Version</p>
               <p className="text-sm font-black text-on-surface-variant/40">v4.1.2_RELEASE</p>
            </div>
            <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-black/[0.02] border border-black/[0.03]">
               <Fingerprint size={24} className="opacity-10" />
            </div>
         </div>
      </footer>
    </div>
  );
}
