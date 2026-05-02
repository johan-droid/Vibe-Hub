import React from 'react';
import { motion } from 'framer-motion';

/**
 * M3 Linear Progress — Systematic Feedback
 * Used for loading states, background tasks, and agentic thought pulses.
 */
export const LinearProgress = ({ 
  progress, // 0 to 100, if undefined = indeterminate
  className = '',
  color = 'primary'
}) => {
  const isIndeterminate = progress === undefined;

  return (
    <div className={`h-1 w-full bg-${color}-container/20 overflow-hidden relative ${className}`}>
      <motion.div
        initial={isIndeterminate ? { left: '-100%', width: '50%' } : { width: '0%' }}
        animate={isIndeterminate 
          ? { left: '100%' } 
          : { width: `${progress}%` }
        }
        transition={isIndeterminate 
          ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } 
          : { type: 'spring', damping: 25, stiffness: 200 }
        }
        className={`absolute h-full bg-${color} shadow-[0_0_12px_rgba(var(--${color}),0.4)]`}
      />
    </div>
  );
};
