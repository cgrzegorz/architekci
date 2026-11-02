/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#2f6fdb',
        hot: '#1f9d6b',
        warm: '#f0a83a',
        staly: '#a3acb9',
        sub: '#6d8fd6',
        unk: '#a78bfa', // nie wiadomo, kto robi elektrykę
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
