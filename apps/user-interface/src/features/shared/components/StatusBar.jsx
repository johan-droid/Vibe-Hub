import React from 'react';
import { GitBranch, Globe, Shield, Cpu, Wifi, Gauge, Terminal, Activity, Zap } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import AgentNeuralStatus from '../../swarm/components/NeuralStatus';

/**
 * StatusBar provides compact runtime, model, and security posture.
 */
export default function StatusBar() {
  const { vfsStatus, effortLevel } = useStore();
  const modelLabel = import.meta.env.VITE_AGENT_MODEL_LABEL || 'NEURAL_GTWY_v4';

  return (
    <div
      className="flex h-8 items-center justify-between border-t border-outline-variant/10 bg-on-surface/[0.005] px-6 text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant/30"
    >
      <div className="flex h-full items-center gap-6">
        <StatusItem icon={GitBranch} label="MASTER" color="text-google-blue/40" />
        <div className="h-2 w-px bg-outline-variant/10" />
        <StatusItem icon={Globe} label="EDGE_DIST_NODE" color="text-google-green/40" />
        <div className="hidden items-center gap-6 lg:flex">
          <div className="h-2 w-px bg-outline-variant/10" />
          <StatusItem icon={Cpu} label={modelLabel.replace(/ /g, '_').toUpperCase()} color="text-google-red/40" />
          <div className="h-2 w-px bg-outline-variant/10" />
          <StatusItem icon={Zap} label={`${effortLevel || 'STD'}_EFFORT`} color="text-google-yellow/40" />
          <div className="h-2 w-px bg-outline-variant/10" />
          <StatusItem icon={Shield} label="ENC_ENCLAVE_ACTIVE" color="text-google-blue/40" />
        </div>
      </div>

      <div className="flex h-full items-center gap-8">
        <div className="flex items-center gap-3">
           <Activity size={10} className="text-google-green opacity-40" />
           <AgentNeuralStatus compact />
        </div>
        <div className="h-2 w-px bg-outline-variant/10 hidden sm:block" />
        <div className="flex items-center gap-2.5 font-mono">
          <Terminal size={10} className="opacity-40" />
          <span className="opacity-60">{vfsStatus?.toUpperCase() || 'VFS_READY'}</span>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ icon: Icon, label, color = 'text-on-surface-variant/30' }) {
  return (
    <div className="flex h-full items-center gap-2.5">
      <Icon size={11} className={`${color}`} />
      <span className="tracking-[0.35em]">{label}</span>
    </div>
  );
}
