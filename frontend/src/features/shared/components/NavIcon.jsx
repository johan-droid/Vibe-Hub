import React from 'react';
import { motion } from 'framer-motion';

export function NavIcon({ icon: Icon, active = false, onClick, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 active:scale-[0.96] ${
        active
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-on-surface-variant hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <Icon size={18} className="relative z-10" />
      
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute -left-[18px] hidden h-5 w-1 rounded-r-full bg-primary md:block"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
        />
      )}

      <div className="absolute left-full ml-4 hidden md:group-hover:flex items-center pointer-events-none z-[100]">
         <div className="whitespace-nowrap rounded-md bg-on-surface px-3 py-1.5 text-xs font-semibold text-surface shadow-lg">
            {ariaLabel}
         </div>
      </div>
    </button>
  );
}
