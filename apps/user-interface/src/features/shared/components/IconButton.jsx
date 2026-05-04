import React from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * IconButton Component — Refined for a professional "common people" perspective.
 * Features ultra-soft interactions and a premium "enclave" feel.
 */
export const IconButton = React.forwardRef(({ 
  icon: Icon, 
  variant = 'standard', 
  active = false, 
  className, 
  size = 20,
  ...props 
}, ref) => {
  const baseClasses = 'relative p-3.5 rounded-[1.2rem] flex items-center justify-center transition-all duration-500 overflow-hidden group active:scale-[0.9]';
  
  const variantClasses = {
    standard: active 
      ? 'text-google-blue bg-google-blue/5 shadow-inner' 
      : 'text-on-surface-variant/40 hover:text-google-blue hover:bg-google-blue/5',
    filled: active 
      ? 'bg-google-blue text-white shadow-2xl shadow-google-blue/20' 
      : 'bg-white border border-black/[0.03] text-on-surface-variant/40 hover:text-google-blue hover:shadow-xl hover:shadow-google-blue/10',
    tonal: active 
      ? 'bg-google-blue/10 text-google-blue shadow-sm' 
      : 'bg-black/[0.02] text-on-surface-variant/40 hover:bg-black/[0.05] hover:text-on-surface',
    outlined: 'border border-black/[0.05] text-on-surface-variant/40 hover:border-google-blue/30 hover:text-google-blue hover:bg-google-blue/[0.02]',
  };

  return (
    <button
      ref={ref}
      className={twMerge(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {/* Glossy State Layer */}
      <div className="absolute inset-0 bg-current opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-[0.03] group-active:opacity-[0.08]" />
      
      {Icon && (
        <Icon 
          size={size} 
          className="relative z-10 transition-transform duration-500 group-hover:scale-110" 
        />
      )}
    </button>
  );
});

IconButton.displayName = 'IconButton';
