import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/context/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Map the WCAG-compliant design tokens from globals.css into Tailwind,
      // so e.g. `bg-primary` or `text-text-light` follows the active theme.
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          light: 'var(--color-text-light)',
        },
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        focus: 'var(--color-focus)',
        error: 'var(--color-error)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        sans: ['var(--font-family)'],
        ethiopic: ['var(--font-ethiopic)', 'var(--font-family)'],
      },
      fontSize: {
        // Sizes stay relative to the accessibility font-size tokens.
        base: ['var(--font-size-base)', { lineHeight: 'var(--line-height)' }],
        lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height)' }],
        xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height)' }],
        '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height)' }],
        '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height)' }],
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },
      outlineColor: {
        focus: 'var(--color-focus)',
      },
    },
  },
  plugins: [],
};

export default config;
