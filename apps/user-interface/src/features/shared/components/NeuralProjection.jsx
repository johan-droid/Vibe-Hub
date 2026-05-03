import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';

/**
 * NeuralProjection — Visual Transition Layer
 * Adds an immersive, technical backdrop that reacts to agent state.
 */
export function NeuralProjection() {
  const { isThinking } = useStore();
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--surface-container-lowest)),hsl(var(--surface-container-low))_55%,hsl(var(--surface-container-lowest)))]" />
      
      <AnimatePresence>
        {isThinking && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
             <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-scan" />
             <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-scan-reverse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
