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
    <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary-rgb),0.03),transparent)]" />
      <div className="absolute inset-0 opacity-[0.03] grayscale invert dark:invert-0" 
           style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
      
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
