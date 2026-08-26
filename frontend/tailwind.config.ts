import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#070A11',
        foreground: '#F1F5F9',
        surface: {
          0: '#070A11',
          1: '#0D1322',
          2: '#141D32',
          3: '#1C2742',
          4: '#273557',
        },
        primary: {
          DEFAULT: '#FACC15', // Vibrant Amber/Gold
          hover: '#FDE047',
          active: '#EAB308',
          glow: 'rgba(250, 204, 21, 0.25)',
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: '#38BDF8', // Electric Cyan
          hover: '#7DD3FC',
          foreground: '#000000',
        },
        muted: {
          DEFAULT: '#64748B',
          foreground: '#94A3B8',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          muted: 'rgba(255, 255, 255, 0.15)',
          highlight: 'rgba(250, 204, 21, 0.4)',
        },
        status: {
          success: '#34D399',
          error: '#F87171',
          warning: '#FBBF24',
          info: '#60A5FA',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 25px rgba(250, 204, 21, 0.35)',
        'glow-cyan': '0 0 25px rgba(56, 189, 248, 0.35)',
        'glow-sm': '0 0 12px rgba(250, 204, 21, 0.25)',
        card: '0 8px 30px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
