/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        royal: {
          50: '#eef4ff',
          100: '#dde7ff',
          200: '#bccfff',
          300: '#8fadff',
          400: '#5c86fa',
          500: '#4169e1',
          600: '#3454c4',
          700: '#2b44a1',
          800: '#253983',
          900: '#21326b',
        },
      },
    },
  },
  plugins: [],
}
