import type { Config } from 'tailwindcss';

// Charte Gamelia : palette violette (prune + mauve clair) et neutres. Valeurs dans styles/charte.css.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        sunken: 'rgb(var(--sunken-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        primary: { DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)', ink: 'rgb(var(--primary-ink-rgb) / <alpha-value>)', soft: 'rgb(var(--primary-soft-rgb) / <alpha-value>)', strong: 'rgb(var(--primary-strong-rgb) / <alpha-value>)' },
        accent: { DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)', ink: 'rgb(var(--accent-ink-rgb) / <alpha-value>)', soft: 'rgb(var(--accent-soft-rgb) / <alpha-value>)' },
        success: { DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)', soft: 'rgb(var(--success-soft-rgb) / <alpha-value>)' },
        danger: { DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)', soft: 'rgb(var(--danger-soft-rgb) / <alpha-value>)' },
      },
      fontFamily: { sans: ['var(--font-gamelia)', 'system-ui', 'sans-serif'] },
      borderRadius: { sm: '6px', DEFAULT: '8px', lg: '14px', xl: '20px' },
      maxWidth: { prose: '68ch', feed: '46rem' },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [],
};
export default config;
