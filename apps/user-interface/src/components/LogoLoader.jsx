import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimatedVibeLogo, VibeLogo } from './VibeLogo';
import { SELINA_BRAND } from '../brand/selina';

/**
 * Selina Loading System
 * 
 * Features:
 * - Brand-grade loading surface
 * - Vector logo mark with alpha-safe animation
 * - Rebranded to Selina
 */

function LoadingText({ text = SELINA_BRAND.productName, subtitle = 'Initializing workspace...' }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center gap-4 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.8 }}
    >
      <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
        {text}
      </h1>
      <p className="text-sm font-semibold tracking-[0.22em] uppercase text-white/60">
        {subtitle}{dots}
      </p>
      
      <div className="w-48 h-0.5 bg-white/10 mt-2 overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-gradient-to-r from-[#43F3C5] via-[#F7C35F] to-[#8DA2FF]"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ delay: 1, duration: 2.5, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

export function LogoLoader({
  size = 140,
  showText = true,
  text = SELINA_BRAND.productName,
  subtitle = 'Initializing workspace...',
}) {
  return (
    <div className="flex h-full min-h-full w-full flex-col items-center justify-center gap-12 bg-[#080A0F]">
      <div className="relative">
        <AnimatedVibeLogo size={size} showStringAnim={true} />
      </div>
      {showText && <LoadingText text={text} subtitle={subtitle} />}
    </div>
  );
}

export function LogoSpinner({ size = 48, className = '' }) {
  return (
    <motion.div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
    >
      <VibeLogo size={size} />
    </motion.div>
  );
}

export function FullPageLoader({
  text = SELINA_BRAND.productName,
  subtitle = 'Preparing your creative workspace...',
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#080A0F]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <LogoLoader size={160} text={text} subtitle={subtitle} />
      
      {/* Footer watermark */}
      <motion.div
        className="absolute bottom-8 text-[10px] font-mono tracking-[0.4em] text-white/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        Selina CORE v6
      </motion.div>
    </motion.div>
  );
}

export default LogoLoader;
