import React from 'react';
import { GitBranch, Globe, Shield, Cpu, Wifi, Gauge } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import AgentNeuralStatus from '../../swarm/components/NeuralStatus';
import { Surface } from './Surface';
import { Chip } from './Chip';

/**
 * StatusBar provides compact runtime, model, and security posture.
 */
export default function StatusBar() {
  const { vfsStatus, effortLevel } = useStore();
  const modelLabel = import.meta.env.VITE_AGENT_MODEL_LABEL || 'Model gateway';

  return (
    <Surface
      elevation={1}
      shape="none"
      className="flex h-10 items-center justify-between border-t border-outline-variant/20 bg-surface-container-low/90 px-6 text-xs text-on-surface-variant backdrop-blur-2xl"
    >
      <div className="flex h-full items-center gap-5">
        <StatusItem icon={GitBranch} label="main" sublabel="branch" color="text-primary" />
        <StatusItem icon={Globe} label="local app" sublabel="origin" />
        <div className="hidden items-center gap-2 lg:flex">
          <Chip icon={Cpu} label={modelLabel} variant="elevated" />
          <Chip icon={Gauge} label={`${effortLevel || 'standard'} effort`} variant="elevated" />
          <Chip icon={Shield} label="protected session" variant="elevated" />
        </div>
      </div>

      <div className="flex h-full items-center gap-6">
        <AgentNeuralStatus compact />
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-primary" />
          <span>{vfsStatus || 'idle'}</span>
        </div>
      </div>
    </Surface>
  );
}

function StatusItem({ icon: Icon, label, sublabel, color = 'text-on-surface-variant' }) {
  return (
    <div className="flex h-full items-center gap-2">
      <Icon size={14} className={`${color} opacity-70`} />
      <span className="font-semibold text-on-surface-variant">{label}</span>
      {sublabel && <span className="text-on-surface-variant/45">{sublabel}</span>}
    </div>
  );
}
