/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './popup.html',
    './inspect.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FBF8F3',
        foreground: '#1A1A1A',
        paper: '#F5F0E8',
        'muted-foreground': '#6B6B6B',
        safe: '#22C55E',
        caution: '#F59E0B',
        now: '#EF4444',
        primary: '#1A1A1A',
        'primary-foreground': '#FBF8F3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
