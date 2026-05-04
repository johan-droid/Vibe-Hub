import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../../store/useStore';

export default function NeuralProjection() {
  const { isThinking } = useStore();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-surface">
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <motion.div
        animate={{ opacity: isThinking ? [0.06, 0.12, 0.06] : 0.05 }}
        transition={{ duration: 2, repeat: isThinking ? Infinity : 0 }}
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
      />
    </div>
  );
}
