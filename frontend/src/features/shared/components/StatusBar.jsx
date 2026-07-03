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
    <div className="flex h-8 items-center justify-between border-t border-outline-variant bg-surface-container-lowest px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant md:px-6">
      <div className="flex h-full items-center gap-5">
        <StatusItem icon={GitBranch} label="Main" color="text-primary" />
        <div className="h-3 w-px bg-outline-variant" />
        <StatusItem icon={Globe} label="Global Network" color="text-google-green" />
        
        <div className="hidden items-center gap-5 lg:flex">
          <div className="h-3 w-px bg-outline-variant" />
          <StatusItem icon={Cpu} label={modelLabel} color="text-google-red" />
          <div className="h-3 w-px bg-outline-variant" />
          <StatusItem icon={Lock} label="Secure Connection" color="text-primary" />
        </div>
      </div>

      <div className="flex h-full items-center gap-5">
        <div className="flex items-center gap-2 rounded-full border border-google-green/10 bg-google-green/5 px-3 py-1 text-google-green">
           <div className="relative">
              <CheckCircle2 size={11} className="text-google-green" />
              <motion.div 
                animate={{ opacity: [0.2, 0.6, 0.2] }} 
                transition={{ repeat: Infinity, duration: 2 }} 
                className="absolute inset-0 bg-google-green blur-[4px] rounded-full" 
              />
           </div>
           <span>Workspace Healthy</span>
        </div>

        <div className="hidden h-3 w-px bg-outline-variant sm:block" />
        
        <div className="flex items-center gap-4">
          <Terminal size={12} className="opacity-70" />
          <span>{vfsStatus === 'ready' ? 'System Ready' : vfsStatus?.toUpperCase() || 'Syncing...'}</span>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ icon: Icon, label, color = 'text-on-surface-variant' }) {
  return (
    <div className="group flex h-full items-center gap-2 transition-colors">
      <Icon size={12} className={`${color} opacity-80`} />
      <span className="group-hover:text-on-surface">{label}</span>
    </div>
  );
}
