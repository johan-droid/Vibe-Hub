import React from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * Premium button primitive used across auth, landing, and workspace surfaces.
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
  const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-display font-semibold transition-all duration-300 emphasized overflow-hidden active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none group whitespace-nowrap';

  const variantClasses = {
    filled: 'bg-primary text-on-primary shadow-lg shadow-primary/15 hover:brightness-110 hover:shadow-primary/25',
    tonal: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15',
    outlined: 'bg-transparent border border-outline-variant text-on-surface hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
    text: 'bg-transparent text-primary hover:bg-primary/10',
    elevated: 'bg-surface-container-high text-on-surface shadow-xl shadow-black/15 hover:bg-surface-container-highest',
  };

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-xs rounded-full',
    md: 'px-5 py-2.5 text-sm rounded-full',
    lg: 'px-7 py-3 text-base rounded-full',
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={twMerge(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      <div className="absolute inset-0 bg-white opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-[0.08] group-active:opacity-[0.12]" />
      {LeadingIcon && <LeadingIcon size={size === 'sm' ? 14 : 18} />}
      <span className="relative z-10">{children}</span>
      {TrailingIcon && <TrailingIcon size={size === 'sm' ? 14 : 18} />}
    </button>
  );
});

Button.displayName = 'Button';
