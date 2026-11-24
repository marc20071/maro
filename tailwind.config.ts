import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      ink: { 950: '#0B0E13', 900: '#10141B', 800: '#171C25', 700: '#222936', 600: '#2F384A' },
      saffron: { DEFAULT: '#F5A524', soft: '#F5A52420' },
      paper: '#E8E6E1', mute: '#8C93A3',
    },
    fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], mono: ['var(--font-mono)', 'ui-monospace', 'monospace'] },
  } },
  plugins: [],
};
export default config;
