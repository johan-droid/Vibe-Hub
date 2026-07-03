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

  const colorMap = {
    primary: 'bg-primary shadow-primary',
    secondary: 'bg-secondary shadow-secondary',
    tertiary: 'bg-tertiary shadow-tertiary',
    error: 'bg-error shadow-error'
  };

  const containerColorMap = {
    primary: 'bg-primary-container/20',
    secondary: 'bg-secondary-container/20',
    tertiary: 'bg-tertiary-container/20',
    error: 'bg-error-container/20'
  };

  return (
    <div className={`h-1 w-full ${containerColorMap[color]} overflow-hidden relative ${className}`}>
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
        className={`absolute h-full ${colorMap[color]}`}
        style={{
          boxShadow: `0 0 12px hsl(var(--${color}) / 0.4)`
        }}
      />
    </div>
  );
};
