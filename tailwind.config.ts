import type { Config } from 'tailwindcss'

// Theme colors live in CSS variables. Wrapping them in color-mix with <alpha-value>
// lets Tailwind generate opacity-modified utilities (bg-accent/10, ring-accent/60…);
// with a plain var(--x) definition those classes are silently dropped.
const themed = (variable: string) => `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': themed('--color-bg-primary'),
        'bg-secondary': themed('--color-bg-secondary'),
        'bg-tertiary': themed('--color-bg-tertiary'),
        'bg-card': themed('--color-bg-card'),
        'text-primary': themed('--color-text-primary'),
        'text-secondary': themed('--color-text-secondary'),
        'text-muted': themed('--color-text-muted'),
        accent: themed('--color-accent'),
        'accent-hover': themed('--color-accent-hover'),
        'accent-soft': themed('--color-accent-soft'),
        'border-color': themed('--color-border'),
        'border-hover': themed('--color-border-hover'),
      },
      fontFamily: {
        cozy: ['var(--font-family)', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--border-radius-sm)',
        md: 'var(--border-radius-md)',
        lg: 'var(--border-radius-lg)',
        xl: 'var(--border-radius-xl)',
        '2xl': 'var(--border-radius-2xl)',
        '3xl': 'var(--border-radius-3xl)',
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        e1: 'var(--shadow-e1)',
        e2: 'var(--shadow-e2)',
        e3: 'var(--shadow-e3)',
      },
    },
  },
  plugins: [],
} satisfies Config
