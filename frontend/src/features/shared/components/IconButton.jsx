import React from 'react';
import { twMerge } from 'tailwind-merge';

export const IconButton = React.forwardRef(({ 
  icon: Icon, 
  variant = 'standard', 
  active = false, 
  className, 
  size = 20,
  ...props 
}, ref) => {
  const baseClasses = 'relative flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';
  
  const variantClasses = {
    standard: active 
      ? 'text-primary bg-primary/10' 
      : 'text-on-surface-variant hover:text-primary hover:bg-primary/5',
    filled: active 
      ? 'bg-primary text-on-primary shadow-sm' 
      : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-primary hover:bg-primary/5',
    tonal: active 
      ? 'bg-primary/10 text-primary' 
      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    outlined: 'border border-outline-variant text-on-surface-variant hover:border-primary/30 hover:text-primary hover:bg-primary/5',
  };

  return (
    <button
      ref={ref}
      className={twMerge(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {Icon && (
        <Icon 
          size={size} 
          className="relative z-10" 
        />
      )}
    </button>
  );
});

IconButton.displayName = 'IconButton';
