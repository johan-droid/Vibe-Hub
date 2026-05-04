import React from 'react';
import { GitBranch, Globe, Shield, Cpu, Wifi, Gauge, Terminal, Activity, Zap, CheckCircle2, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import AgentNeuralStatus from '../../swarm/components/NeuralStatus';

/**
 * StatusBar — Premium workspace health and activity monitoring.
 * Refined for a professional "common people" perspective.
 */
export default function StatusBar() {
  const { vfsStatus, effortLevel } = useStore();
  const modelLabel = import.meta.env.VITE_AGENT_MODEL_LABEL || 'Neural_Hub_v4';

  return (
    <div
      className="flex h-10 items-center justify-between border-t border-black/[0.03] bg-white px-8 text-[9px] font-black uppercase tracking-[0.4em] text-on-surface-variant/20"
    >
      <div className="flex h-full items-center gap-10">
        <StatusItem icon={GitBranch} label="Main" color="text-google-blue" />
        <div className="h-3 w-px bg-black/[0.05]" />
        <StatusItem icon={Globe} label="Global Network" color="text-google-green" />
        
        <div className="hidden items-center gap-10 lg:flex">
          <div className="h-3 w-px bg-black/[0.05]" />
          <StatusItem icon={Cpu} label={modelLabel} color="text-google-red" />
          <div className="h-3 w-px bg-black/[0.05]" />
          <StatusItem icon={Lock} label="Secure Connection" color="text-google-blue" />
        </div>
      </div>

      <div className="flex h-full items-center gap-10">
        {/* Neural Link Status */}
        <div className="flex items-center gap-4 bg-google-green/5 px-4 py-1.5 rounded-full border border-google-green/10">
           <div className="relative">
              <CheckCircle2 size={11} className="text-google-green" />
              <motion.div 
                animate={{ opacity: [0.2, 0.6, 0.2] }} 
                transition={{ repeat: Infinity, duration: 2 }} 
                className="absolute inset-0 bg-google-green blur-[4px] rounded-full" 
              />
           </div>
           <span className="text-google-green tracking-widest">Workspace Healthy</span>
        </div>

        <div className="h-3 w-px bg-black/[0.05] hidden sm:block" />
        
        <div className="flex items-center gap-4">
          <Terminal size={12} className="opacity-40" />
          <span className="opacity-60">{vfsStatus === 'ready' ? 'System Optimized' : vfsStatus?.toUpperCase() || 'Syncing...'}</span>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ icon: Icon, label, color = 'text-on-surface-variant' }) {
  return (
    <div className="flex h-full items-center gap-3 group transition-all duration-500">
      <Icon size={12} className={`${color} opacity-40 group-hover:opacity-100 transition-opacity`} />
      <span className="tracking-[0.4em] group-hover:text-on-surface transition-colors">{label}</span>
    </div>
  );
}
