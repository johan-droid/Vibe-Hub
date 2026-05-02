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
      <Surface
        elevation={2}
        shape="full"
        className="flex items-center gap-2.5 px-4 py-1.5 bg-surface-container-highest border border-outline-variant/30 hover:bg-surface-container-highest/80 transition-all duration-500 group cursor-help"
      >
        <div className="relative flex items-center justify-center">
          <Icon size={12} className={`${config.color} transition-transform duration-500 group-hover:scale-125`} />
          {isThinking && (
            <motion.div
              animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-full bg-primary blur-[2px] -z-10"
            />
          )}
        </div>
        <span className="label-small font-bold uppercase tracking-[0.2em] text-on-surface opacity-60 group-hover:opacity-100 transition-opacity">
          {config.label}
        </span>
      </Surface>
    );
  }

  // Full Mode: Floating Orchestration Hub
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
        animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ y: 40, opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        className="fixed bottom-12 right-12 z-[100]"
      >
        <Surface
          elevation={4}
          shape="2xl"
          className="flex items-center gap-6 px-8 py-5 bg-primary-container text-on-primary-container border border-primary/20 shadow-[0_32px_64px_-16px_rgba(var(--primary-rgb),0.4)] min-w-[320px] overflow-hidden"
        >
          {/* Animated Background Pulse */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          
          <div className="relative">
            <Surface 
              elevation={2} 
              shape="full" 
              className="w-14 h-14 flex items-center justify-center bg-on-primary-container/10 border border-on-primary-container/5"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={agentState}
                  initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                  transition={{ type: 'spring', damping: 15 }}
                >
                  <Icon size={28} className={agentState === 'verifying' ? 'animate-pulse' : ''} />
                </motion.div>
              </AnimatePresence>
            </Surface>
            
            {isThinking && (
              <motion.div
                animate={{ scale: [1, 2.5, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="absolute inset-0 rounded-full bg-current blur-2xl -z-10"
              />
            )}
          </div>

          <div className="flex flex-col flex-1 gap-1 min-w-0 relative z-10">
            <div className="flex items-center gap-3">
              <span className="headline-small font-black tracking-tighter uppercase leading-none">
                {config.label}
              </span>
              <AnimatePresence>
                {isThinking && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-1.5"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0], opacity: [0.2, 1, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
                        className="w-1.5 h-1.5 rounded-full bg-on-primary-container"
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={statusMessage}
                initial={{ x: 15, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -15, opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Sparkles size={12} className="opacity-40 shrink-0" />
                <span className="label-medium font-bold opacity-60 truncate">
                  {statusMessage || 'Awaiting instruction...'}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </Surface>
      </motion.div>
    </AnimatePresence>
  );
}
