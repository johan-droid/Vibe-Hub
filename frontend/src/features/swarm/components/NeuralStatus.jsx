import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Brain, Search, PenTool, Terminal, ShieldCheck, Loader2, MessageSquare, Palette, Sparkles, Activity } from 'lucide-react';
import { Surface } from '../../shared/components/Surface';

/**
 * AgentNeuralStatus — Material 3 Orchestration Indicator
 * Visualizes the current cognitive phase and active protocol of the agent swarm.
 */
const STATE_CONFIG = {
  idle: { icon: ShieldCheck, color: 'text-secondary', label: 'Idle' },
  thinking: { icon: Brain, color: 'text-primary', label: 'Thinking' },
  planning: { icon: Brain, color: 'text-tertiary', label: 'Planning' },
  scanning: { icon: Search, color: 'text-secondary', label: 'Scanning' },
  designing: { icon: Palette, color: 'text-primary', label: 'Designing' },
  reading: { icon: Search, color: 'text-primary', label: 'Reading' },
  writing: { icon: PenTool, color: 'text-primary', label: 'Writing' },
  debating: { icon: MessageSquare, color: 'text-tertiary', label: 'Debating' },
  debugging: { icon: Terminal, color: 'text-error', label: 'Debugging' },
  verifying: { icon: Activity, color: 'text-secondary', label: 'Verifying' },
};

export default function AgentNeuralStatus({ compact = false }) {
  const { agentState, statusMessage, isThinking } = useStore();
  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle;
  const Icon = config.icon;

  if (!isThinking && agentState === 'idle') return null;

  // Compact Mode: Integrated System Chip
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded-full neural-glass px-3 py-1 hover:bg-surface-container-high/40 transition-all duration-500 group cursor-help"
      >
        <div className="relative flex items-center justify-center">
          <Icon size={11} className={`${config.color} transition-transform duration-500 group-hover:scale-125`} />
          {isThinking && (
            <motion.div
              animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-primary blur-[3px] -z-10"
            />
          )}
        </div>
        <span className="label-small text-on-surface/60 group-hover:text-on-surface transition-colors">
          {config.label}
        </span>
      </div>
    );
  }

  // Full Mode: Floating Orchestration Hub
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="fixed bottom-10 right-10 z-[100]"
      >
        <div className="neural-glass rounded-3xl flex items-center gap-5 px-6 py-4 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.5)] min-w-[300px] overflow-hidden">
          {/* Neural Mesh Background Trace */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <pattern id="neural-mesh" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.5" fill="currentColor" />
                <path d="M2 2 L20 2 M2 2 L2 20" stroke="currentColor" strokeWidth="0.1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#neural-mesh)" />
            </svg>
          </div>
          
          <div className="relative">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={agentState}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon size={22} className={`${config.color} ${agentState === 'verifying' ? 'animate-soft-pulse' : ''}`} />
                </motion.div>
              </AnimatePresence>
            </div>
            
            {isThinking && (
              <motion.div
                animate={{ 
                  scale: [1, 1.8, 1], 
                  opacity: [0.15, 0, 0.15],
                  borderRadius: ["30% 70% 70% 30% / 30% 30% 70% 70%", "60% 40% 30% 70% / 60% 30% 70% 40%", "30% 70% 70% 30% / 30% 30% 70% 70%"] 
                }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute inset-0 bg-primary blur-xl -z-10"
              />
            )}
          </div>

          <div className="flex flex-col flex-1 gap-0.5 min-w-0 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="title-small font-bold tracking-tight text-on-surface">
                {config.label}
              </span>
              {isThinking && (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                      className="w-1 h-1 rounded-full bg-primary"
                    />
                  ))}
                </div>
              )}
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={statusMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2"
              >
                <span className="body-small text-on-surface-variant/60 truncate max-w-[200px]">
                  {statusMessage || 'System standby...'}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-high/30 neural-border">
             <Activity size={14} className="text-on-surface-variant/40" />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

