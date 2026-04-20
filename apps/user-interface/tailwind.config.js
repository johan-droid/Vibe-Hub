/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(210 100% 56%)',
        'primary-dim': 'hsl(210 80% 20%)',
        secondary: 'hsl(165 80% 45%)',
        tertiary: 'hsl(280 60% 60%)',
        surface: {
          DEFAULT: 'hsl(222 47% 7%)',
          dim: 'hsl(222 47% 5%)',
          bright: 'hsl(222 30% 11%)',
          container: 'hsl(222 30% 9%)',
          'container-high': 'hsl(222 25% 13%)',
        },
        outline: {
          DEFAULT: 'hsl(222 10% 25%)',
          variant: 'hsl(222 8% 18%)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
