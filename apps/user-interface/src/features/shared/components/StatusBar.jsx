import React from 'react';
import { GitBranch, Globe, Shield, Cpu, Wifi } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import AgentNeuralStatus from '../../swarm/components/NeuralStatus';
import { Surface } from './Surface';
import { Chip } from './Chip';
import { motion } from 'framer-motion';

/**
 * StatusBar — Material 3 System Monitor
 * Provides a persistent read-out of the agentic state and environment.
 */
export default function StatusBar() {
  const { vfsStatus } = useStore();

  return (
    <Surface 
      elevation={1} 
      shape="none" 
      className="h-10 border-t border-outline-variant/20 flex items-center justify-between px-6 select-none bg-surface-container-low/80 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-6 h-full">
        <StatusItem icon={GitBranch} label="main" sublabel="branch" color="text-primary" />
        <div className="w-px h-3 bg-outline-variant/30" />
        <StatusItem icon={Globe} label="internal:3000" sublabel="origin" />
        
        <div className="flex items-center gap-3 ml-4">
           <Chip icon={Cpu} label="Gemini 1.5 Flash" variant="elevated" />
           <Chip icon={Shield} label="Sandbox Secure" variant="elevated" />
        </div>
      </div>

      <div className="flex items-center gap-8 h-full">
        <AgentNeuralStatus compact />
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="label-small font-bold text-on-surface uppercase tracking-widest opacity-60">System_Status</span>
            <span className="text-[8px] font-mono text-primary uppercase tracking-tighter">Neural_Sync_Active</span>
          </div>
          <Surface elevation={2} shape="full" className="w-8 h-8 flex items-center justify-center bg-primary/10 border border-primary/20">
             <motion.div
               animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
               transition={{ repeat: Infinity, duration: 3 }}
             >
                <Wifi size={14} className="text-primary" />
             </motion.div>
          </Surface>
        </div>
      </div>
    </Surface>
  );
}

function StatusItem({ icon: Icon, label, sublabel, color = "text-on-surface-variant" }) {
  return (
    <div className="flex items-center gap-2 group cursor-pointer hover:bg-on-surface/5 px-2 h-full transition-colors">
      <Icon size={14} className={`${color} opacity-40 group-hover:opacity-100 transition-all`} />
      <div className="flex items-baseline gap-1.5">
        <span className="label-small font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{label}</span>
        {sublabel && <span className="text-[8px] text-on-surface-variant opacity-30 uppercase tracking-tighter">{sublabel}</span>}
      </div>
    </div>
  );
}
