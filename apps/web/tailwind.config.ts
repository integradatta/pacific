import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0E17',
        surface: '#121826',
        line: '#1F2837',
        text: '#E8ECF4',
        muted: '#7E899D',
        sonar: '#2BE5C2',
        status: {
          green: '#36B37E',
          yellow: '#E5C04B',
          orange: '#F08A3C',
          red: '#F0556A',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
