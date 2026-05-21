import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * String Animation Components for Loading States
 * Various text animation patterns for the loader
 */

/**
 * Character-by-character reveal animation
 * Perfect for: "Loading", "Initializing", etc.
 */
export function RevealText({
  text = 'Loading',
  delay = 0,
  duration = 0.5,
  className = '',
  stagger = 0.05,
}) {
  const characters = text.split('');

  return (
    <motion.div
      className={`flex gap-0 ${className}`}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {characters.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: duration },
            },
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
}

/**
 * Typing effect animation
 * Shows text being typed out with cursor
 */
export function TypingText({
  text = 'Power String Loading...',
  cursorVisible = true,
  className = '',
}) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (displayText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
    }
  }, [displayText, text]);

  return (
    <motion.div className={`flex items-center gap-1 ${className}`}>
      <span className="font-mono">{displayText}</span>
      {cursorVisible && !isComplete && (
        <motion.span
          className="w-0.5 h-5 bg-primary"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

/**
 * Pulsing words animation
 * Words pulse in sequence
 */
export function PulsingWords({
  words = ['Loading', 'Initializing', 'Preparing'],
  className = '',
}) {
  const [currentWord, setCurrentWord] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [words]);

  return (
    <motion.div
      className={className}
      key={currentWord}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {words[currentWord]}
    </motion.div>
  );
}

/**
 * Glitch effect text
 * Cool distortion effect for modern feel
 */
export function GlitchText({ text = 'Selina', className = '' }) {
  return (
    <div className={`relative ${className}`} style={{ perspective: '1000px' }}>
      {/* Main text */}
      <motion.div
        className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"
        animate={{
          textShadow: [
            '2px 2px 0px rgba(168, 85, 247, 0.5)',
            '-2px -2px 0px rgba(236, 72, 153, 0.5)',
            '0px 0px 0px rgba(168, 85, 247, 0.5)',
          ],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      >
        {text}
      </motion.div>

      {/* Glitch layers */}
      <motion.div
        className="absolute inset-0 font-black text-purple-400 opacity-0"
        initial={{ x: 0 }}
        animate={{ x: [0, -2, 2, 0] }}
        transition={{
          duration: 0.15,
          repeat: Infinity,
          repeatDelay: 2,
        }}
      >
        {text}
      </motion.div>

      <motion.div
        className="absolute inset-0 font-black text-pink-400 opacity-0"
        initial={{ x: 0 }}
        animate={{ x: [0, 2, -2, 0] }}
        transition={{
          duration: 0.15,
          repeat: Infinity,
          repeatDelay: 2,
          delay: 0.05,
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}

/**
 * Power string animation - Sequential strength building
 * Shows "Loading." -> "Loading.." -> "Loading..." with power effect
 */
export function PowerString({
  baseText = 'Loading',
  className = '',
  dotCount = 3,
}) {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => {
        const count = prev.length + 1;
        return count > dotCount ? '.' : '.'.repeat(count);
      });
    }, 400);
    return () => clearInterval(timer);
  }, [dotCount]);

  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{
        duration: 0.6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <span className="font-semibold text-on-surface">{baseText}</span>
      <motion.span
        className="font-semibold text-primary tracking-wider min-w-8"
        key={dots}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {dots}
      </motion.span>

      {/* Power aura effect */}
      <motion.div
        className="absolute inset-0 rounded blur-lg opacity-0 -z-10"
        style={{
          background: `radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)`,
        }}
        animate={{ opacity: [0, 0.3, 0], scale: [1, 1.2, 1] }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

/**
 * Shimmer text animation
 * Gradient shimmer across text
 */
export function ShimmerText({ text = 'Loading...', className = '' }) {
  return (
    <motion.div
      className={className}
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
      animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {text}
    </motion.div>
  );
}

/**
 * Wave text animation
 * Characters wave up and down
 */
export function WaveText({
  text = 'Loading',
  className = '',
  waveHeight = 20,
}) {
  const characters = text.split('');

  return (
    <div className={`flex gap-0 ${className}`}>
      {characters.map((char, i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -waveHeight, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * Bounce text animation
 * Text bounces with spring physics
 */
export function BounceText({ text = 'Selina', className = '' }) {
  const characters = text.split('');

  return (
    <motion.div className={`flex gap-0 justify-center ${className}`}>
      {characters.map((char, i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -10, 0] }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 15,
            repeat: Infinity,
            delay: i * 0.1,
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
}

/**
 * Gradient pulse text
 * Color pulses through the text
 */
export function GradientPulseText({ text = 'Loading', className = '' }) {
  return (
    <motion.div
      className={className}
      style={{
        background: 'linear-gradient(90deg, rgb(168, 85, 247), rgb(236, 72, 153), rgb(168, 85, 247))',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
      animate={{ backgroundPosition: ['0% center', '100% center', '0% center'] }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {text}
    </motion.div>
  );
}

/**
 * Main Loading Status Component
 * Combines effects for variety
 */
export function LoadingStatus({
  showPowerString = true,
  showWave = true,
  variant = 'power', // 'power', 'typing', 'pulse', 'wave'
  className = '',
}) {
  const renderVariant = () => {
    switch (variant) {
      case 'typing':
        return <TypingText text="Loading..." />;
      case 'pulse':
        return <PulsingWords words={['Loading', 'Initializing', 'Preparing']} />;
      case 'wave':
        return <WaveText text="Loading..." className="text-base font-semibold" />;
      case 'power':
      default:
        return <PowerString baseText="Loading" />;
    }
  };

  return <div className={className}>{renderVariant()}</div>;
}
