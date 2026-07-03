/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Material 3 Tonal Palette (Dark Mode Base)
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          container: 'hsl(var(--primary-container) / <alpha-value>)',
          'on-container': 'hsl(var(--on-primary-container) / <alpha-value>)',
        },
        'on-primary': 'hsl(var(--on-primary) / <alpha-value>)',
        
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          container: 'hsl(var(--secondary-container) / <alpha-value>)',
          'on-container': 'hsl(var(--on-secondary-container) / <alpha-value>)',
        },
        'on-secondary': 'hsl(var(--on-secondary) / <alpha-value>)',

        tertiary: {
          DEFAULT: 'hsl(var(--tertiary) / <alpha-value>)',
          container: 'hsl(var(--tertiary-container) / <alpha-value>)',
          'on-container': 'hsl(var(--on-tertiary-container) / <alpha-value>)',
        },
        'on-tertiary': 'hsl(var(--on-tertiary) / <alpha-value>)',

        error: {
          DEFAULT: 'hsl(var(--error) / <alpha-value>)',
          container: 'hsl(var(--error-container) / <alpha-value>)',
        },
        'on-error': 'hsl(var(--on-error) / <alpha-value>)',

        surface: {
          dim: 'hsl(var(--surface-dim) / <alpha-value>)',
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          bright: 'hsl(var(--surface-bright) / <alpha-value>)',
          'container-lowest': 'hsl(var(--surface-container-lowest) / <alpha-value>)',
          'container-low': 'hsl(var(--surface-container-low) / <alpha-value>)',
          'container': 'hsl(var(--surface-container) / <alpha-value>)',
          'container-high': 'hsl(var(--surface-container-high) / <alpha-value>)',
          'container-highest': 'hsl(var(--surface-container-highest) / <alpha-value>)',
        },
        'on-surface': 'hsl(var(--on-surface) / <alpha-value>)',
        'on-surface-variant': 'hsl(var(--on-surface-variant) / <alpha-value>)',
        
        outline: {
          DEFAULT: 'hsl(var(--outline) / <alpha-value>)',
          variant: 'hsl(var(--outline-variant) / <alpha-value>)',
        },
        
        // Google Brand Colors
        'google-blue': 'hsl(var(--google-blue) / <alpha-value>)',
        'google-red': 'hsl(var(--google-red) / <alpha-value>)',
        'google-yellow': 'hsl(var(--google-yellow) / <alpha-value>)',
        'google-green': 'hsl(var(--google-green) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'shape-xs': '4px',
        'shape-sm': '8px',
        'shape-md': '12px',
        'shape-lg': '16px',
        'shape-xl': '28px',
        'shape-2xl': '32px',
        '3xl': '36px',
      },
      transitionTimingFunction: {
        'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        'standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
        'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
      },
      animation: {
        'ripple': 'ripple 0.6s linear',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        ripple: {
          'to': { transform: 'scale(4)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
