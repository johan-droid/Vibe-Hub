import React, { useCallback, useRef } from 'react';

/**
 * ResizeHandle — Neural OS Tactile Control
 * Provides minimalist, high-density feedback for workspace orchestration.
 */
export function ResizeHandle({ direction = 'vertical', onDrag, className = '' }) {
  const isDragging = useRef(false);
  const origin = useRef(0);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    origin.current = direction === 'vertical' ? e.clientY : e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [direction]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const current = direction === 'vertical' ? e.clientY : e.clientX;
    const delta = current - origin.current;
    origin.current = current;
    onDrag(delta);
  }, [direction, onDrag]);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={
        `group shrink-0 relative z-30 select-none 
        ${direction === 'vertical' ? 'h-1 w-full cursor-ns-resize' : 'w-1 h-full cursor-ew-resize'} ${className}`
      }
    >
      {/* Target Area (Invisible, for easier grabbing) */}
      <div className={`absolute inset-0 ${direction === 'vertical' ? '-inset-y-2' : '-inset-x-2'}`} />
      
      {/* Visual Indicator */}
      <div 
        className={`absolute inset-0 m-auto bg-on-surface/[0.05] group-hover:bg-primary/40 group-active:bg-primary transition-colors 
        ${direction === 'vertical' ? 'h-[1px] w-full' : 'w-[1px] h-full'}`} 
      />
    </div>
  );
}
