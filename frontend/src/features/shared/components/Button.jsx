import React from 'react';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

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
  const baseClasses = 'relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-sans font-bold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-google-blue/30';

  const variantClasses = {
    filled: 'bg-google-blue text-white shadow-sm hover:bg-google-blue/90',
    tonal: 'bg-google-blue/10 text-google-blue border border-google-blue/20 hover:bg-google-blue/20',
    outlined: 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-google-blue/40 hover:bg-google-blue/5',
    text: 'bg-transparent text-on-surface-variant hover:text-google-blue hover:bg-google-blue/5',
    elevated: 'bg-surface-container-lowest text-on-surface border border-outline-variant shadow-sm hover:bg-surface-container-low hover:text-google-blue',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-10 px-4 text-sm rounded-lg',
    lg: 'h-12 px-5 text-base rounded-lg',
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={twMerge(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {LeadingIcon && (
        <LeadingIcon 
          size={iconSize} 
          className="relative z-10" 
        />
      )}
      
      <span className="relative z-10">{children}</span>
      
      {TrailingIcon && (
        <TrailingIcon 
          size={iconSize} 
          className="relative z-10" 
        />
      )}
    </button>
  );
});

Button.displayName = 'Button';
