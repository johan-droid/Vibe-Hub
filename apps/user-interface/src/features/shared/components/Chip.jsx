import React from 'react';
import { motion } from 'framer-motion';

/**
 * M3 Chip — Compact Metadata Primitive
 * Used for status indicators, tags, and assist actions.
 */
export const Chip = ({ 
  label, 
  icon: Icon, 
  variant = 'tonal', // 'tonal' | 'outlined' | 'elevated'
  color = 'primary', // 'primary' | 'secondary' | 'error'
  className = '',
  onClick
}) => {
  const colorMap = {
    primary: {
      tonal: 'bg-primary-container/20 border-primary/20 text-primary',
      outlined: 'bg-transparent border-outline-variant/30 text-on-surface-variant',
      elevated: 'bg-surface-container-high border-outline-variant/10 text-on-surface shadow-sm'
    },
    secondary: {
      tonal: 'bg-secondary-container/20 border-secondary/20 text-secondary',
      outlined: 'bg-transparent border-outline-variant/30 text-on-surface-variant',
      elevated: 'bg-surface-container-high border-outline-variant/10 text-on-surface shadow-sm'
    },
    error: {
      tonal: 'bg-error-container/20 border-error/20 text-error',
      outlined: 'bg-transparent border-outline-variant/30 text-on-surface-variant',
      elevated: 'bg-surface-container-high border-outline-variant/10 text-on-surface shadow-sm'
    }
  };

  const currentVariant = colorMap[color]?.[variant] || colorMap.primary[variant];

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2.5 px-4 h-8 rounded-full border text-[10px] font-black uppercase tracking-widest
        transition-all duration-500 ease-emphasized
        ${onClick ? 'cursor-pointer hover:bg-on-surface/5 active:bg-on-surface/10' : ''}
        ${currentVariant}
        ${className}
      `}
    >
      {Icon && <Icon size={12} className="opacity-70" />}
      <span>{label}</span>
    </motion.div>
  );
};
