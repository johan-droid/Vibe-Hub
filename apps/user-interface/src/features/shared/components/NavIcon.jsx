import React from 'react';
import { motion } from 'framer-motion';

/**
 * NavIcon — compact rail navigation with a quieter premium active state.
 */
export function NavIcon({ icon: Icon, active = false, onClick, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-300 group ${
        active
          ? 'border-primary/30 bg-primary/10 text-primary shadow-lg shadow-primary/10'
          : 'border-transparent text-on-surface-variant/55 hover:border-outline-variant/35 hover:bg-surface-container-high hover:text-on-surface'
      }`}
    >
      <Icon size={19} />
      {active && (
        <motion.div
          layoutId="nav-active"
          className="absolute -left-2 hidden h-6 w-1 rounded-r-full bg-primary md:block"
        />
      )}
    </button>
  );
}
