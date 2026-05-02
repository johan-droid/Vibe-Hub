import React from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * Button Component — Material 3 Specification
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
  const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-display font-semibold transition-all duration-300 emphasized overflow-hidden active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none group';
  
  const variantClasses = {
    filled: 'bg-primary text-on-primary shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:brightness-110',
    tonal: 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
    outlined: 'bg-transparent border border-outline text-primary hover:bg-primary/5',
    text: 'bg-transparent text-primary hover:bg-primary/5',
    elevated: 'bg-surface-container-high text-primary shadow-xl hover:bg-surface-container-highest',
  };

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-xs rounded-full',
    md: 'px-6 py-2.5 text-sm rounded-full',
    lg: 'px-8 py-3 text-base rounded-full',
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={twMerge(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {/* State Layer */}
      <div className="absolute inset-0 bg-current opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-[0.08] group-active:opacity-[0.12]" />
      
      {LeadingIcon && <LeadingIcon size={size === 'sm' ? 14 : 18} />}
      <span className="relative z-10">{children}</span>
      {TrailingIcon && <TrailingIcon size={size === 'sm' ? 14 : 18} />}
    </button>
  );
});

Button.displayName = 'Button';
