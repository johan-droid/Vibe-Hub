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
  const baseClasses = 'relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-sans font-bold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

  const variantClasses = {
    filled: 'bg-primary text-on-primary shadow-sm hover:bg-primary/90',
    tonal: 'bg-primary/8 text-primary border border-primary/10 hover:bg-primary/12',
    outlined: 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:border-primary/40 hover:bg-primary/5',
    text: 'bg-transparent text-on-surface-variant hover:text-primary hover:bg-primary/5',
    elevated: 'bg-surface-container-lowest text-on-surface border border-outline-variant shadow-sm hover:bg-surface-container-low',
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
