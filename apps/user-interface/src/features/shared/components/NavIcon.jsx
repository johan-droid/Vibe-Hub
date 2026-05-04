import React from 'react';
import { motion } from 'framer-motion';

/**
 * NavIcon — Premium sidebar navigation refined for a "common people" perspective.
 * Features ultra-smooth active states and Google-inspired iconography behavior.
 */
export function NavIcon({ icon: Icon, active = false, onClick, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`relative flex h-11 w-11 items-center justify-center rounded-[1.2rem] transition-all duration-500 group active:scale-[0.85] ${
        active
          ? 'bg-google-blue text-white shadow-lg shadow-google-blue/20'
          : 'text-on-surface-variant/30 hover:bg-google-blue/5 hover:text-google-blue'
      }`}
    >
      <Icon size={20} className="relative z-10 transition-transform duration-500 group-hover:scale-110" />
      
      {active && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute -left-[20px] hidden h-6 w-1.5 rounded-r-full bg-google-blue md:block shadow-[0_0_12px_rgba(66,133,244,0.4)]"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
        />
      )}

      {/* Tooltip-like label for "common people" */}
      <div className="absolute left-full ml-4 hidden md:group-hover:flex items-center pointer-events-none z-[100]">
         <div className="px-4 py-2 bg-on-surface text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl whitespace-nowrap">
            {ariaLabel}
         </div>
      </div>
    </button>
  );
}
