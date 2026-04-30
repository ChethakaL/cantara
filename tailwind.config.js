/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#d4a843',
          500: '#b8922a',
          600: '#9a7a22',
        },
        navy: {
          900: '#0d1829',
          800: '#111e35',
          700: '#162240',
        },
        cantara: {
          navy: '#21263C',
          sun: '#F1E6BB',
          terracotta: '#D37141',
          gold: '#CAA15F',
          beige: '#F4F0ED',
          white: '#FEFEFE',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
