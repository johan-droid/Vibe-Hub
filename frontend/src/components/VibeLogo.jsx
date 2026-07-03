import React from 'react';
import { motion } from 'framer-motion';
import { SELINA_BRAND } from '../brand/selina';

const markPath = 'M42 16H27.5C20.6 16 16 20.4 16 26.1C16 32.2 20.7 35.5 28 36.7L34.7 37.8C42 39 46 42.2 46 48.1C46 53.9 41.3 58 34.3 58H18';

function LogoSvg({
  size,
  className = '',
  showTile = true,
  animated = false,
  title = SELINA_BRAND.productName,
}) {
  const Path = animated ? motion.path : 'path';
  const pathProps = animated
    ? {
        initial: { pathLength: 0, opacity: 0.35 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
      }
    : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${title} logo`}
      className={`select-none ${className}`}
    >
      <defs>
        <linearGradient id="selina-tile" x1="8" y1="4" x2="64" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#11201D" />
          <stop offset="0.45" stopColor="#10131A" />
          <stop offset="1" stopColor="#221A0B" />
        </linearGradient>
        <linearGradient id="selina-flow" x1="14" y1="16" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#43F3C5" />
          <stop offset="0.52" stopColor="#F7C35F" />
          <stop offset="1" stopColor="#8DA2FF" />
        </linearGradient>
        <filter id="selina-glow" x="-24" y="-24" width="120" height="120" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#43F3C5" floodOpacity="0.14" />
        </filter>
      </defs>
      {showTile && (
        <rect
          x="5"
          y="5"
          width="62"
          height="62"
          rx="17"
          fill="url(#selina-tile)"
          stroke="rgba(255,255,255,0.16)"
        />
      )}
      <g filter="url(#selina-glow)">
        <Path
          d={markPath}
          stroke="url(#selina-flow)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...pathProps}
        />
        <circle cx="47" cy="16" r="4" fill="#43F3C5" />
        <circle cx="16" cy="58" r="4" fill="#F7C35F" />
      </g>
      <path
        d="M28 29H44"
        stroke="rgba(255,255,255,0.78)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SelinaLogo({ size = 64, className = '', showTile = true }) {
  return <LogoSvg size={size} className={className} showTile={showTile} />;
}

export function AnimatedSelinaLogo({ size = 120, className = '', showTile = true }) {
  return (
    <motion.div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <LogoSvg size={size} showTile={showTile} animated />
    </motion.div>
  );
}

export function SelinaLogoCompact({ size = 40, className = '' }) {
  return <SelinaLogo size={size} className={className} />;
}

export function SelinaWordmark({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SelinaLogoCompact size={40} />
      <div className="min-w-0">
        <span className="block text-base font-black leading-none tracking-tight text-on-surface">
          {SELINA_BRAND.productName}
        </span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70">
          {SELINA_BRAND.tagline}
        </span>
      </div>
    </div>
  );
}

export function VibeLogoStringAnim({ size = 120, mode = 'draw', onComplete, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={mode === 'loop' ? { opacity: 0.75, scale: 0.98 } : { opacity: 0, scale: 0.94 }}
      animate={
        mode === 'loop'
          ? { opacity: [0.65, 1, 0.65], scale: [0.98, 1.04, 0.98] }
          : { opacity: 1, scale: 1 }
      }
      transition={
        mode === 'loop'
          ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
      }
      onAnimationComplete={mode === 'loop' ? undefined : onComplete}
    >
      <LogoSvg size={size} animated={mode !== 'loop'} />
    </motion.div>
  );
}

export function VibeLogo({ size = 64, className = '' }) {
  return <SelinaLogo size={size} className={className} />;
}

export function AnimatedVibeLogo({ size = 120, className = '' }) {
  return <AnimatedSelinaLogo size={size} className={className} />;
}

export function VibeLogoCompact({ size = 40, className = '' }) {
  return <SelinaLogoCompact size={size} className={className} />;
}

export function VibeLargeLogo({ size = 160, className = '' }) {
  return <AnimatedSelinaLogo size={size} className={className} />;
}

export default SelinaLogo;
