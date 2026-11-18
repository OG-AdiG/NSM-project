import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#111111',
          soft: '#2a2a2a',
          muted: '#666666',
          faint: '#999999',
        },
        paper: {
          DEFAULT: '#f7f7f5',
          soft: '#efefed',
          line: '#e2e2de',
          pure: '#ffffff',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        soft: '0.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
