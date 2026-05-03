import React from 'react';
import { Cpu, Zap, Activity, Brain, Server, Globe, ActivitySquare, ShieldCheck } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { BentoGrid, BentoCard } from '../../shared/components/BentoGrid';
import { Surface } from '../../shared/components/Surface';
import { motion } from 'framer-motion';
import SwarmVisualizer from './SwarmVisualizer';

/**
 * IntelligenceDashboard — Material 3 Bento Showcase
 * Visualizes the neural throughput and system health of the agent swarm.
 */
export default function IntelligenceDashboard() {
  const { neuralStatus, workflowState } = useStore();

  const metrics = [
    {
      label: 'GitHub Actions',
      value: workflowState?.status === 'triggered' ? 'Queued' : (workflowState?.status === 'completed' ? 'Done' : 'Idle'),
      sub: workflowState?.conclusion || 'Execution Engine',
      icon: ShieldCheck,
      color: workflowState?.conclusion === 'failure' ? 'text-error' : (workflowState?.conclusion === 'success' ? 'text-primary' : 'text-on-surface-variant'),
      span: 3,
      progress: workflowState?.status === 'triggered' ? 50 : (workflowState?.status === 'completed' ? 100 : 0)
    },
    { 
      label: 'Neural Load', 
      value: neuralStatus.expert === 'Orchestrator' ? '12%' : '84%', 
      sub: 'Tensors/sec',
      icon: Brain,
      color: 'text-primary',
      span: 2,
      progress: 64
    },
    { 
      label: 'Gateway', 
      value: '2ms', 
      sub: 'Latency',
      icon: Globe,
      color: 'text-secondary',
      span: 1,
      progress: 15
    },
    { 
      label: 'Cores', 
      value: '16/16', 
      sub: 'Active Nodes',
      icon: Cpu,
      color: 'text-tertiary',
      span: 1,
      progress: 100
    },
    { 
      label: 'Throughput', 
      value: '1.2 GB/s', 
      sub: 'VFS Sync',
      icon: Zap,
      color: 'text-primary',
      span: 1,
      progress: 45
    },
    { 
      label: 'Uptime', 
      value: '99.9%', 
      sub: 'Availability',
      icon: Activity,
      color: 'text-secondary',
      span: 2,
      progress: 99
    }
  ];

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto scrollbar-none">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="headline-small font-bold text-on-surface tracking-tight">Intelligence</h2>
          <p className="label-medium text-on-surface-variant opacity-60">Neural Pathway Telemetry</p>
        </div>
        <Surface elevation={1} shape="full" className="px-4 py-1.5 border border-outline-variant/30 flex items-center gap-2.5 bg-surface-container-high/40">
           <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
           <span className="label-small font-bold text-on-surface uppercase tracking-widest opacity-60">System Stable</span>
        </Surface>
      </div>

      <BentoGrid cols={3} gap="md" className="p-0">
        {metrics.map((m, i) => (
          <BentoCard 
            key={i} 
            span={m.span} 
            elevation={1}
            className="flex flex-col justify-between group overflow-hidden border border-outline-variant/10 hover:border-primary/30 transition-all duration-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="label-small font-bold uppercase tracking-widest text-on-surface-variant opacity-40 group-hover:opacity-100 transition-opacity">
                  {m.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="display-small font-black text-on-surface tracking-tighter">{m.value}</span>
                  <span className="label-small text-on-surface-variant font-bold opacity-30">{m.sub}</span>
                </div>
              </div>
              <Surface elevation={2} shape="xl" className="p-3 bg-surface-container-highest group-hover:bg-primary/10 transition-colors duration-700">
                <m.icon size={24} className={`${m.color} transition-transform duration-700 group-hover:scale-110`} />
              </Surface>
            </div>

            <div className="mt-8 space-y-2">
               <div className="flex justify-between label-small text-on-surface-variant opacity-40">
                  <span>Capacity</span>
                  <span>{m.progress}%</span>
               </div>
               <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${m.progress}%` }}
                    transition={{ duration: 1.5, ease: [0.2, 0, 0, 1] }}
                    className={`h-full transition-all duration-1000 ${m.color.replace('text-', 'bg-')}`}
                  />
               </div>
            </div>
          </BentoCard>
        ))}
      </BentoGrid>
      
      <Surface elevation={2} shape="2xl" className="h-[400px] border border-outline-variant/20 bg-surface-container-low overflow-hidden">
        <SwarmVisualizer />
      </Surface>
    </div>
  );
}
