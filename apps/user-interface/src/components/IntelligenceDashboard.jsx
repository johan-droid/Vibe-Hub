import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export default function IntelligenceDashboard() {
  const { 
    agentState, 
    statusMessage, 
    agentThoughts, 
    effortLevel,
    vfsStatus
  } = useStore();

  // Extract expert name from status message if possible
  const expertName = statusMessage.match(/(\w+)Expert/)?.[1] || 'Orchestrator';

  return (
    <div className="flex flex-col h-full bg-surface border-t border-white/[0.06] p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Neural Dashboard</h3>
        <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] text-primary uppercase font-bold">
          {effortLevel} Mode
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <DashboardCard 
          label="Active Expert" 
          value={expertName} 
          icon={
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          }
        />
        <DashboardCard 
          label="Neural State" 
          value={agentState.toUpperCase()} 
          color={agentState === 'idle' ? 'text-white/40' : 'text-primary'}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="text-[9px] uppercase tracking-tight text-white/30 mb-2 font-medium">Internal Monologue (Last 3)</div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {agentThoughts.slice(-3).reverse().map((thought, i) => (
            <motion.div 
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px] text-white/60 font-mono leading-relaxed"
            >
              {thought.content}
            </motion.div>
          ))}
          {agentThoughts.length === 0 && (
            <div className="flex items-center justify-center h-20 text-[10px] text-white/10 uppercase tracking-widest italic">
              Awaiting reasoning...
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[9px] text-white/40">
          <span>VFS Bridge Status</span>
          <span className={vfsStatus === 'ready' ? 'text-green-400' : 'text-yellow-400'}>{vfsStatus.toUpperCase()}</span>
        </div>
        <div className="mt-2 h-1 bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            animate={{ 
              width: agentState === 'idle' ? '0%' : '100%',
              opacity: agentState === 'idle' ? 0.3 : 1
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ label, value, icon, color = 'text-white/80' }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[9px] text-white/30 uppercase font-medium">{label}</span>
      </div>
      <span className={`text-xs font-bold tracking-tight ${color}`}>{value}</span>
    </div>
  );
}
