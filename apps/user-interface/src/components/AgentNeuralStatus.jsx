import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Brain, Search, PenTool, Terminal, ShieldCheck, Loader2, MessageSquare } from 'lucide-react';

const STATE_CONFIG = {
  idle: { icon: ShieldCheck, color: 'text-emerald-400', label: 'Idle' },
  thinking: { icon: Brain, color: 'text-blue-400', label: 'Thinking' },
  reading: { icon: Search, color: 'text-cyan-400', label: 'Reading' },
  writing: { icon: PenTool, color: 'text-purple-400', label: 'Writing' },
  debating: { icon: MessageSquare, color: 'text-indigo-400', label: 'Debating' },
  debugging: { icon: Terminal, color: 'text-amber-400', label: 'Debugging' },
  verifying: { icon: Loader2, color: 'text-emerald-400', label: 'Verifying' },
};

export default function AgentNeuralStatus() {
  const { agentState, statusMessage, isThinking } = useStore();
  const config = STATE_CONFIG[agentState] || STATE_CONFIG.idle;
  const Icon = config.icon;

  if (!isThinking && agentState === 'idle') return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl"
    >
      <div className={`relative ${config.color}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={agentState}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ type: 'spring', damping: 12 }}
          >
            <Icon size={16} className={agentState === 'verifying' ? 'animate-spin' : ''} />
          </motion.div>
        </AnimatePresence>
        
        {isThinking && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`absolute inset-0 rounded-full bg-current blur-md -z-10`}
          />
        )}
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
            {config.label}
          </span>
          {isThinking && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="w-1 h-1 rounded-full bg-current opacity-40"
                />
              ))}
            </div>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.span
              key={statusMessage}
              initial={{ x: 10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              className="text-[11px] text-white/40 font-medium truncate max-w-[200px]"
            >
              {statusMessage}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
