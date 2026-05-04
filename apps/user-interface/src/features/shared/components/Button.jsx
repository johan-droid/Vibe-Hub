import React from 'react';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

/**
 * Premium button primitive refined for a professional "common people" perspective.
 * Features ultra-smooth transitions, deep shadows, and Google-inspired accents.
 */
export const Button = React.forwardRef(({
  variant = 'filled',
  size = 'md',
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  className,
  children,
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'relative inline-flex items-center justify-center gap-3 font-sans font-black uppercase tracking-widest transition-all duration-500 overflow-hidden active:scale-[0.95] disabled:opacity-30 disabled:pointer-events-none group whitespace-nowrap shadow-sm';

  const variantClasses = {
    filled: 'bg-primary text-on-primary shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5',
    tonal: 'bg-google-blue/5 text-google-blue border border-google-blue/10 hover:bg-google-blue/10',
    outlined: 'bg-white border border-black/[0.05] text-on-surface hover:border-google-blue/40 hover:bg-google-blue/[0.02] hover:text-google-blue',
    text: 'bg-transparent text-on-surface-variant/60 hover:text-google-blue hover:bg-google-blue/5',
    elevated: 'bg-white text-on-surface shadow-2xl shadow-black/[0.05] hover:bg-surface-container-low',
  };

  const sizeClasses = {
    sm: 'px-6 py-2.5 text-[9px] rounded-xl',
    md: 'px-8 py-4 text-[11px] rounded-2xl',
    lg: 'px-10 py-5 text-[13px] rounded-[1.5rem]',
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={twMerge(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* State Layer */}
      <div className="absolute inset-0 bg-white opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-[0.05] group-active:opacity-[0.1]" />
      
      {LeadingIcon && (
        <LeadingIcon 
          size={iconSize} 
          className="relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" 
        />
      )}
      
      <span className="relative z-10">{children}</span>
      
      {TrailingIcon && (
        <TrailingIcon 
          size={iconSize} 
          className="relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" 
        />
      )}
    </button>
  );
});

Button.displayName = 'Button';
