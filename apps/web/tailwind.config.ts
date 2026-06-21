import type { Config } from 'tailwindcss';

// Cores definidas como canais RGB em CSS variables (app/globals.css :root),
// referenciadas aqui com <alpha-value> para preservar todos os usos `cor/opacidade`.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: v('--ink'),
        surface: v('--surface'),
        surface2: v('--surface-2'),
        line: v('--line'),
        'line-strong': v('--line-strong'),
        text: v('--text'),
        'text-dim': v('--text-dim'),
        muted: v('--muted'),
        sonar: v('--sonar'),
        status: {
          green: v('--green'),
          yellow: v('--yellow'),
          orange: v('--orange'),
          red: v('--red'),
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        // Painel "iluminado de cima": highlight interno no topo + sombra projetada.
        panel: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 14px 34px -22px rgb(0 0 0 / 0.95)',
        'panel-hover': '0 1px 0 0 rgb(255 255 255 / 0.07) inset, 0 22px 46px -24px rgb(0 0 0 / 1)',
        glow: '0 0 0 1px rgb(var(--sonar) / 0.25), 0 0 22px -2px rgb(var(--sonar) / 0.45)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        sweep: { '0%': { left: '-12%' }, '100%': { left: '108%' } },
        ping2: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '70%, 100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        rise: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        sweep: 'sweep 6.5s cubic-bezier(0.6, 0, 0.4, 1) infinite',
        ping2: 'ping2 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        rise: 'rise 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
