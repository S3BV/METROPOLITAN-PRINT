/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,js}'],
  theme: {
    extend: {
      colors: {
        bg:      '#18191f',
        nav:     '#111116',
        surface: '#1d1e26',
        border:  '#28293a',
        muted:   '#545e6a',
        subtle:  '#2c3040',
      },
    },
  },
}