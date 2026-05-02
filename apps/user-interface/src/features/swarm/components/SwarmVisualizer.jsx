import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cpu, Database, Shield, Zap, Code, Search } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { Surface } from '../../shared/components/Surface';

const EXPERTS = [
  { id: 'orchestrator', label: 'Orchestrator', icon: Brain, x: 50, y: 50, color: 'primary' },
  { id: 'code', label: 'Code_Architect', icon: Code, x: 20, y: 25, color: 'secondary' },
  { id: 'search', label: 'Knowledge_Vault', icon: Search, x: 80, y: 25, color: 'tertiary' },
  { id: 'ui', label: 'Visual_Engine', icon: Cpu, x: 80, y: 75, color: 'primary' },
  { id: 'db', label: 'Memory_Grid', icon: Database, x: 20, y: 75, color: 'secondary' },
  { id: 'security', label: 'Sentinel', icon: Shield, x: 50, y: 15, color: 'error' },
];

const CONNECTIONS = [
  ['orchestrator', 'code'],
  ['orchestrator', 'search'],
  ['orchestrator', 'ui'],
  ['orchestrator', 'db'],
  ['orchestrator', 'security'],
  ['code', 'db'],
  ['search', 'code'],
];

export default function SwarmVisualizer() {
  const { neuralStatus, isThinking } = useStore();

  const activeExpertId = useMemo(() => {
    const expert = (neuralStatus.expert || 'orchestrator').toLowerCase();
    if (expert.includes('core') || expert.includes('orchestrator')) return 'orchestrator';
    if (expert.includes('react') || expert.includes('code')) return 'code';
    if (expert.includes('search')) return 'search';
    if (expert.includes('ui')) return 'ui';
    if (expert.includes('db')) return 'db';
    if (expert.includes('security')) return 'security';
    return 'orchestrator';
  }, [neuralStatus.expert]);

  return (
    <div className="relative w-full h-full bg-surface-container-lowest/30 overflow-hidden flex flex-col">
      <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/50">
        <div className="flex items-center gap-3">
          <Zap size={14} className="text-primary" />
          <span className="label-small font-bold uppercase tracking-[0.2em] text-on-surface-variant">Swarm_Neural_Net</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
           <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`} />
           <span className="text-[10px] font-mono font-bold text-primary uppercase">
             {isThinking ? 'Processing' : 'Idle'}
           </span>
        </div>
      </div>

      <div className="flex-1 relative p-12">
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--primary-rgb))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="rgb(var(--secondary-rgb))" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {CONNECTIONS.map(([from, to], i) => {
            const start = EXPERTS.find(e => e.id === from);
            const end = EXPERTS.find(e => e.id === to);
            const isActive = (activeExpertId === from || activeExpertId === to) && isThinking;

            return (
              <g key={`conn-${i}`}>
                <motion.line
                  x1={`${start.x}%`}
                  y1={`${start.y}%`}
                  x2={`${end.x}%`}
                  y2={`${end.y}%`}
                  stroke="url(#connectionGradient)"
                  strokeWidth={isActive ? 2 : 1}
                  initial={{ opacity: 0.1 }}
                  animate={{ 
                    opacity: isActive ? 0.8 : 0.1,
                  }}
                  transition={{ duration: 0.5 }}
                />
                {isActive && (
                  <motion.circle
                    r="2"
                    fill="rgb(var(--primary-rgb))"
                    initial={{ offset: 0 }}
                    animate={{ offset: 1 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <animateMotion 
                      path={`M ${start.x}% ${start.y}% L ${end.x}% ${end.y}%`} 
                      dur="1.5s" 
                      repeatCount="indefinite" 
                    />
                  </motion.circle>
                )}
              </g>
            );
          })}
        </svg>

        {EXPERTS.map((expert) => {
          const isActive = activeExpertId === expert.id;
          const Icon = expert.icon;

          return (
            <motion.div
              key={expert.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${expert.x}%`, top: `${expert.y}%` }}
              animate={{ 
                scale: isActive && isThinking ? 1.15 : 1,
              }}
            >
              <Surface 
                elevation={isActive && isThinking ? 4 : 1}
                shape="xl"
                className={`
                  p-4 flex flex-col items-center gap-2 border transition-all duration-500
                  ${isActive && isThinking 
                    ? 'bg-primary border-primary/50 shadow-lg shadow-primary/40' 
                    : 'bg-surface-container-high border-outline-variant/20 hover:border-primary/30'}
                `}
              >
                <Icon 
                  size={20} 
                  className={isActive && isThinking ? 'text-on-primary' : 'text-on-surface-variant opacity-60'} 
                />
                <span className={`
                  text-[8px] font-mono font-bold uppercase tracking-widest
                  ${isActive && isThinking ? 'text-on-primary' : 'text-on-surface-variant opacity-30'}
                `}>
                  {expert.label}
                </span>
              </Surface>
            </motion.div>
          );
        })}
      </div>

      <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/10">
         <div className="flex flex-col gap-3">
            <span className="label-small font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">Active_Cluster_Telemetry</span>
            <div className="flex gap-3">
               <div className="flex-1 p-3 rounded-xl bg-surface-container-highest border border-outline-variant/10 flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-on-surface-variant opacity-40 uppercase tracking-tight">Active_Expert</span>
                  <span className="label-medium font-mono text-primary truncate uppercase">{neuralStatus.expert}</span>
               </div>
               <div className="flex-1 p-3 rounded-xl bg-surface-container-highest border border-outline-variant/10 flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-on-surface-variant opacity-40 uppercase tracking-tight">Cycle_Phase</span>
                  <span className="label-medium font-mono text-secondary truncate uppercase">{neuralStatus.phase}</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
