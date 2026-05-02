import React, { useCallback, useRef } from 'react';

/**
 * ResizeHandle — Material 3 Workspace Control
 * Provides high-fidelity, tactile feedback for layout adjustments.
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
        `group shrink-0 relative z-30 transition-all duration-300 select-none 
        ${direction === 'vertical' ? 'h-1 w-full cursor-ns-resize' : 'w-1 h-full cursor-ew-resize'} ${className}`
      }
    >
      <div className={`absolute inset-0 m-auto bg-outline-variant/10 group-hover:bg-primary/40 transition-colors ${direction === 'vertical' ? 'h-[1px] w-full' : 'w-[1px] h-full'}`} />
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 ${direction === 'vertical' ? 'h-4 -top-1.5' : 'w-4 -left-1.5'}`} />
    </div>
  );
}
