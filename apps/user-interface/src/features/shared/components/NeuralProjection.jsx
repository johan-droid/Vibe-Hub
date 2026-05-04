import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../../store/useStore';

/**
 * NeuralProjection — Visual Transition Layer (Final Professional Refinement)
 * Adds an immersive, premium backdrop that reacts to agent activity.
 * Features multi-layer parallax, ambient orbs, and high-fidelity noise.
 */
export default function NeuralProjection() {
  const { isThinking } = useStore();

  // Memoize static elements to prevent unnecessary re-renders
  const orbs = useMemo(() => [
    { color: 'bg-google-blue', size: 'h-[600px] w-[600px]', initial: { x: '-20%', y: '-10%' }, animate: { x: ['-20%', '-10%', '-20%'], y: ['-10%', '0%', '-10%'] } },
    { color: 'bg-google-red', size: 'h-[500px] w-[500px]', initial: { x: '110%', y: '60%' }, animate: { x: ['110%', '100%', '110%'], y: ['60%', '70%', '60%'] } },
    { color: 'bg-google-yellow', size: 'h-[400px] w-[400px]', initial: { x: '10%', y: '110%' }, animate: { x: ['10%', '20%', '10%'], y: ['110%', '100%', '110%'] } },
  ], []);

  const particles = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  })), []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-50 overflow-hidden bg-[#faf8f5]">
      {/* Base Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#faf8f5] to-[#f5f2ee] opacity-100" />
      
      {/* Dynamic Orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          initial={orb.initial}
          animate={{
            ...orb.animate,
            scale: isThinking ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: isThinking ? [0.03, 0.08, 0.03] : [0.02, 0.05, 0.02],
          }}
          transition={{
            duration: 25 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`absolute rounded-full blur-[120px] ${orb.color} opacity-5`}
          style={{ width: orb.size.split(' ')[1], height: orb.size.split(' ')[0] }}
        />
      ))}

      {/* Floating Particles (New) */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0 }}
            animate={{ 
              y: [`${p.y}%`, `${p.y - 10}%`, `${p.y}%`],
              opacity: [0, 0.15, 0]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut"
            }}
            className="absolute bg-google-blue rounded-full shadow-[0_0_10px_rgba(66,133,244,0.4)]"
            style={{ width: p.size, height: p.size }}
          />
        ))}
      </div>

      {/* High-Fidelity Noise Texture */}
      <div 
        className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
        style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }}
      />

      {/* Soft Premium Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{ 
          backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Bottom Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(250,248,245,0.4)_100%)]" />
    </div>
  );
}
