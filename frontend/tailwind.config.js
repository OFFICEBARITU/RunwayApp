/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: '#080808',
        'noir-soft': '#111111',
        'noir-card': '#161616',
        cream: '#F5F0E8',
        'cream-dim': '#C8BFB0',
        rouge: '#C0001A',
        'rouge-deep': '#8B0010',
        'rouge-bright': '#E8001F',
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'serif'],
        body: ['var(--font-montserrat)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
