import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Surface Component — Material 3 Tonal Elevation
 * 
 * Provides background elevation through tint overlays and consistent rounding.
 */
export const Surface = React.forwardRef(({ 
  elevation = 0, 
  shape = 'md', 
  interactive = false, 
  className, 
  children,
  ...props 
}, ref) => {
  const elevationClasses = [
    'bg-surface',                    // Level 0
    'bg-surface-container-low',      // Level 1
    'bg-surface-container',          // Level 2
    'bg-surface-container-high',     // Level 3
    'bg-surface-container-highest',  // Level 4
    'bg-surface-bright',             // Level 5
  ];

  const shapeClasses = {
    none: 'rounded-none',
    xs: 'rounded-shape-xs',
    sm: 'rounded-shape-sm',
    md: 'rounded-shape-md',
    lg: 'rounded-shape-lg',
    xl: 'rounded-shape-xl',
    '2xl': 'rounded-shape-2xl',
    full: 'rounded-full',
  };

  return (
    <div
      ref={ref}
      className={twMerge(
        'relative overflow-hidden transition-all duration-300 emphasized',
        elevationClasses[elevation],
        shapeClasses[shape],
        interactive && 'hover-layer press-layer cursor-pointer',
        className
      )}
      {...props}
    >
      {/* M3 State Layer */}
      {interactive && (
        <div className="absolute inset-0 bg-on-surface opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-[0.08] group-active:opacity-[0.12]" />
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
});

Surface.displayName = 'Surface';
