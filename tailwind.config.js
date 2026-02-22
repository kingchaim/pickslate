/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0a0a0f',
        },
        fire: {
          400: '#ff6b35',
          500: '#ff5722',
          600: '#e64a19',
        },
        neon: {
          green: '#39ff14',
          red: '#ff073a',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      animation: {
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'pulse-fire': 'pulseFire 2s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'pick-confirm': 'pickConfirm 0.35s ease-out',
        'save-flash': 'saveFlash 1.4s ease-out forwards',
        'celebrate': 'celebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'card-reveal': 'cardReveal 0.4s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseFire: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 87, 34, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 87, 34, 0.6)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        pickConfirm: {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.025)' },
          '60%': { transform: 'scale(0.985)' },
          '100%': { transform: 'scale(1)' },
        },
        saveFlash: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '20%': { opacity: '1', transform: 'translateY(0)' },
          '70%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        celebrate: {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255, 87, 34, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 87, 34, 0.2), 0 0 40px rgba(255, 87, 34, 0.15)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        cardReveal: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
