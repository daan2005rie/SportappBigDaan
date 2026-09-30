/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 20px 45px -28px rgba(15, 118, 110, 0.75)',
      },
      colors: {
        brand: {
          50: '#ecfdf5',
          500: '#34d399',
          600: '#10b981',
        },
      },
    },
  },
  plugins: [],
}

