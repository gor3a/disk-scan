/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--paper-2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        line: 'var(--line)',
        safe: 'var(--safe)',
        'safe-bg': 'var(--safe-bg)',
        review: 'var(--review)',
        'review-bg': 'var(--review-bg)',
        keep: 'var(--keep)',
        'keep-bg': 'var(--keep-bg)',
        accent: 'var(--accent)',
        'accent-deep': 'var(--accent-deep)',
      },
      fontFamily: {
        display: ["'Fraunces Variable'", 'Georgia', 'serif'],
        sans: ["'Hanken Grotesk Variable'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono Variable'", 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(34,29,24,0.04), 0 18px 40px -24px rgba(34,29,24,0.45)',
      },
    },
  },
  plugins: [],
}
