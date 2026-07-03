import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, X } from 'lucide-react';
import { AnimatedSelinaLogo } from '../../../components/VibeLogo';
import { SELINA_BRAND } from '../../../brand/selina';

function phaseCopy(phase) {
  if (phase === 'parsing_ast') return 'Mapping code structure';
  if (phase === 'drafting_code') return 'Drafting implementation';
  if (phase === 'sandboxing') return 'Running sandbox checks';
  if (phase === 'rollback') return 'Pivoting approach';
  return 'Working on the request';
}

function phaseLogs(events = [], phase) {
  const recent = events
    .slice(-5)
    .map((event) => ({
      timestamp: event.timestamp || Date.now(),
      message: event.summary || event.message || event.title || phaseCopy(phase),
      type: event.status === 'failed' ? 'error' : event.status === 'completed' ? 'success' : 'info',
    }))
    .filter((event) => event.message);

  if (recent.length > 0) return recent;

  return [{
    timestamp: Date.now(),
    message: phaseCopy(phase),
    type: 'info',
  }];
}

export default function AgentActionOverlay({ isThinking, neuralStatus, events = [], onDismiss }) {
  const logs = phaseLogs(events, neuralStatus?.phase);

  return (
    <AnimatePresence>
      {isThinking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative mx-4 w-full max-w-md rounded-lg border border-white/10 bg-[#0D1117]/96 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={onDismiss}
              className="absolute right-3 top-3 rounded-md p-2 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Dismiss overlay"
            >
              <X size={16} />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
                <AnimatedSelinaLogo size={84} />
              </div>

              <h3 className="text-xl font-black tracking-tight text-white">{SELINA_BRAND.productName} is working</h3>
              <p className="mt-2 text-sm font-medium text-white/45">{phaseCopy(neuralStatus?.phase)}</p>

              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="text-[#43F3C5]" size={14} />
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#43F3C5]">Live stream</span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {logs.map((log, index) => (
                    <motion.div
                      key={`${log.message}-${index}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.12 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-white/25">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={log.type === 'success' ? 'text-[#A7FFE9]' : 'text-white/65'}>{log.message}</span>
                    </motion.div>
                  ))}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                    <span className="text-white/25">{new Date().toLocaleTimeString()}</span>
                    <span className="flex items-center gap-1 text-[#43F3C5]">
                      {[0, 1, 2].map((delay) => (
                        <motion.span
                          key={delay}
                          className="h-1.5 w-1.5 rounded-full bg-[#43F3C5]"
                          animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: delay * 0.12 }}
                        />
                      ))}
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
