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
  const variants = {
    tonal: `bg-${color}-container/20 border-${color}/20 text-${color}`,
    outlined: `bg-transparent border-outline-variant/30 text-on-surface-variant`,
    elevated: `bg-surface-container-high border-outline-variant/10 text-on-surface shadow-sm`
  };

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2.5 px-4 h-8 rounded-full border text-[10px] font-black uppercase tracking-widest
        transition-all duration-500 ease-emphasized
        ${onClick ? 'cursor-pointer hover:bg-on-surface/5 active:bg-on-surface/10' : ''}
        ${variants[variant]}
        ${className}
      `}
    >
      {Icon && <Icon size={12} className="opacity-70" />}
      <span>{label}</span>
    </motion.div>
  );
};
