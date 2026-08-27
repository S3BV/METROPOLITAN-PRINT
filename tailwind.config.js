/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--col-bg)',
        nav:     'var(--col-nav)',
        surface: 'var(--col-surf)',
        border:  'var(--col-bord)',
        muted:   'var(--col-muted)',
        subtle:  'var(--col-subtle)',
      },
    },
  },
}
