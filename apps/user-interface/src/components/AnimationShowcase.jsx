/**
 * Animation Demo Page
 * Showcases all available animations and loading states
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  VibeLogo,
  AnimatedVibeLogo,
  LogoLoader,
  LogoSpinner,
  RevealText,
  TypingText,
  PulsingWords,
  GlitchText,
  PowerString,
  ShimmerText,
  WaveText,
  BounceText,
  GradientPulseText,
  ApplicationHeader,
} from './index.animations';

export function AnimationShowcase() {
  const [activeVariant, setActiveVariant] = useState('power');

  const variants = [
    { id: 'power', label: 'Power String', component: <PowerString baseText="Power Loading" /> },
    { id: 'wave', label: 'Wave', component: <WaveText text="Loading..." className="text-lg font-semibold" /> },
    { id: 'pulse', label: 'Pulsing Words', component: <PulsingWords words={['Loading', 'Initializing', 'Preparing']} /> },
    { id: 'bounce', label: 'Bounce', component: <BounceText text="Selina" /> },
    { id: 'glitch', label: 'Glitch', component: <GlitchText text="Selina" /> },
    { id: 'typing', label: 'Typing', component: <TypingText text="Power String Loading..." /> },
    { id: 'gradient', label: 'Gradient Pulse', component: <GradientPulseText text="Power Loading" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
      <ApplicationHeader title="Animation Showcase" />

      <div className="p-8 max-w-6xl mx-auto">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Logo Variants */}
          <motion.section className="p-8 rounded-lg bg-purple-900/30 border border-purple-400/20 backdrop-blur">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
              Logo Variants
            </h2>

            <div className="space-y-8">
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-on-surface">Static Logo</h3>
                <VibeLogo size={64} />
              </div>

              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-on-surface">Animated Logo</h3>
                <AnimatedVibeLogo size={80} showGlow={true} />
              </div>

              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-on-surface">Spinner</h3>
                <LogoSpinner size={48} />
              </div>
            </div>
          </motion.section>

          {/* Loading Variants */}
          <motion.section className="p-8 rounded-lg bg-purple-900/30 border border-purple-400/20 backdrop-blur">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
              Loading States
            </h2>

            <div className="space-y-6">
              {['power', 'wave', 'pulse'].map((variant) => (
                <button
                  key={variant}
                  onClick={() => setActiveVariant(variant)}
                  className={`w-full p-4 rounded-lg transition-all ${
                    activeVariant === variant
                      ? 'bg-purple-500/50 border-purple-300'
                      : 'bg-purple-500/20 border-purple-400/20 hover:bg-purple-500/30'
                  } border`}
                >
                  <LogoLoader
                    size={100}
                    text="Preview"
                    loadingVariant={variant}
                    showText={false}
                  />
                  <p className="mt-2 text-sm font-semibold">{variant.toUpperCase()}</p>
                </button>
              ))}
            </div>
          </motion.section>

          {/* Text Animations */}
          <motion.section className="p-8 rounded-lg bg-purple-900/30 border border-purple-400/20 backdrop-blur md:col-span-2">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
              Text Animations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {variants.map((variant) => (
                <motion.div
                  key={variant.id}
                  className="p-6 rounded-lg bg-purple-900/20 border border-purple-400/10"
                  whileHover={{ scale: 1.02 }}
                >
                  <h3 className="text-sm font-semibold text-purple-300 mb-4">{variant.label}</h3>
                  <div className="flex justify-center items-center min-h-12 text-lg font-bold">
                    {variant.component}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Full Page Preview */}
          <motion.section className="p-8 rounded-lg bg-purple-900/30 border border-purple-400/20 backdrop-blur md:col-span-2">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
              Full Page Loader Preview
            </h2>

            <div className="relative h-96 rounded-lg bg-slate-900 overflow-hidden border border-purple-400/20">
              <LogoLoader
                size={140}
                text="Selina"
                loadingVariant={activeVariant}
              />
            </div>
          </motion.section>
        </motion.div>

        {/* Usage Guide */}
        <motion.section
          className="mt-12 p-8 rounded-lg bg-purple-900/30 border border-purple-400/20 backdrop-blur"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        >
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-6">
            Usage Guide
          </h2>

          <div className="space-y-4 text-sm text-on-surface-variant">
            <div>
              <h3 className="font-semibold text-on-surface mb-2">Import Components</h3>
              <pre className="bg-slate-900/50 p-4 rounded border border-purple-400/20 overflow-x-auto">
{`import {
  VibeLogo,
  FullPageLoader,
  PowerString,
  ApplicationHeader,
} from '@/components/index.animations'`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-on-surface mb-2">Use in Your App</h3>
              <pre className="bg-slate-900/50 p-4 rounded border border-purple-400/20 overflow-x-auto">
{`// Full page loader
<FullPageLoader text="Loading..." loadingVariant="power" />

// Logo in header
<ApplicationHeader title="My Page" showLogo={true} />

// String animations
<PowerString baseText="Processing" />
<WaveText text="Loading..." />`}
              </pre>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default AnimationShowcase;
