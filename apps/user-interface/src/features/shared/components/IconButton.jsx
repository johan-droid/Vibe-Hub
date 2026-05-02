import React from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * IconButton Component — Material 3 Specification
 */
export const IconButton = React.forwardRef(({ 
  icon: Icon, 
  variant = 'standard', 
  active = false, 
  className, 
  size = 18,
  ...props 
}, ref) => {
  const baseClasses = 'relative p-2.5 rounded-full flex items-center justify-center transition-all duration-300 emphasized overflow-hidden group active:scale-[0.92]';
  
  const variantClasses = {
    standard: active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
    filled: active ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-primary hover:bg-surface-container-high',
    tonal: active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest',
    outlined: 'border border-outline text-on-surface-variant hover:bg-surface-variant/5 hover:text-on-surface',
  };

  return (
    <button
      ref={ref}
      className={twMerge(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {/* State Layer */}
      <div className="absolute inset-0 bg-current opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-[0.08] group-active:opacity-[0.12]" />
      
      {Icon && <Icon size={size} className="relative z-10" />}
    </button>
  );
});

IconButton.displayName = 'IconButton';
