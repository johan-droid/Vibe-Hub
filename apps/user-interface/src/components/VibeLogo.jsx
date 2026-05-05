import React from 'react';
import { motion } from 'framer-motion';

/**
 * Selina Logo - Faithful 8-segment structure (4 pills, 4 circles)
 * Trace the exact boundary with string animation on a pure black background.
 */

// Coordinates based on a 100x100 viewBox
const LOGO_SEGMENTS = [
  // Top Part
  { id: 'top-circle', d: 'M 23 32 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0' },
  { id: 'top-pill',   d: 'M 50 23 h 22 a 9 9 0 0 1 0 18 h -22 a 9 9 0 0 1 0 -18 Z' },
  
  // Right Part
  { id: 'right-circle', d: 'M 59 32 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0' },
  { id: 'right-pill',   d: 'M 59 50 v 22 a 9 9 0 0 0 18 0 v -22 a 9 9 0 0 0 -18 0 Z' },
  
  // Bottom Part
  { id: 'bottom-circle', d: 'M 59 68 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0' },
  { id: 'bottom-pill',   d: 'M 28 59 h 22 a 9 9 0 0 0 0 18 h -22 a 9 9 0 0 0 0 -18 Z' },
  
  // Left Part
  { id: 'left-circle', d: 'M 23 68 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0' },
  { id: 'left-pill',   d: 'M 23 28 v 22 a 9 9 0 0 1 18 0 v -22 a 9 9 0 0 1 -18 0 Z' },
];

const stringVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (delay) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay, duration: 1.5, ease: [0.22, 1, 0.36, 1] },
      opacity: { delay, duration: 0.3 },
    },
  }),
  loop: {
    pathLength: [0, 1, 1, 0],
    opacity: [0, 1, 1, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      repeatDelay: 0.5,
      ease: 'easeInOut',
      times: [0, 0.45, 0.85, 1],
    },
  },
};

const fillVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { delay: 1.8, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } 
  },
};

export function VibeLogoStringAnim({
  size = 120,
  strokeColor = '#E9D5FF',
  glowColor = 'rgba(233, 213, 255, 0.6)',
  strokeWidth = 3,
  mode = 'draw',
  onComplete,
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <filter id="string-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {LOGO_SEGMENTS.map((segment, i) => (
        <React.Fragment key={segment.id}>
          {/* Glow layer */}
          <motion.path
            d={segment.d}
            stroke={glowColor}
            strokeWidth={strokeWidth * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#string-glow)"
            custom={i * 0.15}
            variants={stringVariants}
            initial="hidden"
            animate={mode === 'loop' ? 'loop' : 'visible'}
          />
          {/* Main stroke */}
          <motion.path
            d={segment.d}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            custom={i * 0.15}
            variants={stringVariants}
            initial="hidden"
            animate={mode === 'loop' ? 'loop' : 'visible'}
            onAnimationComplete={i === LOGO_SEGMENTS.length - 1 ? onComplete : undefined}
          />
        </React.Fragment>
      ))}
    </svg>
  );
}

export function VibeLogo({ size = 64, className = '' }) {
  return (
    <img
      src="/images/selina-logo.png"
      alt="Selina"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}

export function AnimatedVibeLogo({
  size = 120,
  showStringAnim = true,
  className = '',
}) {
  const [isDone, setIsDone] = React.useState(false);

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {showStringAnim && (
        <div className="absolute inset-0 flex items-center justify-center">
          <VibeLogoStringAnim 
            size={size} 
            mode="draw" 
            onComplete={() => setIsDone(true)} 
          />
        </div>
      )}

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        variants={fillVariants}
        initial="hidden"
        animate={isDone || !showStringAnim ? 'visible' : 'hidden'}
      >
        <img
          src="/images/selina-logo.png"
          alt="Selina"
          width={size * 0.8}
          height={size * 0.8}
          className="object-contain"
        />
      </motion.div>
    </div>
  );
}

export function VibeLogoCompact({ size = 40, className = '' }) {
  return <VibeLogo size={size} className={className} />;
}

export default VibeLogo;
