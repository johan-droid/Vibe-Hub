/**
 * Animation System Configuration
 * Central place to customize colors, durations, and animation presets
 */

/**
 * Color Palette
 * Define your brand colors here
 */
export const animationColors = {
  primary: 'rgb(168, 85, 247)',      // Purple
  secondary: 'rgb(236, 72, 153)',    // Pink
  accent: 'rgb(59, 130, 246)',       // Blue
  darkBg: '#0f172a',                 // Slate 900
  purpleBg: '#2e1065',               // Purple 900
};

/**
 * Animation Durations (in seconds)
 * Adjust these to speed up or slow down animations
 */
export const animationDurations = {
  // Logo animations
  logoEntry: 1.2,        // Logo fade in
  logoFloat: 4,          // Floating up/down
  logoRotate: 20,        // Full rotation
  logoGlow: 3,           // Glow pulse
  
  // Text animations
  textReveal: 0.5,       // Character reveal
  textStagger: 0.05,     // Delay between characters
  textWave: 0.6,         // Wave motion
  textBounce: 0.1,       // Bounce timing
  
  // Loading states
  powerDot: 0.4,         // Dot animation
  pulseWord: 2,          // Word change
  glitch: 0.15,          // Glitch duration
  shimmer: 2,            // Shimmer travel
  
  // UI transitions
  headerEntry: 0.5,      // Header slide in
  backdropFade: 0.3,     // Backdrop fade
};

/**
 * Background Patterns
 * Pre-defined background configurations
 */
export const backgroundPatterns = {
  animated: {
    showGrid: true,
    showOrbs: true,
    gridOpacity: 0.05,
    orbCount: 2,
    orbDuration: { min: 8, max: 10 },
  },
  minimal: {
    showGrid: false,
    showOrbs: true,
    gridOpacity: 0,
    orbCount: 1,
    orbDuration: { min: 6, max: 8 },
  },
  static: {
    showGrid: true,
    showOrbs: false,
    gridOpacity: 0.05,
    orbCount: 0,
  },
};

/**
 * Loading Variants
 * Pre-configured loading animations
 */
export const loadingVariants = {
  power: {
    label: 'Power Loading',
    description: 'Sequential dots with power aura effect',
    animation: 'power',
  },
  wave: {
    label: 'Wave',
    description: 'Characters wave up and down',
    animation: 'wave',
  },
  pulse: {
    label: 'Pulsing Words',
    description: 'Words cycle with fade effect',
    animation: 'pulse',
  },
  typing: {
    label: 'Typing',
    description: 'Simulated typing effect with cursor',
    animation: 'typing',
  },
};

/**
 * Size Presets
 * Common size configurations
 */
export const sizePresets = {
  logo: {
    compact: 24,
    small: 40,
    medium: 64,
    large: 120,
    hero: 200,
  },
  text: {
    small: '0.875rem',     // 14px
    base: '1rem',          // 16px
    lg: '1.125rem',        // 18px
    xl: '1.25rem',         // 20px
    '2xl': '1.5rem',       // 24px
    '3xl': '1.875rem',     // 30px
    '4xl': '2.25rem',      // 36px
  },
};

/**
 * Easing Functions
 * Common easing curves for animations
 */
export const easing = {
  smooth: [0.22, 1, 0.36, 1],       // Smooth ease
  spring: [0.34, 1.56, 0.64, 1],    // Spring-like
  linear: 'linear',
  easeIn: 'easeIn',
  easeOut: 'easeOut',
  easeInOut: 'easeInOut',
};

/**
 * Opacity Levels
 * For consistent transparency
 */
export const opacity = {
  disabled: 0.3,
  secondary: 0.6,
  primary: 1,
  hover: 0.85,
  focus: 0.9,
};

/**
 * Blur Values
 * For background blur effects
 */
export const blur = {
  none: '0px',
  sm: '4px',
  base: '12px',
  md: '24px',
  lg: '36px',
  xl: '48px',
};

/**
 * Gradients
 * Pre-configured gradient combinations
 */
export const gradients = {
  purplePink: 'linear-gradient(90deg, rgb(168, 85, 247), rgb(236, 72, 153))',
  purplePinkReverse: 'linear-gradient(90deg, rgb(236, 72, 153), rgb(168, 85, 247))',
  radialPurple: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)',
  radialPink: 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%)',
};

/**
 * Shadow Configurations
 */
export const shadows = {
  glow: '0 0 20px rgba(168, 85, 247, 0.3)',
  glowIntense: '0 0 40px rgba(168, 85, 247, 0.5)',
  glowPink: '0 0 20px rgba(236, 72, 153, 0.3)',
};

/**
 * Helper function to get animation variants
 */
export function getAnimationVariant(variantName) {
  return loadingVariants[variantName] || loadingVariants.power;
}

/**
 * Helper function to get background pattern
 */
export function getBackgroundPattern(patternName) {
  return backgroundPatterns[patternName] || backgroundPatterns.animated;
}

/**
 * Helper function to get logo size
 */
export function getLogoSize(sizeType) {
  return sizePresets.logo[sizeType] || sizePresets.logo.medium;
}

/**
 * Custom theme hook
 * Use this to apply custom animations globally
 */
export function useAnimationTheme(customConfig = {}) {
  return {
    colors: { ...animationColors, ...customConfig.colors },
    durations: { ...animationDurations, ...customConfig.durations },
    patterns: { ...backgroundPatterns, ...customConfig.patterns },
    sizes: { ...sizePresets, ...customConfig.sizes },
  };
}

/**
 * Export configuration object for global use
 */
export const animationConfig = {
  colors: animationColors,
  durations: animationDurations,
  patterns: backgroundPatterns,
  variants: loadingVariants,
  sizes: sizePresets,
  easing,
  opacity,
  blur,
  gradients,
  shadows,
};
