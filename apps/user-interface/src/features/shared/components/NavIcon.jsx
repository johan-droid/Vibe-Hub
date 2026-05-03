import React from 'react';
import { motion } from 'framer-motion';

/**
 * NavIcon — Rail Navigation Anchor
 * High-fidelity interaction point for technical rail navigation.
 */
export function NavIcon({ icon: Icon, active = false, onClick, ariaLabel }) {
  return (
    <button 
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`
        relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-500 group
        ${active ? 'bg-primary shadow-lg shadow-primary/20' : 'hover:bg-surface-container-highest'}
      `}
    >
      <Icon size={20} className={active ? 'text-on-primary' : 'text-on-surface-variant opacity-40 group-hover:opacity-100'} />
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -left-4 w-1 h-6 bg-primary rounded-r-full"
        />
      )}
    </button>
  );
}
