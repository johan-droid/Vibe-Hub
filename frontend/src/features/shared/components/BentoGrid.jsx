import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Surface } from './Surface';

/**
 * BentoGrid — CSS Grid container for asymmetric card layouts.
 */
export const BentoGrid = ({ cols = 4, gap = 'md', className, children }) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div 
      className={twMerge(
        'grid w-full h-full p-4',
        `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols}`,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * BentoCard — A cell in the BentoGrid with elevation and lift effects.
 */
export const BentoCard = ({ 
  span = 1, 
  rowSpan = 1, 
  elevation = 2, 
  className, 
  children,
  ...props 
}) => {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-1 sm:col-span-2',
    3: 'col-span-1 sm:col-span-2 lg:col-span-3',
    4: 'col-span-full',
  };

  const rowClasses = {
    1: 'row-span-1',
    2: 'row-span-1 sm:row-span-2',
  };

  return (
    <Surface
      elevation={elevation}
      shape="xl"
      className={twMerge(
        'group h-full min-h-[160px] p-6 border border-outline-variant/30',
        'hover:bg-surface-container-high hover:border-outline-variant/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40',
        spanClasses[span],
        rowClasses[rowSpan],
        className
      )}
      {...props}
    >
      {children}
    </Surface>
  );
};
