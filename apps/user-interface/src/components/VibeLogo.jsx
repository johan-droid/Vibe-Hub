import React from 'react';
import { motion } from 'framer-motion';

/**
 * Selina Logo
 * Uses the extracted transparent mark so loaders and headers inherit the
 * surrounding app background instead of carrying a baked-in image backdrop.
 */

export const SELINA_LOGO_SRC = '/images/selina-logo-transparent.png';

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
  glowColor = 'rgba(233, 213, 255, 0.6)',
  mode = 'draw',
  onComplete,
  className = '',
}) {
  const dropShadow = `drop-shadow(0 0 ${Math.max(12, size * 0.12)}px ${glowColor})`;

  return (
    <motion.img
      src={SELINA_LOGO_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={`select-none object-contain ${className}`}
      initial={
        mode === 'loop'
          ? { opacity: 0.42, scale: 0.96, filter: dropShadow }
          : { opacity: 0, scale: 0.94, clipPath: 'inset(0 100% 0 0)', filter: dropShadow }
      }
      animate={
        mode === 'loop'
          ? { opacity: [0.38, 1, 0.38], scale: [0.96, 1.05, 0.96], filter: dropShadow }
          : { opacity: 1, scale: 1, clipPath: 'inset(0 0% 0 0)', filter: dropShadow }
      }
      transition={
        mode === 'loop'
          ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 1.15, ease: [0.22, 1, 0.36, 1] }
      }
      onAnimationComplete={mode === 'loop' ? undefined : onComplete}
    />
  );
}

export function VibeLogo({ size = 64, className = '' }) {
  return (
    <img
      src={SELINA_LOGO_SRC}
      alt="Selina"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`select-none object-contain ${className}`}
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
          src={SELINA_LOGO_SRC}
          alt="Selina"
          width={size * 0.8}
          height={size * 0.8}
          draggable={false}
          className="select-none object-contain"
          style={{
            filter: 'drop-shadow(0 0 28px rgba(233, 213, 255, 0.18))',
          }}
        />
      </motion.div>
    </div>
  );
}

export function VibeLogoCompact({ size = 40, className = '' }) {
  return <VibeLogo size={size} className={className} />;
}

export function VibeLargeLogo({ size = 160, className = '' }) {
  return <AnimatedVibeLogo size={size} className={className} />;
}

export default VibeLogo;
