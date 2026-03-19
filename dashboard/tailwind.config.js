/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        carbon: {
          50: '#f6f6f7',
          100: '#e1e2e5',
          200: '#c3c5cb',
          300: '#9ea1aa',
          400: '#7a7e89',
          500: '#60646f',
          600: '#4c4f58',
          700: '#3e4149',
          800: '#2a2c31',
          900: '#1a1b1f',
          950: '#0d0e10',
        },
        amber: {
          50: '#fffbeb',
          100: '#fff3c6',
          200: '#ffe588',
          300: '#ffd24a',
          400: '#ffbe20',
          500: '#f99b07',
          600: '#dd7302',
          700: '#b75006',
          800: '#943d0c',
          900: '#7a330d',
          950: '#461902',
        },
        'racing-red': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.75s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 190, 32, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 190, 32, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
