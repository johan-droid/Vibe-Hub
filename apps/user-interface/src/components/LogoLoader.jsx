import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AnimatedVibeLogo, VibeLogo } from './VibeLogo';

/**
 * Selina Loading System
 * 
 * Features:
 * - Pure black loading surface
 * - Transparent logo mark with alpha-safe animation
 * - Rebranded to Selina
 */

function LoadingText({ text = 'Selina', subtitle = 'Initializing workspace...' }) {
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
      <p className="text-sm tracking-widest uppercase text-slate-500">
        {subtitle}{dots}
      </p>
      
      {/* Progress line */}
      <div className="w-48 h-0.5 bg-slate-900 mt-2 overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-purple-500"
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
  text = 'Selina',
  subtitle = 'Initializing workspace...',
}) {
  return (
    <div className="flex h-full min-h-full w-full flex-col items-center justify-center gap-12 bg-black">
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
  text = 'Selina',
  subtitle = 'Preparing your creative workspace...',
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <LogoLoader size={160} text={text} subtitle={subtitle} />
      
      {/* Footer watermark */}
      <motion.div
        className="absolute bottom-8 text-[10px] font-mono tracking-[0.4em] text-slate-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        SELINA CORE v6
      </motion.div>
    </motion.div>
  );
}

export default LogoLoader;
