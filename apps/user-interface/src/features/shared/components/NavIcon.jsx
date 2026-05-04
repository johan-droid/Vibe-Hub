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
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 group ${
        active
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-on-surface-variant/60 hover:bg-surface-container-high hover:text-on-surface'
      }`}
    >
      <Icon size={18} />
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute -left-[18px] hidden h-5 w-1 rounded-r-full bg-primary md:block"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
}
