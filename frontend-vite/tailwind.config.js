/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true, // Makes all Tailwind utilities !important
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
    "./index.html",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#ff5500',
      },
    },
  },
  plugins: [],
}
